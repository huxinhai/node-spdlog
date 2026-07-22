import type { NativeBinding } from "../src/type.js";

const spdlog = (await import("../dist/index.js")) as NativeBinding;

spdlog.setPattern("[%H:%M:%S] [%^%l%$] %v");
spdlog.setLevel("trace");

spdlog.info("hello from spdlog + node-addon-api");
spdlog.debug(`using spdlog ${spdlog.version.major}.${spdlog.version.minor}.${spdlog.version.patch}`);

spdlog.useBasicFileLogger("demo-file", "example.log", true);
spdlog.info("this line is written into example.log");
spdlog.flush();

spdlog.useConsoleLogger();
spdlog.warn("switched back to the console logger");
