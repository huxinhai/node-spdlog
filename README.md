# node-spdlog

[中文文档](./README.zh-CN.md)

`node-spdlog` is a Node.js native addon backed by [`spdlog`](https://github.com/gabime/spdlog) and built with `node-addon-api`.

It exposes a small default logger API for console logging, basic file logging, log levels, flush behavior, patterns, and the bundled `spdlog` version. The npm package is ESM-only with TypeScript declarations and prebuilt native binaries for supported platforms.

## Installation

```bash
npm install node-spdlog
```

You can also install it with another package manager:

```bash
pnpm add node-spdlog
yarn add node-spdlog
bun add node-spdlog
```

The package includes TypeScript declarations. Published releases include prebuilt binaries for supported platforms, so normal installation should not require cloning this repository or running `node-gyp` yourself. If a matching binary is not available, the install script falls back to a local source build.

Runtime requirement:

- Node.js `22.18.0` or newer

## Usage

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

## Build From Source

Use this section only when developing this repository or when npm needs to compile the native addon locally.

Requirements:

- Node.js `22.18.0` or newer
- `pnpm` `10.12.4`
- A C++20 toolchain supported by `node-gyp`
- Git submodules enabled, because `spdlog/` is vendored as a submodule
- Windows packaging only: `upx`

Clone with submodules:

```bash
git clone --recursive <repo-url>
```

If the repository was cloned without submodules:

```bash
git submodule update --init --recursive
```

### Development Quick Start

```bash
pnpm install
pnpm build
pnpm test
pnpm run verify:runtime
pnpm example
```

`pnpm build` compiles the native addon to `build/Release/spdog.node` and emits the TypeScript wrapper to `dist/`.

Published packages include prebuilt binaries for supported platforms. When a matching binary is present, the install script skips `node-gyp rebuild`; otherwise it falls back to building from source.

Inside this checkout after `pnpm build`, import from `./dist/index.js` or run `pnpm example`.

## API

Log levels are:

```ts
"trace" | "debug" | "info" | "warn" | "error" | "critical" | "off"
```

| API | Description |
| --- | --- |
| `version` | Bundled `spdlog` version as `{ major, minor, patch }`. |
| `log(level, message)` | Logs with an explicit level. |
| `trace(message)` / `debug(message)` / `info(message)` / `warn(message)` / `error(message)` / `critical(message)` | Convenience level methods. |
| `setLevel(level)` | Sets the minimum enabled log level. |
| `setFlushOn(level)` | Flushes automatically at or above the given level. |
| `setPattern(pattern)` | Sets the `spdlog` output pattern for the current and future logger. |
| `useConsoleLogger()` | Switches back to the console logger. |
| `useBasicFileLogger(name, filePath, truncate?)` | Switches to a basic file logger and creates missing parent directories. `truncate` defaults to `false`; `null` and `undefined` also use the default. |
| `flush()` | Flushes the current logger. |

## How Native Loading Works

The generated wrapper in `dist/` loads `spdog.node` from:

1. `artifacts/<platform-arch>/spdog.node`, which is how published prebuilt binaries are laid out.
2. `artifacts/macos-universal/spdog.node` on macOS, as a fallback for either macOS architecture.
3. The package root, which is how single-runner packaged artifacts can be laid out.
4. `build/Release/spdog.node`, which is how local `node-gyp rebuild` outputs the addon.

If no binary can be loaded, the package throws an error that lists every attempted path.

## TypeScript Layout

Node.js can run the repository's TypeScript scripts directly, so tracked JavaScript utility files are avoided.

- `tsconfig.json` type-checks source, scripts, examples, and tests without emitting files.
- `tsconfig.build.json` emits only `src/**/*.ts` into `dist/`.
- `erasableSyntaxOnly` is enabled to keep directly executed TypeScript compatible with Node's type stripping.
- Runtime package output remains JavaScript in `dist/` so consumers can use the package normally.
- Native `.node` loading uses `createRequire(import.meta.url)` internally, which keeps the public package ESM while still loading the native addon correctly.

## Project Layout

| Path | Purpose |
| --- | --- |
| `src/*.cpp`, `src/*.h` | Native addon implementation. |
| `src/index.ts` | Public TypeScript wrapper and exports. |
| `src/binding.ts` | Native binary loader. |
| `src/type.d.ts` | Public TypeScript API declarations. |
| `scripts/*.ts` | Build, clean, verification, and packaging helpers run directly by Node.js. |
| `examples/example.ts` | Local usage example. |
| `test/*.ts` | Node test runner coverage, including worker cleanup and concurrent logger switching. |
| `binding.gyp` | `node-gyp` build definition. |
| `spdlog/` | Vendored `spdlog` submodule. |
| `build/`, `dist/`, `artifacts/` | Generated outputs; these are ignored by git. |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm build` | Runs `build:native` and `build:ts`. |
| `pnpm run build:native` | Runs `node-gyp rebuild`. |
| `pnpm run build:ts` | Emits `dist/` from `src/` and copies `src/type.d.ts`. |
| `pnpm run typecheck` | Type-checks source, scripts, examples, and tests. |
| `pnpm test` | Runs `typecheck` and `node --test test/runtime.test.ts`. |
| `pnpm run verify:runtime` | Runs a smoke test against the local `dist/` and native addon. |
| `pnpm example` | Builds the project and runs `examples/example.ts`. |
| `pnpm run clean` | Removes `build/`, `dist/`, and `artifacts/`. |
| `pnpm run package:runner` | Packages the current runner build into `artifacts/<platform-arch>/`. |
| `pnpm run verify:packaged` | Verifies `artifacts/$ARTIFACT_LABEL/dist`. Requires `ARTIFACT_LABEL`. |
| `pnpm run build:artifacts` | Builds optimized local macOS `arm64`, `x64`, and universal artifacts. |

Example package command:

```bash
ARTIFACT_LABEL=macos-arm64 pnpm run package:runner
ARTIFACT_LABEL=macos-arm64 pnpm run verify:packaged
```

## Supported Prebuilt Platforms

Published packages include prebuilt native binaries for:

- macOS x64
- macOS arm64
- Linux x64
- Linux arm64
- Windows x64

On unsupported platforms, installation falls back to `node-gyp rebuild`.

## Notes

- The native module filename is `spdog.node`.
- The package name is `node-spdlog`; the exported logger object is commonly called `spdog` in examples.
- macOS runner artifacts are stripped with `strip -x`.
- Windows runner artifacts are compressed with `upx --best --lzma`.
- Unicode file paths are covered by runtime tests.
