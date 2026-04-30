#pragma once

#include <napi.h>

namespace node_spdlog {

Napi::Object InitModule(Napi::Env env, Napi::Object exports);

}  // namespace node_spdlog
