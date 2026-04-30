# spdog

`spdog` is a Node.js native addon built with `node-addon-api` and backed by [`spdlog`](https://github.com/gabime/spdlog).

`spdlog` is included as a git submodule at the repository root:

```bash
git clone --recursive <your-repo-url>
```

If you already cloned the repository without submodules:

```bash
git submodule update --init --recursive
```

## Stack

- `pnpm`
- `TypeScript`
- `node-addon-api`
- `spdlog`
- C++20

## Local Development

Install dependencies:

```bash
pnpm install
```

Build the addon and TypeScript output:

```bash
pnpm build
```

Run the local runtime verification:

```bash
pnpm run verify:runtime
```

Run the example:

```bash
pnpm example
```

## Project Layout

- `src/*.cpp` and `src/*.h`: native addon sources
- `src/index.ts`: public TypeScript entry
- `src/type.d.ts`: public type declarations
- `examples/example.js`: example usage
- `scripts/verify-runtime.mjs`: runtime smoke test
- `scripts/package-runner-artifact.mjs`: package current runner output
- `.github/workflows/build.yml`: CI build and package workflow
- `.github/workflows/release.yml`: tag-triggered release workflow

## Runtime API

Example:

```ts
import spdog from "./dist/index.js";

spdog.setLevel("trace");
spdog.setPattern("[%H:%M:%S] [%^%l%$] %v");
spdog.info("hello from spdog");
```

Available APIs:

- `log(level, message)`
- `trace(message)`
- `debug(message)`
- `info(message)`
- `warn(message)`
- `error(message)`
- `critical(message)`
- `setLevel(level)`
- `setFlushOn(level)`
- `setPattern(pattern)`
- `useConsoleLogger()`
- `useBasicFileLogger(name, filePath, truncate?)`
- `flush()`
- `version`

## GitHub Actions

### CI

[`build.yml`](.github/workflows/build.yml) runs on:

- push to `main`
- pull requests
- manual dispatch

It verifies and packages on:

- `macos-15-intel` as `macos-x64`
- `macos-14` as `macos-arm64`
- `windows-latest` as `windows-x64`

Each run will:

1. Checkout the repository with submodules
2. Install dependencies with `pnpm`
3. Run `pnpm build`
4. Run `pnpm run verify:runtime`
5. Upload packaged artifacts

### Release

[`release.yml`](.github/workflows/release.yml) runs when you push a tag like:

```bash
git tag v0.1.0
git push origin v0.1.0
```

It will:

1. Build on `macos-x64`, `macos-arm64`, and `windows-x64`
2. Verify runtime on each runner
3. Package `spdog.node` plus `dist/`
4. Create a GitHub Release
5. Upload zip files such as:

- `spdog-v0.1.0-macos-x64.zip`
- `spdog-v0.1.0-macos-arm64.zip`
- `spdog-v0.1.0-windows-x64.zip`

## Packaging

Package the current runner output into `artifacts/<platform-arch>/`:

```bash
pnpm run package:runner
```

Override the output label:

```bash
ARTIFACT_LABEL=macos-x64 pnpm run package:runner
```

Build locally optimized macOS artifacts:

```bash
pnpm run build:artifacts
```

## Notes

- Native module output name is `spdog.node`
- macOS packaging strips symbols to reduce binary size
- Windows packaging uses `upx --best --lzma`
- `build/`, `dist/`, and `artifacts/` are generated outputs
