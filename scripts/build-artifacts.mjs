import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts");
const require = createRequire(import.meta.url);
const sourceFiles = [
  "src/addon.cpp",
  "src/module_exports.cpp",
  "src/logger.cpp",
  "src/js_args.cpp"
];

function resolveNodeAddonApiInclude() {
  return path.dirname(require.resolve("node-addon-api"));
}

function resolveNodeHeadersInclude() {
  const includeDir = path.join(os.homedir(), "Library", "Caches", "node-gyp", process.versions.node, "include", "node");
  if (!existsSync(includeDir)) {
    throw new Error(`Missing Node headers at ${includeDir}. Run "pnpm install" or "node-gyp install" first.`);
  }
  return includeDir;
}

const nodeAddonApiInclude = resolveNodeAddonApiInclude();
const nodeHeadersInclude = resolveNodeHeadersInclude();

function run(command, args) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  });
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function getSdkPath() {
  return execFileSync("xcrun", ["--sdk", "macosx", "--show-sdk-path"], {
    cwd: rootDir,
    encoding: "utf8"
  }).trim();
}

function copyDist(targetDir) {
  const distDir = path.join(rootDir, "dist");
  if (existsSync(distDir)) {
    cpSync(distDir, path.join(targetDir, "dist"), { recursive: true });
  }
}

function stripMacBinary(filePath) {
  run("strip", ["-x", filePath]);
}

function buildTypescript() {
  run("pnpm", ["run", "build:ts"]);
}

function buildMacArch(arch, sdkPath) {
  const outDir = path.join(artifactsDir, `macos-${arch}`);
  const outFile = path.join(outDir, "spdog.node");
  const minVersion = "11.0";
  const archFlag = arch === "arm64" ? "arm64" : "x86_64";

  cleanDir(outDir);

  run("clang++", [
    "-bundle",
    "-std=c++20",
    "-fPIC",
    "-O3",
    "-fvisibility=hidden",
    "-fvisibility-inlines-hidden",
    "-fno-rtti",
    "-DNAPI_CPP_EXCEPTIONS",
    "-DSPDLOG_ACTIVE_LEVEL=SPDLOG_LEVEL_TRACE",
    "-DBUILDING_NODE_EXTENSION",
    "-I",
    nodeAddonApiInclude,
    "-I",
    path.join(rootDir, "src"),
    "-I",
    path.join(rootDir, "spdlog/include"),
    "-I",
    nodeHeadersInclude,
    "-mmacosx-version-min=" + minVersion,
    "-arch",
    archFlag,
    "-isysroot",
    sdkPath,
    "-undefined",
    "dynamic_lookup",
    "-Wl,-dead_strip",
    "-Wl,-dead_strip_dylibs",
    "-Wl,-x",
    "-o",
    outFile,
    ...sourceFiles
  ]);

  stripMacBinary(outFile);
  copyDist(outDir);
}

function buildMacUniversal() {
  const armFile = path.join(artifactsDir, "macos-arm64", "spdog.node");
  const x64File = path.join(artifactsDir, "macos-x64", "spdog.node");
  const outDir = path.join(artifactsDir, "macos-universal");
  const outFile = path.join(outDir, "spdog.node");

  if (!existsSync(armFile) || !existsSync(x64File)) {
    return false;
  }

  cleanDir(outDir);
  run("lipo", ["-create", "-output", outFile, armFile, x64File]);
  stripMacBinary(outFile);
  copyDist(outDir);
  return true;
}

function getDirectorySize(dirPath) {
  if (!existsSync(dirPath)) {
    return 0;
  }

  let total = 0;
  for (const entry of readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    const stats = statSync(fullPath);
    total += stats.isDirectory() ? getDirectorySize(fullPath) : stats.size;
  }
  return total;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function main() {
  cleanDir(artifactsDir);
  buildTypescript();

  const sdkPath = getSdkPath();
  buildMacArch("arm64", sdkPath);
  buildMacArch("x64", sdkPath);
  const universalBuilt = buildMacUniversal();

  const summary = [
    ["macos-arm64", getDirectorySize(path.join(artifactsDir, "macos-arm64"))],
    ["macos-x64", getDirectorySize(path.join(artifactsDir, "macos-x64"))]
  ];

  if (universalBuilt) {
    summary.push(["macos-universal", getDirectorySize(path.join(artifactsDir, "macos-universal"))]);
  }

  for (const [name, size] of summary) {
    console.log(`${name}: ${formatBytes(size)}`);
  }
}

main();
