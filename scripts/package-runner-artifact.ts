import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts");
const releaseNodePath = path.join(rootDir, "build", "Release", "spdog.node");
const distDir = path.join(rootDir, "dist");

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath: string): void {
  rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function currentArch(): string {
  if (process.arch === "x64") {
    return "x64";
  }
  if (process.arch === "arm64") {
    return "arm64";
  }
  return process.arch;
}

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

function artifactLabel(): string {
  if (process.env.ARTIFACT_LABEL && process.env.ARTIFACT_LABEL.trim()) {
    return process.env.ARTIFACT_LABEL.trim();
  }

  return `${currentPlatform()}-${currentArch()}`;
}

function stripIfMac(filePath: string): void {
  if (process.platform === "darwin") {
    execFileSync("strip", ["-x", filePath], { cwd: rootDir, stdio: "inherit" });
  }
}

function compressIfWindows(filePath: string): void {
  if (process.platform === "win32") {
    execFileSync("upx", ["--best", "--lzma", filePath], { cwd: rootDir, stdio: "inherit" });
  }
}

function main(): void {
  const targetDir = path.join(artifactsDir, artifactLabel());
  cleanDir(targetDir);

  if (!existsSync(releaseNodePath)) {
    throw new Error(`Missing native module at ${releaseNodePath}. Run pnpm build first.`);
  }

  const targetNodePath = path.join(targetDir, "spdog.node");
  copyFileSync(releaseNodePath, targetNodePath);
  stripIfMac(targetNodePath);
  compressIfWindows(targetNodePath);

  if (existsSync(distDir)) {
    cpSync(distDir, path.join(targetDir, "dist"), { recursive: true });
  }

  console.log(`packaged ${path.relative(rootDir, targetDir)} on ${os.platform()} ${os.arch()}`);
}

main();
