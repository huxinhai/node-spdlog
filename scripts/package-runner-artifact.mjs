import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts");
const releaseNodePath = path.join(rootDir, "build", "Release", "spdog.node");
const distDir = path.join(rootDir, "dist");

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function currentArch() {
  if (process.arch === "x64") {
    return "x64";
  }
  if (process.arch === "arm64") {
    return "arm64";
  }
  return process.arch;
}

function currentPlatform() {
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

function artifactLabel() {
  if (process.env.ARTIFACT_LABEL && process.env.ARTIFACT_LABEL.trim()) {
    return process.env.ARTIFACT_LABEL.trim();
  }

  return `${currentPlatform()}-${currentArch()}`;
}

function stripIfMac(filePath) {
  if (process.platform === "darwin") {
    execFileSync("strip", ["-x", filePath], { cwd: rootDir, stdio: "inherit" });
  }
}

function compressIfWindows(filePath) {
  if (process.platform === "win32") {
    execFileSync("upx", ["--best", "--lzma", filePath], { cwd: rootDir, stdio: "inherit" });
  }
}

function main() {
  const targetDir = path.join(artifactsDir, artifactLabel());
  cleanDir(targetDir);

  if (!existsSync(releaseNodePath)) {
    throw new Error(`Missing native module at ${releaseNodePath}. Run pnpm build first.`);
  }

  copyFileSync(releaseNodePath, path.join(targetDir, "spdog.node"));
  stripIfMac(path.join(targetDir, "spdog.node"));
  compressIfWindows(path.join(targetDir, "spdog.node"));

  if (existsSync(distDir)) {
    cpSync(distDir, path.join(targetDir, "dist"), { recursive: true });
  }

  console.log(`packaged ${path.relative(rootDir, targetDir)} on ${os.platform()} ${os.arch()}`);
}

main();
