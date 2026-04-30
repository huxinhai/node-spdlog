#include "logger.h"

#include <memory>
#include <stdexcept>

#include "spdlog/sinks/basic_file_sink.h"
#include "spdlog/sinks/stdout_color_sinks.h"
#include "spdlog/spdlog.h"
#include "spdlog/version.h"

namespace {

constexpr const char* kConsoleLoggerName = "node_spdlog_console";
constexpr const char* kDefaultPattern = "[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v";

std::shared_ptr<spdlog::logger> EnsureConsoleLogger() {
  auto logger = spdlog::get(kConsoleLoggerName);
  if (!logger) {
    logger = spdlog::stdout_color_mt(kConsoleLoggerName);
  }

  return logger;
}

}  // namespace

namespace node_spdlog {

void Initialize() {
  spdlog::set_default_logger(EnsureConsoleLogger());
  spdlog::set_pattern(kDefaultPattern);
}

void Log(spdlog::level::level_enum level, const std::string& message) {
  spdlog::log(level, message);
}

void SetLevel(spdlog::level::level_enum level) {
  spdlog::set_level(level);
}

void SetFlushOn(spdlog::level::level_enum level) {
  spdlog::flush_on(level);
}

void SetPattern(const std::string& pattern) {
  spdlog::set_pattern(pattern);
}

void UseConsoleLogger() {
  spdlog::set_default_logger(EnsureConsoleLogger());
}

void UseBasicFileLogger(const std::string& name, const std::string& file_path, bool truncate) {
  spdlog::drop(name);
  auto logger = spdlog::basic_logger_mt(name, file_path, truncate);
  spdlog::set_default_logger(logger);
}

void Flush() {
  auto logger = spdlog::default_logger();
  if (!logger) {
    throw std::runtime_error("Default logger is not initialized");
  }

  logger->flush();
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

  throw std::invalid_argument("Unsupported log level");
}

Version GetVersion() {
  return Version{
    SPDLOG_VER_MAJOR,
    SPDLOG_VER_MINOR,
    SPDLOG_VER_PATCH,
  };
}

}  // namespace node_spdlog
