#include "logger.h"

#include <exception>
#include <cstdio>
#include <filesystem>
#include <future>
#include <memory>
#include <mutex>
#include <shared_mutex>
#include <stdexcept>
#include <utility>
#include <vector>

#include "spdlog/async_logger.h"
#include "spdlog/details/os.h"
#include "spdlog/details/thread_pool.h"
#include "spdlog/logger.h"
#include "spdlog/sinks/base_sink.h"
#include "spdlog/sinks/basic_file_sink.h"
#include "spdlog/sinks/stdout_color_sinks.h"
#include "spdlog/version.h"

namespace {

constexpr const char* kConsoleLoggerName = "node_spdlog_console";
constexpr const char* kDefaultPattern = "[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v";
constexpr const char* kSupportedLevels = "trace, debug, info, warn, error, critical, off";
constexpr std::size_t kAsyncQueueSize = 8192;

// A separate flush message gives us an exact FIFO barrier, even when earlier
// messages trigger flush_on(). The sink never owns the thread pool.
class FlushBarrierSink final : public spdlog::sinks::base_sink<std::mutex> {
 public:
  explicit FlushBarrierSink(std::vector<spdlog::sink_ptr> sinks) : sinks_(std::move(sinks)) {}

  std::future<void> GetFuture() { return completion_.get_future(); }

 protected:
  void sink_it_(const spdlog::details::log_msg&) override {}

  void flush_() override {
    try {
      for (const auto& sink : sinks_) {
        sink->flush();
      }
      completion_.set_value();
    } catch (...) {
      completion_.set_exception(std::current_exception());
    }
  }

 private:
  std::vector<spdlog::sink_ptr> sinks_;
  std::promise<void> completion_;
};

struct LoggerRuntime {
  std::shared_ptr<spdlog::logger> logger;
  // Destroy/join the pool before releasing the logger. Queue messages own only
  // the spdlog logger, so the runtime cannot be destroyed by its own worker.
  std::shared_ptr<spdlog::details::thread_pool> pool;

  void Flush(bool propagate_errors = true) const {
    if (!pool) {
      logger->flush();
      return;
    }

    auto sink = std::make_shared<FlushBarrierSink>(logger->sinks());
    auto completion = sink->GetFuture();
    auto barrier = std::make_shared<spdlog::async_logger>("node_spdlog_flush", sink, pool);
    pool->post_flush(std::move(barrier), spdlog::async_overflow_policy::block);
    // Only sink errors arrive through the future, after the FIFO barrier has
    // completed. Switching must still be possible when the old device fails.
    if (propagate_errors) {
      completion.get();
    } else {
      try {
        completion.get();
      } catch (const std::exception& error) {
        std::fprintf(stderr, "[node-spdlog] Failed to flush previous logger: %s\n", error.what());
      } catch (...) {
        std::fputs("[node-spdlog] Failed to flush previous logger\n", stderr);
      }
    }
  }
};

struct LoggerState {
  std::string pattern = kDefaultPattern;
  spdlog::level::level_enum level = spdlog::level::info;
  spdlog::level::level_enum flush_level = spdlog::level::off;
};

// Readers hold the gate through enqueue/flush. A switch can then drain the old
// queue before opening a replacement file (which may truncate the same path).
std::shared_mutex g_logger_state_mutex;
std::shared_ptr<LoggerRuntime> g_current_logger;
LoggerState g_logger_state;
std::size_t g_active_environment_count = 0;

std::shared_ptr<LoggerRuntime> CreateConsoleLogger(bool async = false);

const std::shared_ptr<LoggerRuntime>& LoadCurrentLogger() {
  if (!g_current_logger) {
    throw std::runtime_error("Logger is not initialized");
  }
  return g_current_logger;
}

void ApplyLoggerState(const std::shared_ptr<spdlog::logger>& logger, const LoggerState& state) {
  logger->set_pattern(state.pattern);
  logger->set_level(state.level);
  logger->flush_on(state.flush_level);
}

void EnsureLoggerInitializedLocked() {
  if (g_current_logger) {
    return;
  }

  auto logger = CreateConsoleLogger();
  ApplyLoggerState(logger->logger, g_logger_state);
  g_current_logger = std::move(logger);
}

std::shared_ptr<LoggerRuntime> CreateLogger(
  const std::string& name,
  spdlog::sink_ptr sink,
  bool async
) {
  auto runtime = std::make_shared<LoggerRuntime>();
  if (async) {
    runtime->pool = std::make_shared<spdlog::details::thread_pool>(kAsyncQueueSize, 1);
    runtime->logger = std::make_shared<spdlog::async_logger>(
      name, std::move(sink), runtime->pool, spdlog::async_overflow_policy::block
    );
  } else {
    runtime->logger = std::make_shared<spdlog::logger>(name, std::move(sink));
  }
  return runtime;
}

std::shared_ptr<LoggerRuntime> CreateConsoleLogger(bool async) {
  auto sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
  return CreateLogger(kConsoleLoggerName, std::move(sink), async);
}

spdlog::filename_t ToSpdlogFilename(const std::string& file_path) {
#if defined(_WIN32) && defined(SPDLOG_WCHAR_FILENAMES)
  spdlog::wmemory_buf_t wide_path;
  spdlog::details::os::utf8_to_wstrbuf(
    spdlog::string_view_t(file_path.data(), file_path.size()),
    wide_path
  );
  return spdlog::filename_t(wide_path.data(), wide_path.size());
#else
  return file_path;
#endif
}

void EnsureContainingDirectory(const spdlog::filename_t& file_path) {
  try {
    const auto parent = std::filesystem::path(file_path).parent_path();
    if (!parent.empty() && !std::filesystem::exists(parent)) {
      std::filesystem::create_directories(parent);
    }
  } catch (...) {
    // Let spdlog make the final open attempt and surface the original failure.
  }
}

std::shared_ptr<LoggerRuntime> CreateBasicFileLogger(
  const std::string& name,
  const std::string& file_path,
  bool truncate,
  bool async
) {
  const auto filename = ToSpdlogFilename(file_path);
  EnsureContainingDirectory(filename);
  auto sink = std::make_shared<spdlog::sinks::basic_file_sink_mt>(filename, truncate);
  return CreateLogger(name, std::move(sink), async);
}

void SwitchConsoleLogger(bool async) {
  std::unique_lock lock(g_logger_state_mutex);
  LoadCurrentLogger()->Flush(/*propagate_errors=*/false);
  auto logger = CreateConsoleLogger(async);
  ApplyLoggerState(logger->logger, g_logger_state);
  g_current_logger = std::move(logger);
}

void SwitchBasicFileLogger(
  const std::string& name,
  const std::string& file_path,
  bool truncate,
  bool async
) {
  std::unique_lock lock(g_logger_state_mutex);
  LoadCurrentLogger()->Flush(/*propagate_errors=*/false);
  auto logger = CreateBasicFileLogger(name, file_path, truncate, async);
  ApplyLoggerState(logger->logger, g_logger_state);
  g_current_logger = std::move(logger);
}

}  // namespace

