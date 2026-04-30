#include "logger.h"

#include <atomic>
#include <memory>
#include <mutex>
#include <stdexcept>

#include "spdlog/logger.h"
#include "spdlog/sinks/basic_file_sink.h"
#include "spdlog/sinks/stdout_color_sinks.h"
#include "spdlog/version.h"

namespace {

constexpr const char* kConsoleLoggerName = "node_spdlog_console";
constexpr const char* kDefaultPattern = "[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v";
constexpr const char* kSupportedLevels = "trace, debug, info, warn, error, critical, off";

struct LoggerState {
  std::string pattern = kDefaultPattern;
  spdlog::level::level_enum level = spdlog::level::info;
  spdlog::level::level_enum flush_level = spdlog::level::off;
};

std::mutex g_logger_state_mutex;
std::shared_ptr<spdlog::logger> g_current_logger;
LoggerState g_logger_state;
std::size_t g_active_environment_count = 0;

std::shared_ptr<spdlog::logger> CreateConsoleLogger();

std::shared_ptr<spdlog::logger> LoadCurrentLogger() {
  auto logger = std::atomic_load_explicit(&g_current_logger, std::memory_order_acquire);
  if (!logger) {
    throw std::runtime_error("Logger is not initialized");
  }
  return logger;
}

void ApplyLoggerState(const std::shared_ptr<spdlog::logger>& logger, const LoggerState& state) {
  logger->set_pattern(state.pattern);
  logger->set_level(state.level);
  logger->flush_on(state.flush_level);
}

void EnsureLoggerInitializedLocked() {
  if (std::atomic_load_explicit(&g_current_logger, std::memory_order_acquire)) {
    return;
  }

  auto logger = CreateConsoleLogger();
  ApplyLoggerState(logger, g_logger_state);
  std::atomic_store_explicit(&g_current_logger, std::move(logger), std::memory_order_release);
}

std::shared_ptr<spdlog::logger> CreateConsoleLogger() {
  auto sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
  return std::make_shared<spdlog::logger>(kConsoleLoggerName, std::move(sink));
}

std::shared_ptr<spdlog::logger> CreateBasicFileLogger(
  const std::string& name,
  const std::string& file_path,
  bool truncate
) {
  auto sink = std::make_shared<spdlog::sinks::basic_file_sink_mt>(file_path, truncate);
  return std::make_shared<spdlog::logger>(name, std::move(sink));
}

}  // namespace

namespace node_spdlog {

void Initialize() {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  EnsureLoggerInitializedLocked();
}

void RegisterEnvironment() {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  EnsureLoggerInitializedLocked();
  g_active_environment_count += 1;
}

void CleanupEnvironment() noexcept {
  std::shared_ptr<spdlog::logger> logger;

  {
    std::lock_guard<std::mutex> lock(g_logger_state_mutex);
    if (g_active_environment_count == 0) {
      return;
    }

    g_active_environment_count -= 1;
    if (g_active_environment_count != 0) {
      return;
    }

    logger = std::atomic_exchange_explicit(
      &g_current_logger,
      std::shared_ptr<spdlog::logger>{},
      std::memory_order_acq_rel
    );
    g_logger_state = LoggerState{};
  }

  if (!logger) {
    return;
  }

  try {
    logger->flush();
  } catch (...) {
  }
}

void Log(spdlog::level::level_enum level, const std::string& message) {
  LoadCurrentLogger()->log(level, message);
}

void SetLevel(spdlog::level::level_enum level) {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  LoadCurrentLogger()->set_level(level);
  g_logger_state.level = level;
}

void SetFlushOn(spdlog::level::level_enum level) {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  LoadCurrentLogger()->flush_on(level);
  g_logger_state.flush_level = level;
}

void SetPattern(std::string pattern) {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  LoadCurrentLogger()->set_pattern(pattern);
  g_logger_state.pattern = std::move(pattern);
}

void UseConsoleLogger() {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  auto logger = CreateConsoleLogger();
  ApplyLoggerState(logger, g_logger_state);
  std::atomic_store_explicit(&g_current_logger, std::move(logger), std::memory_order_release);
}

void UseBasicFileLogger(const std::string& name, const std::string& file_path, bool truncate) {
  std::lock_guard<std::mutex> lock(g_logger_state_mutex);
  auto logger = CreateBasicFileLogger(name, file_path, truncate);
  ApplyLoggerState(logger, g_logger_state);
  std::atomic_store_explicit(&g_current_logger, std::move(logger), std::memory_order_release);
}

void Flush() {
  LoadCurrentLogger()->flush();
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
