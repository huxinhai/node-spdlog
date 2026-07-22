import type { NativeBinding } from "../src/type.js";

const spdog = (await import("../dist/index.js")) as NativeBinding;

spdog.setPattern("[%l] %v");
spdog.setLevel("trace");
spdog.info("runtime verification ok");
spdog.useBasicFileLogger("ci-file", "ci-verify.log", true);
spdog.warn("file logger verification ok");
spdog.flush();
spdog.useConsoleLogger();

if (!spdog.version || typeof spdog.version.major !== "number") {
  throw new Error("spdog.version is missing");
}

console.log(JSON.stringify(spdog.version));
