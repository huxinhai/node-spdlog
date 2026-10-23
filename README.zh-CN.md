# node-spdlog

[English](https://github.com/huxinhai/node-spdlog/blob/main/README.md)

`node-spdlog` 是一个基于 [`spdlog`](https://github.com/gabime/spdlog) 的 Node.js 原生 addon。它提供一组小而直接的 ESM 日志 API，支持控制台日志、基础文件日志、日志级别、flush 行为、输出 pattern，以及读取内置 `spdlog` 版本。

这个包自带 TypeScript 类型声明，并为支持的平台提供预构建原生二进制文件。

## 安装

```bash
npm install node-spdlog
```

也可以使用其他包管理器：

```bash
pnpm add node-spdlog
yarn add node-spdlog
bun add node-spdlog
```

需要 Node.js `22.18.0` 或更新版本。

## 快速开始

```ts
import spdog from "node-spdlog";

spdog.info("hello from node-spdlog");
spdog.warn("something needs attention");
spdog.error("something failed");
```

也可以使用命名导入：

```ts
import { info, setLevel, setPattern } from "node-spdlog";

setLevel("debug");
setPattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v");

info("logger is ready");
```

## 文件日志

使用 `useBasicFileLogger()` 可以把日志写入文件。缺失的父目录会自动创建。

```ts
import spdog from "node-spdlog";

spdog.useBasicFileLogger("app-file", "logs/app.log");

spdog.info("this line is written to logs/app.log");
spdog.flush();

spdog.useConsoleLogger();
spdog.info("logging is back on the console");
```

第三个参数传 `true` 时，会在创建 logger 时清空目标文件：

```ts
spdog.useBasicFileLogger("app-file", "logs/app.log", true);
```

## 异步日志

默认同步写日志。切换到异步 logger 后，日志会由后台线程写入：

```ts
import spdog from "node-spdlog";

spdog.useAsyncBasicFileLogger("app-file", "logs/app.log");
spdog.info("queued for the background thread"); // 返回 void，无需 await。
spdog.flush(); // 阻塞等待此前的日志写入并 flush。

spdog.useAsyncConsoleLogger();
spdog.info("asynchronous console logging");
```

异步 logger 使用一个后台线程和容量为 8192 条的 FIFO 队列。队列满时，调用线程会阻塞等待空位，避免丢失日志。`setFlushOn()` 触发的自动 flush 在后台线程执行。

`flush()` 会阻塞等待此前的日志写入，并调用 `fflush`，不会调用 `fsync`，因此不保证数据已持久化到存储设备。切换 logger 和最后一个使用该模块的 Node.js environment 正常退出时，会等待队列处理完成并 flush。强制终止进程可能丢失排队中的日志。

`setPattern()`、`setLevel()` 和 `setFlushOn()` 对当前和之后创建的 logger 都生效。同一进程中的 worker 线程共用当前 logger 及其设置。

## 日志级别

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

| API | 说明 |
| --- | --- |
| `version` | 内置 `spdlog` 版本，格式为 `{ major, minor, patch }`。 |
| `log(level, message)` | 使用指定日志级别输出消息。 |
| `trace(message)` / `debug(message)` / `info(message)` / `warn(message)` / `error(message)` / `critical(message)` | 各日志级别的快捷方法。 |
| `setLevel(level)` | 设置当前和之后新 logger 的最低启用日志级别。 |
| `setFlushOn(level)` | 设置当前和之后新 logger 达到该级别或更高级别时自动 flush。 |
| `setPattern(pattern)` | 设置当前 logger 和之后新 logger 的 `spdlog` 输出 pattern。 |
| `useConsoleLogger()` | 切换到同步控制台 logger。 |
| `useBasicFileLogger(name, filePath, truncate?)` | 切换到同步基础文件 logger。`truncate` 默认是 `false`；传 `null` 时也使用追加模式。 |
| `useAsyncConsoleLogger()` | 切换到异步控制台 logger。 |
| `useAsyncBasicFileLogger(name, filePath, truncate?)` | 切换到异步基础文件 logger。`truncate` 默认是 `false`；传 `null` 时也使用追加模式。 |
| `flush()` | flush 当前 logger；异步模式下会阻塞等待此前的日志写入。 |

## TypeScript

类型声明已经随包提供，不需要额外安装 `@types/*` 包。

```ts
import spdog, { type LogLevel, type SpdlogVersion } from "node-spdlog";

const level: LogLevel = "info";
const version: SpdlogVersion = spdog.version;

spdog.log(level, `spdlog ${version.major}.${version.minor}.${version.patch}`);
```

## 支持平台

发布包包含以下平台的预构建原生二进制：

- macOS arm64
- macOS x64
- Linux arm64
- Linux x64
- Windows x64

在支持的平台上，安装时通常不需要本地编译器。如果没有匹配的预构建二进制，包会回退到使用 `node-gyp` 从源码构建；这个回退路径需要当前平台可用的 C++20 工具链。

## 备注

- 这个包只支持 ESM。请使用 `import`，不要使用 `require()`。
- 包名是 `node-spdlog`。
- 原生模块文件名是 `spdog.node`。
- Linux 预构建二进制会在压缩后验证可用时进行 strip 和压缩。

## 协议

MIT
