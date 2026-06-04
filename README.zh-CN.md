# node-spdlog

[English](./README.md)

`node-spdlog` 是一个基于 [`spdlog`](https://github.com/gabime/spdlog) 的 Node.js 原生 addon，使用 `node-addon-api` 构建。

它提供一组很小的默认 logger API：控制台日志、基础文件日志、日志级别、flush 行为、输出 pattern，以及当前捆绑的 `spdlog` 版本。包入口保持 CommonJS 并提供 TypeScript 声明；仓库里的脚本、测试和示例则是可由现代 Node.js 直接执行的 TypeScript 文件。

## 环境要求

- Node.js `22.18.0` 或更新版本
- `pnpm` `10.12.4`
- `node-gyp` 支持的 C++20 工具链
- 启用 Git submodule，因为 `spdlog/` 是以 submodule 形式放在仓库里的
- 仅 Windows 打包需要：`upx`

带 submodule 克隆：

```bash
git clone --recursive <repo-url>
```

如果已经克隆但没有拉 submodule：

```bash
git submodule update --init --recursive
```

## 快速开始

```bash
pnpm install
pnpm build
pnpm test
pnpm run verify:runtime
pnpm example
```

`pnpm build` 会把原生 addon 编译到 `build/Release/spdog.node`，并把 TypeScript 包装层输出到 `dist/`。

## 使用方式

作为包安装后：

```ts
import spdog from "node-spdlog";

spdog.setLevel("trace");
spdog.setPattern("[%H:%M:%S] [%^%l%$] %v");

spdog.info("hello from spdog");
spdog.debug(`using spdlog ${spdog.version.major}.${spdog.version.minor}.${spdog.version.patch}`);

spdog.useBasicFileLogger("app-file", "app.log", false);
spdog.warn("this line is written to app.log");
spdog.flush();

spdog.useConsoleLogger();
```

在当前仓库里本地开发时，先运行 `pnpm build`，然后从 `./dist/index.js` 引入，或者直接运行 `pnpm example`。

## API

日志级别：

```ts
"trace" | "debug" | "info" | "warn" | "error" | "critical" | "off"
```

| API | 说明 |
| --- | --- |
| `version` | 捆绑的 `spdlog` 版本，格式为 `{ major, minor, patch }`。 |
| `log(level, message)` | 使用指定级别写日志。 |
| `trace(message)` / `debug(message)` / `info(message)` / `warn(message)` / `error(message)` / `critical(message)` | 各日志级别的快捷方法。 |
| `setLevel(level)` | 设置最低启用日志级别。 |
| `setFlushOn(level)` | 设置达到该级别或更高级别时自动 flush。 |
| `setPattern(pattern)` | 设置当前 logger 和之后新 logger 的 `spdlog` 输出 pattern。 |
| `useConsoleLogger()` | 切回控制台 logger。 |
| `useBasicFileLogger(name, filePath, truncate?)` | 切换到基础文件 logger，并自动创建缺失的父目录。`truncate` 默认是 `false`；传 `null` 或 `undefined` 也使用默认值。 |
| `flush()` | flush 当前 logger。 |

## 原生模块加载方式

`dist/` 里的包装层会从两个位置加载 `spdog.node`：

1. 包根目录，这是发布/打包产物的布局。
2. `build/Release/spdog.node`，这是本地 `node-gyp rebuild` 的输出位置。

如果两个位置都加载失败，包会抛出错误，并列出所有尝试过的路径。

## TypeScript 结构

Node.js 可以直接执行仓库里的 TypeScript 脚本，所以这里不再跟踪 JavaScript 工具脚本。

- `tsconfig.json` 只做类型检查，覆盖源码、脚本、示例和测试，不生成文件。
- `tsconfig.build.json` 只把 `src/**/*.ts` 输出到 `dist/`。
- 开启了 `erasableSyntaxOnly`，确保直接执行的 TypeScript 语法能被 Node 的 type stripping 处理。
- 面向使用者的运行时产物仍然是 `dist/` 里的 JavaScript，因此包可以按普通 Node 包使用。

## 项目结构

| 路径 | 作用 |
| --- | --- |
| `src/*.cpp`, `src/*.h` | 原生 addon 实现。 |
| `src/index.ts` | 对外 TypeScript 包装层和导出。 |
| `src/binding.ts` | 原生二进制加载逻辑。 |
| `src/type.d.ts` | 对外 TypeScript API 声明。 |
| `scripts/*.ts` | 构建、清理、验证、打包辅助脚本，由 Node.js 直接运行。 |
| `examples/example.ts` | 本地使用示例。 |
| `test/*.ts` | Node test runner 测试，包括 worker 清理和并发切换 logger。 |
| `binding.gyp` | `node-gyp` 构建定义。 |
| `spdlog/` | vendored `spdlog` submodule。 |
| `build/`, `dist/`, `artifacts/` | 生成产物，已被 git 忽略。 |

## 脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm build` | 依次运行 `build:native` 和 `build:ts`。 |
| `pnpm run build:native` | 运行 `node-gyp rebuild`。 |
| `pnpm run build:ts` | 从 `src/` 生成 `dist/`，并复制 `src/type.d.ts`。 |
| `pnpm run typecheck` | 类型检查源码、脚本、示例和测试。 |
| `pnpm test` | 先运行 `typecheck`，再运行 `node --test test/runtime.test.ts`。 |
| `pnpm run verify:runtime` | 对本地 `dist/` 和原生 addon 做 smoke test。 |
| `pnpm example` | 构建项目并运行 `examples/example.ts`。 |
| `pnpm run clean` | 删除 `build/`、`dist/` 和 `artifacts/`。 |
| `pnpm run package:runner` | 把当前 runner 的构建结果打包到 `artifacts/<platform-arch>/`。 |
| `pnpm run verify:packaged` | 验证 `artifacts/$ARTIFACT_LABEL/dist`。需要设置 `ARTIFACT_LABEL`。 |
| `pnpm run build:artifacts` | 在本地构建优化过的 macOS `arm64`、`x64` 和 universal 产物。 |

打包示例：

```bash
ARTIFACT_LABEL=macos-arm64 pnpm run package:runner
ARTIFACT_LABEL=macos-arm64 pnpm run verify:packaged
```

## CI 和发布

`.github/workflows/build.yml` 会在 push 到 `main`、pull request、手动触发时运行。流程会 checkout submodule、用 `pnpm` 安装依赖、构建、测试、验证运行时行为、打包 runner artifact、验证打包产物，并上传 `artifacts/**`。

CI 矩阵：

- `macos-15-intel` 对应 `macos-x64`
- `macos-14` 对应 `macos-arm64`
- `windows-latest` 对应 `windows-x64`

`.github/workflows/release.yml` 会在 `v*` tag 或手动触发时运行。它会在同样的矩阵上构建和验证，上传 artifacts，打包成 zip，然后发布 GitHub Release。

发布 tag 示例：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 备注

- 原生模块文件名是 `spdog.node`。
- 包名是 `node-spdlog`；示例里通常把导出的 logger 对象命名为 `spdog`。
- macOS runner artifact 会用 `strip -x` 去掉符号以减小体积。
- Windows runner artifact 会用 `upx --best --lzma` 压缩。
- Unicode 文件路径已经有运行时测试覆盖。
