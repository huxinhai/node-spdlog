#pragma once

#include <napi.h>

#include <exception>
#include <string>
#include <utility>

namespace node_spdlog {

std::string ReadRequiredString(const Napi::CallbackInfo& info, std::size_t index, const char* name);
bool ReadOptionalBool(const Napi::CallbackInfo& info, std::size_t index, bool default_value, const char* name);

template <typename Fn>
Napi::Value WrapVoid(const Napi::CallbackInfo& info, Fn&& fn) {
  try {
    std::forward<Fn>(fn)();
    return info.Env().Undefined();
  } catch (const std::exception& error) {
    Napi::Error::New(info.Env(), error.what()).ThrowAsJavaScriptException();
    return info.Env().Undefined();
  }
}

}  // namespace node_spdlog
