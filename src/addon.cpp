#include <napi.h>

#include "module_exports.h"

namespace {

Napi::Object InitAddon(Napi::Env env, Napi::Object exports) {
  return node_spdlog::InitModule(env, exports);
}

}  // namespace

NODE_API_MODULE(node_spdlog, InitAddon)
