import type { NativeBinding } from "../src/type";

const path = require("node:path") as typeof import("node:path");

const label = process.env.ARTIFACT_LABEL?.trim();
if (!label) {
  throw new Error("ARTIFACT_LABEL is required");
}

const artifactDist = path.join("..", "artifacts", label, "dist");
const spdog = require(artifactDist) as NativeBinding;

spdog.info("packaged artifact verification ok");
console.log(JSON.stringify(spdog.version));
