import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function currentPlatform(): string {
  if (process.platform === "darwin") {
    return "macos";
  }
  if (process.platform === "win32") {
    return "windows";
  }
  if (process.platform === "linux") {
    return "linux";
  }
  return process.platform;
}

function prebuiltLabels(): string[] {
  const label = `${currentPlatform()}-${process.arch}`;
  if (process.platform === "darwin") {
    return [label, "macos-universal"];
  }
  return [label];
}

function hasPrebuiltBinary(): boolean {
  return prebuiltLabels().some((label) =>
    existsSync(path.join(rootDir, "artifacts", label, "spdog.node"))
  );
}

if (hasPrebuiltBinary()) {
  console.log("node-spdlog: using bundled native binary");
  process.exit(0);
}

console.log("node-spdlog: no bundled native binary found, building from source");
execFileSync(process.execPath, [path.join(rootDir, "node_modules", "node-gyp", "bin", "node-gyp.js"), "rebuild"], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env
});
