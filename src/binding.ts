import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type { NativeBinding } from "./type.js";

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));

function candidateBindingPaths(): string[] {
  const platform =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "windows"
        : process.platform === "linux"
          ? "linux"
          : process.platform;
  const artifactLabel = `${platform}-${process.arch}`;
  const artifactPaths = [
    path.join(dirname, "..", "artifacts", artifactLabel, "spdog.node")
  ];

  if (process.platform === "darwin") {
    artifactPaths.push(
      path.join(dirname, "..", "artifacts", "macos-universal", "spdog.node")
    );
  }

  return [
    ...artifactPaths,
    path.join(dirname, "..", "spdog.node"),
    path.join(dirname, "..", "build", "Release", "spdog.node")
  ];
}

export function loadBinding(): NativeBinding {
  const attempted: string[] = [];

  for (const bindingPath of candidateBindingPaths()) {
    if (!fs.existsSync(bindingPath)) {
      attempted.push(`${bindingPath} (missing)`);
      continue;
    }

    try {
      return require(bindingPath) as NativeBinding;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      attempted.push(`${bindingPath} (${details})`);
    }
  }

  throw new Error(
    `Failed to load native addon. Checked:\n${attempted.join("\n")}\nInstall a supported prebuilt package or run "pnpm build" first.`
  );
}
