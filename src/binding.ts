import path from "node:path";
import fs from "node:fs";

import type { NativeBinding } from "./type";

function candidateBindingPaths(): string[] {
  return [
    path.join(__dirname, "..", "spdog.node"),
    path.join(__dirname, "..", "build", "Release", "spdog.node")
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
    `Failed to load native addon. Checked:\n${attempted.join("\n")}\nRun "pnpm build" first.`
  );
}
