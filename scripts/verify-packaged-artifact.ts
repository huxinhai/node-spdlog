import type { NativeBinding } from "../src/type.js";

import path from "node:path";

const label = process.env.ARTIFACT_LABEL?.trim();
if (!label) {
  throw new Error("ARTIFACT_LABEL is required");
}

const artifactDist = path.join("..", "artifacts", label, "dist");
const spdog = (await import(artifactDist)) as NativeBinding;

spdog.info("packaged artifact verification ok");
console.log(JSON.stringify(spdog.version));
