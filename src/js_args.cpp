#include "js_args.h"

#include <stdexcept>

namespace node_spdlog {

std::string ReadRequiredString(const Napi::CallbackInfo& info, std::size_t index, const char* name) {
  if (info.Length() <= index || !info[index].IsString()) {
    throw std::invalid_argument(std::string(name) + " must be a string");
  }

  return info[index].As<Napi::String>().Utf8Value();
}

bool ReadOptionalBool(const Napi::CallbackInfo& info, std::size_t index, bool default_value, const char* name) {
  if (info.Length() <= index || info[index].IsUndefined() || info[index].IsNull()) {
    return default_value;
  }

  if (!info[index].IsBoolean()) {
    throw std::invalid_argument(std::string(name) + " must be a boolean");
  }

  return info[index].As<Napi::Boolean>().Value();
}

}  // namespace node_spdlog
