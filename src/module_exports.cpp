#include "module_exports.h"

#include "js_args.h"
#include "logger.h"

namespace {

void CleanupEnvironmentHook(void*) {
  node_spdlog::CleanupEnvironment();
}

template <spdlog::level::level_enum Level>
Napi::Value LogAtLevel(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    node_spdlog::Log(Level, node_spdlog::ReadRequiredString(info, 0, "message"));
  });
}

Napi::Value LogBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    const auto level = node_spdlog::ParseLevel(node_spdlog::ReadRequiredString(info, 0, "level"));
    const auto message = node_spdlog::ReadRequiredString(info, 1, "message");
    node_spdlog::Log(level, message);
  });
}

Napi::Value SetLevelBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    node_spdlog::SetLevel(node_spdlog::ParseLevel(node_spdlog::ReadRequiredString(info, 0, "level")));
  });
}

Napi::Value SetFlushOnBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    node_spdlog::SetFlushOn(node_spdlog::ParseLevel(node_spdlog::ReadRequiredString(info, 0, "level")));
  });
}

Napi::Value SetPatternBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    node_spdlog::SetPattern(node_spdlog::ReadRequiredString(info, 0, "pattern"));
  });
}

Napi::Value UseConsoleLoggerBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    node_spdlog::UseConsoleLogger();
  });
}

Napi::Value UseBasicFileLoggerBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    const auto name = node_spdlog::ReadRequiredString(info, 0, "name");
    const auto file_path = node_spdlog::ReadRequiredString(info, 1, "filePath");
    const auto truncate = node_spdlog::ReadOptionalBool(info, 2, false, "truncate");
    node_spdlog::UseBasicFileLogger(name, file_path, truncate);
  });
}

Napi::Value FlushBinding(const Napi::CallbackInfo& info) {
  return node_spdlog::WrapVoid(info, [&]() {
    node_spdlog::Flush();
  });
}

Napi::Object CreateVersionObject(Napi::Env env) {
  const auto version = node_spdlog::GetVersion();
  auto value = Napi::Object::New(env);
  value.Set("major", Napi::Number::New(env, version.major));
  value.Set("minor", Napi::Number::New(env, version.minor));
  value.Set("patch", Napi::Number::New(env, version.patch));
  return value;
}

}  // namespace

namespace node_spdlog {

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  RegisterEnvironment();

  const auto cleanup_status = napi_add_env_cleanup_hook(
    env,
    CleanupEnvironmentHook,
    nullptr
  );

  if (cleanup_status != napi_ok) {
    CleanupEnvironment();
    Napi::Error::New(env, "Failed to register native cleanup hook").ThrowAsJavaScriptException();
    return exports;
  }

  exports.Set("log", Napi::Function::New(env, LogBinding));
  exports.Set("trace", Napi::Function::New(env, LogAtLevel<spdlog::level::trace>));
  exports.Set("debug", Napi::Function::New(env, LogAtLevel<spdlog::level::debug>));
  exports.Set("info", Napi::Function::New(env, LogAtLevel<spdlog::level::info>));
  exports.Set("warn", Napi::Function::New(env, LogAtLevel<spdlog::level::warn>));
  exports.Set("error", Napi::Function::New(env, LogAtLevel<spdlog::level::err>));
  exports.Set("critical", Napi::Function::New(env, LogAtLevel<spdlog::level::critical>));
  exports.Set("setLevel", Napi::Function::New(env, SetLevelBinding));
  exports.Set("setFlushOn", Napi::Function::New(env, SetFlushOnBinding));
  exports.Set("setPattern", Napi::Function::New(env, SetPatternBinding));
  exports.Set("useConsoleLogger", Napi::Function::New(env, UseConsoleLoggerBinding));
  exports.Set("useBasicFileLogger", Napi::Function::New(env, UseBasicFileLoggerBinding));
  exports.Set("flush", Napi::Function::New(env, FlushBinding));
  exports.Set("version", CreateVersionObject(env));

  return exports;
}

}  // namespace node_spdlog
