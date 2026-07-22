# node-spdlog

[中文文档](./README.zh-CN.md)

`node-spdlog` is a Node.js native addon backed by [`spdlog`](https://github.com/gabime/spdlog). It provides a small ESM logger API for console logging, basic file logging, log levels, flush behavior, output patterns, and access to the bundled `spdlog` version.

The package includes TypeScript declarations and prebuilt native binaries for supported platforms.

## Installation

```bash
npm install node-spdlog
```

With other package managers:

```bash
pnpm add node-spdlog
yarn add node-spdlog
bun add node-spdlog
```

Requires Node.js `22.18.0` or newer.

## Quick Start

```ts
import spdog from "node-spdlog";

spdog.info("hello from node-spdlog");
spdog.warn("something needs attention");
spdog.error("something failed");
```

You can also use named imports:

```ts
import { info, setLevel, setPattern } from "node-spdlog";

setLevel("debug");
setPattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v");

info("logger is ready");
```

## File Logging

Use `useBasicFileLogger()` to send logs to a file. Missing parent directories are created automatically.

```ts
import spdog from "node-spdlog";

spdog.useBasicFileLogger("app-file", "logs/app.log");

spdog.info("this line is written to logs/app.log");
spdog.flush();

spdog.useConsoleLogger();
spdog.info("logging is back on the console");
```

Pass `true` as the third argument to truncate the file when the logger is created:

```ts
spdog.useBasicFileLogger("app-file", "logs/app.log", true);
```

## Log Levels

```ts
type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "critical"
  | "off";
```

```ts
import spdog from "node-spdlog";

spdog.setLevel("debug");
spdog.debug("debug logging is enabled");

spdog.setFlushOn("warn");
spdog.warn("this warning is flushed automatically");
```

## API

| API | Description |
| --- | --- |
| `version` | Bundled `spdlog` version as `{ major, minor, patch }`. |
| `log(level, message)` | Logs with an explicit level. |
| `trace(message)` / `debug(message)` / `info(message)` / `warn(message)` / `error(message)` / `critical(message)` | Convenience level methods. |
| `setLevel(level)` | Sets the minimum enabled log level. |
| `setFlushOn(level)` | Flushes automatically at or above the given level. |
| `setPattern(pattern)` | Sets the `spdlog` output pattern for the current and future logger. |
| `useConsoleLogger()` | Switches back to the console logger. |
| `useBasicFileLogger(name, filePath, truncate?)` | Switches to a basic file logger. `truncate` defaults to `false`. |
| `flush()` | Flushes the current logger. |

## TypeScript

Types are included with the package, so no separate `@types/*` package is needed.

```ts
import spdog, { type LogLevel, type SpdlogVersion } from "node-spdlog";

const level: LogLevel = "info";
const version: SpdlogVersion = spdog.version;

spdog.log(level, `spdlog ${version.major}.${version.minor}.${version.patch}`);
```

## Supported Platforms

Published packages include prebuilt native binaries for:

- macOS arm64
- macOS x64
- Linux arm64
- Linux x64
- Windows x64

On supported platforms, installation should not require a local compiler. If no matching prebuilt binary is available, the package falls back to building from source with `node-gyp`; that fallback requires a C++20 toolchain for your platform.

## Notes

- This package is ESM-only. Use `import`, not `require()`.
- The package name is `node-spdlog`.
- The native module filename is `spdog.node`.
- Linux prebuilt binaries are stripped and compressed when the compressed binary passes verification.
