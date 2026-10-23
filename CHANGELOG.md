# Changelog

## 0.1.6 - 2026-10-23

- Add `useAsyncBasicFileLogger()` and `useAsyncConsoleLogger()` with a bounded background queue that waits for space instead of dropping logs.
- Keep `flush()` synchronous in async mode, and drain queued logs before switching loggers or shutting down the last Node.js environment.
- Preserve queued messages' output patterns when changing configuration, and add documentation and regression tests for async logging and worker cleanup.
- Allow switching away from an async logger whose output device fails to flush, while keeping explicit `flush()` errors observable.