namespace node_spdlog {

void Initialize() {
  std::unique_lock lock(g_logger_state_mutex);
  EnsureLoggerInitializedLocked();
}

void RegisterEnvironment() {
  std::unique_lock lock(g_logger_state_mutex);
  EnsureLoggerInitializedLocked();
  g_active_environment_count += 1;
}

void CleanupEnvironment() noexcept {
  std::unique_lock lock(g_logger_state_mutex);
  if (g_active_environment_count == 0) {
    return;
  }

  g_active_environment_count -= 1;
  if (g_active_environment_count != 0) {
    return;
  }

  // Keep registration behind the gate until the old queue is drained and its
  // pool joined, so a new environment cannot truncate a file still being used.
  auto logger = std::move(g_current_logger);
  g_logger_state = LoggerState{};

  if (!logger) {
    return;
  }

  try {
    logger->Flush();
  } catch (...) {
  }
}

void Log(spdlog::level::level_enum level, const std::string& message) {
  std::shared_lock lock(g_logger_state_mutex);
  LoadCurrentLogger()->logger->log(level, message);
}

void SetLevel(spdlog::level::level_enum level) {
  std::unique_lock lock(g_logger_state_mutex);
  LoadCurrentLogger()->logger->set_level(level);
  g_logger_state.level = level;
}

void SetFlushOn(spdlog::level::level_enum level) {
  std::unique_lock lock(g_logger_state_mutex);
  const auto& runtime = LoadCurrentLogger();
  if (runtime->pool) {
    runtime->Flush();
  }
  runtime->logger->flush_on(level);
  g_logger_state.flush_level = level;
}

void SetPattern(std::string pattern) {
  std::unique_lock lock(g_logger_state_mutex);
  const auto& runtime = LoadCurrentLogger();
  if (runtime->pool) {
    runtime->Flush();
  }
  runtime->logger->set_pattern(pattern);
  g_logger_state.pattern = std::move(pattern);
}

void UseConsoleLogger() {
  SwitchConsoleLogger(false);
}

void UseBasicFileLogger(const std::string& name, const std::string& file_path, bool truncate) {
  SwitchBasicFileLogger(name, file_path, truncate, false);
}

void UseAsyncConsoleLogger() {
  SwitchConsoleLogger(true);
}

void UseAsyncBasicFileLogger(const std::string& name, const std::string& file_path, bool truncate) {
  SwitchBasicFileLogger(name, file_path, truncate, true);
}

void Flush() {
  std::shared_lock lock(g_logger_state_mutex);
  LoadCurrentLogger()->Flush();
}

spdlog::level::level_enum ParseLevel(std::string_view level) {
  if (level == "trace") {
    return spdlog::level::trace;
  }
  if (level == "debug") {
    return spdlog::level::debug;
  }
  if (level == "info") {
    return spdlog::level::info;
  }
  if (level == "warn") {
    return spdlog::level::warn;
  }
  if (level == "error") {
    return spdlog::level::err;
  }
  if (level == "critical") {
    return spdlog::level::critical;
  }
  if (level == "off") {
    return spdlog::level::off;
  }

  throw std::invalid_argument(
    std::string("Unsupported log level '") + std::string(level) + "'. Supported levels: " + kSupportedLevels
  );
}

Version GetVersion() {
  return Version{
    SPDLOG_VER_MAJOR,
    SPDLOG_VER_MINOR,
    SPDLOG_VER_PATCH,
  };
}

}  // namespace node_spdlog
