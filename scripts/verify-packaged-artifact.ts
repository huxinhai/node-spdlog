import type { NativeBinding } from "../src/type.js";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const label = process.env.ARTIFACT_LABEL?.trim();
if (!label) {
  throw new Error("ARTIFACT_LABEL is required");
}

const artifactDist = pathToFileURL(
  path.resolve("artifacts", label, "dist", "index.js")
).href;
const spdog = (await import(artifactDist)) as NativeBinding;

spdog.info("packaged artifact verification ok");
const tempDir = mkdtempSync(path.join(tmpdir(), "node-spdlog-artifact-"));
try {
  const filePath = path.join(tempDir, "async.log");
  spdog.setPattern("%v");
  spdog.useAsyncBasicFileLogger("artifact-async-file", filePath, true);
  spdog.info("async packaged artifact verification ok");
  spdog.flush();
  assert.equal(readFileSync(filePath, "utf8").trimEnd(), "async packaged artifact verification ok");
  spdog.useAsyncConsoleLogger();
  spdog.info("async packaged console verification ok");
  spdog.flush();
} finally {
  spdog.useConsoleLogger();
  rmSync(tempDir, { recursive: true, force: true });
}
console.log(JSON.stringify(spdog.version));
