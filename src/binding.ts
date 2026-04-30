import path from "node:path";

import type { NativeBinding } from "./type";

const bindingPath = path.join(__dirname, "..", "build", "Release", "spdog.node");

export function loadBinding(): NativeBinding {
  try {
    return require(bindingPath) as NativeBinding;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load native addon at ${bindingPath}. Run "pnpm build" first.\n${details}`
    );
  }
}
