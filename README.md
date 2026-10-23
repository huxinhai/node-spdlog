# node-spdlog

[中文文档](https://github.com/huxinhai/node-spdlog/blob/main/README.zh-CN.md)

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

## Asynchronous Logging

Logging is synchronous by default. Switch to an asynchronous logger to write on a background thread:

```ts
import spdog from "node-spdlog";

spdog.useAsyncBasicFileLogger("app-file", "logs/app.log");
spdog.info("queued for the background thread"); // Returns void; no await needed.
spdog.flush(); // Blocks until earlier logs have been written and flushed.

spdog.useAsyncConsoleLogger();
spdog.info("asynchronous console logging");
```

Asynchronous loggers use one background thread and a FIFO queue with 8192 entries. A full queue blocks the caller until space is available, so logs are not dropped. `setFlushOn()` runs automatic flushing on the background thread.

`flush()` blocks until earlier queued logs are written and calls `fflush`, not `fsync`; it does not guarantee durable storage. Switching loggers and normal teardown of the last Node.js environment using the module drain and flush pending logs. Abrupt process termination can lose queued logs.

`setPattern()`, `setLevel()`, and `setFlushOn()` apply to the current and future loggers. Worker threads in the same process share the current logger and its settings.

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
| `setLevel(level)` | Sets the minimum enabled log level for the current and future loggers. |
| `setFlushOn(level)` | Sets automatic flushing at or above the given level for the current and future loggers. |
| `setPattern(pattern)` | Sets the `spdlog` output pattern for the current and future logger. |
| `useConsoleLogger()` | Switches to a synchronous console logger. |
| `useBasicFileLogger(name, filePath, truncate?)` | Switches to a synchronous basic file logger. `truncate` defaults to `false`; `null` also keeps append mode. |
| `useAsyncConsoleLogger()` | Switches to an asynchronous console logger. |
| `useAsyncBasicFileLogger(name, filePath, truncate?)` | Switches to an asynchronous basic file logger. `truncate` defaults to `false`; `null` also keeps append mode. |
| `flush()` | Flushes the current logger; blocks until earlier queued logs are written in asynchronous mode. |

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

## License

MIT
