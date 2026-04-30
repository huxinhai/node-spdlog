#pragma once

#include <string>
#include <string_view>

#include "spdlog/common.h"

namespace node_spdlog {

struct Version {
  int major;
  int minor;
  int patch;
};

void Initialize();
void RegisterEnvironment();
void CleanupEnvironment() noexcept;
void Log(spdlog::level::level_enum level, const std::string& message);
void SetLevel(spdlog::level::level_enum level);
void SetFlushOn(spdlog::level::level_enum level);
void SetPattern(std::string pattern);
void UseConsoleLogger();
void UseBasicFileLogger(const std::string& name, const std::string& file_path, bool truncate);
void Flush();
spdlog::level::level_enum ParseLevel(std::string_view level);
Version GetVersion();

}  // namespace node_spdlog
