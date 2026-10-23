import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { NativeBinding } from "../src/type.js";

const spdog = (await import("../dist/index.js")) as NativeBinding;

spdog.setPattern("[%l] %v");
spdog.setLevel("trace");
spdog.info("runtime verification ok");
spdog.useBasicFileLogger("ci-file", "ci-verify.log", true);
spdog.warn("file logger verification ok");
spdog.flush();
spdog.useConsoleLogger();

const tempDir = mkdtempSync(path.join(tmpdir(), "node-spdlog-runtime-"));
try {
  const filePath = path.join(tempDir, "async.log");
  spdog.setPattern("%v");
  spdog.useAsyncBasicFileLogger("ci-async-file", filePath, true);
  spdog.info("async runtime verification ok");
  spdog.flush();
  assert.equal(readFileSync(filePath, "utf8").trimEnd(), "async runtime verification ok");
  spdog.useAsyncConsoleLogger();
  spdog.info("async console verification ok");
  spdog.flush();
} finally {
  spdog.useConsoleLogger();
  rmSync(tempDir, { recursive: true, force: true });
}

if (!spdog.version || typeof spdog.version.major !== "number") {
  throw new Error("spdog.version is missing");
}

console.log(JSON.stringify(spdog.version));
