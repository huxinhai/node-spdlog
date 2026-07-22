import type { NativeBinding } from "../src/type.js";

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
console.log(JSON.stringify(spdog.version));
