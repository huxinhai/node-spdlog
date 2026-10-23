import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import type { NativeBinding } from "../src/type.js";
import spdogBinding from "../dist/index.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

type RuntimeWorkerData = {
  id: number;
  filePath: string;
  iterations: number;
  loggerName: string;
};

type WorkerMessage =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

function loadSpdog(): NativeBinding {
  return spdogBinding as NativeBinding;
}

if (!isMainThread) {
  const spdog = loadSpdog();
  const data = workerData as RuntimeWorkerData;
  const port = parentPort;

  if (!port) {
    throw new Error("worker parentPort is missing");
  }

  try {
    for (let index = 0; index < data.iterations; index += 1) {
      if (index % 3 === 0) {
        spdog.useConsoleLogger();
      } else {
        spdog.useBasicFileLogger(data.loggerName, data.filePath, index === 1);
      }

      spdog.info(`worker ${data.id} iteration ${index}`);
    }

    spdog.flush();
    port.postMessage({ ok: true } satisfies WorkerMessage);
  } catch (error) {
    port.postMessage({
      ok: false,
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    } satisfies WorkerMessage);
  }
} else {
  const spdog = loadSpdog();

  function readLogLines(filePath: string): string[] {
    const contents = fs.readFileSync(filePath, "utf8").trimEnd();
    return contents === "" ? [] : contents.split(/\r?\n/);
  }

  function resetLogger(): void {
    spdog.useConsoleLogger();
    spdog.setPattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] %v");
    spdog.setLevel("info");
    spdog.setFlushOn("off");
  }

  function withTempDir<T>(run: (tempDir: string) => Promise<T>): Promise<T>;
  function withTempDir<T>(run: (tempDir: string) => T): T;
  function withTempDir<T>(run: (tempDir: string) => T | Promise<T>): T | Promise<T> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spdog-test-"));
    let result: T | Promise<T>;

    try {
      result = run(tempDir);
    } catch (error) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }

    if (result instanceof Promise) {
      return result.finally(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return result;
  }

  function runWorker(id: number, filePath: string, iterations: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let sawSuccessMessage = false;
      let exitCode: number | null = null;

      const finishResolve = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const finishReject = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      const maybeResolve = (): void => {
        if (sawSuccessMessage && exitCode === 0) {
          finishResolve();
        }
      };

      const worker = new Worker(filename, {
        workerData: {
          id,
          filePath,
          iterations,
          loggerName: `worker-${id}`
        } satisfies RuntimeWorkerData
      });

      worker.once("message", (message: WorkerMessage) => {
        if (message.ok) {
          sawSuccessMessage = true;
          maybeResolve();
          return;
        }

        finishReject(new Error(message.error || `worker ${id} failed`));
      });

      worker.once("error", finishReject);
      worker.once("exit", (code: number) => {
        exitCode = code;
        if (code !== 0) {
          finishReject(new Error(`worker ${id} exited with code ${code}`));
          return;
        }

        maybeResolve();
      });
    });
  }

  test("useBasicFileLogger keeps previous logger active when new file logger creation fails", () => {
    withTempDir((tempDir) => {
      try {
        const validFilePath = path.join(tempDir, "valid.log");

        spdog.useConsoleLogger();
        spdog.info("console logger still works before failure");

        assert.throws(
          () => spdog.useBasicFileLogger("invalid-file-target", tempDir, true),
          /Failed opening file|system error/
        );

        spdog.useBasicFileLogger("valid-file-target", validFilePath, true);
        spdog.info("file logger works after failed switch");
        spdog.flush();

        const contents = fs.readFileSync(validFilePath, "utf8");
        assert.match(contents, /file logger works after failed switch/);
      } finally {
        spdog.useConsoleLogger();
      }
    });
  });

  test("optional boolean accepts null and preserves append mode default", () => {
    withTempDir((tempDir) => {
      try {
        const filePath = path.join(tempDir, "append.log");

        spdog.useBasicFileLogger("append-file", filePath, true);
        spdog.info("first line");
        spdog.flush();

        spdog.useBasicFileLogger("append-file", filePath, null);
        spdog.info("second line");
        spdog.flush();

        const contents = fs.readFileSync(filePath, "utf8");
        assert.match(contents, /first line/);
        assert.match(contents, /second line/);
      } finally {
        spdog.useConsoleLogger();
      }
    });
  });

  test("useBasicFileLogger supports unicode paths", () => {
    withTempDir((tempDir) => {
      try {
        const unicodeDir = path.join(tempDir, "中文用户名-陈肖剑");
        const filePath = path.join(unicodeDir, "main.log");

        spdog.useBasicFileLogger("unicode-file-target", filePath, true);
        spdog.info("unicode path logger works");
        spdog.flush();

        assert.ok(fs.existsSync(unicodeDir), "expected native logger to create unicode directory");
        const contents = fs.readFileSync(filePath, "utf8");
        assert.match(contents, /unicode path logger works/);
      } finally {
        spdog.useConsoleLogger();
      }
    });
  });

  test("invalid log levels list supported values", () => {
    assert.throws(
      () => spdog.setLevel("verbose" as never),
      /Supported levels: trace, debug, info, warn, error, critical, off/
    );
  });

  test("async logger preserves every message and its order beyond the queue capacity", () => {
    withTempDir((tempDir) => {
      try {
        const filePath = path.join(tempDir, "async-burst.log");
        const messages = Array.from({ length: 25_000 }, (_, index) => `async message ${index}`);

        spdog.setPattern("%v");
        spdog.useAsyncBasicFileLogger("async-burst", filePath, true);
        for (const message of messages) {
          spdog.info(message);
        }

        spdog.flush();
        assert.deepEqual(readLogLines(filePath), messages);
      } finally {
        resetLogger();
      }
    });
  });

  test("async optional truncate accepts null and omission as append mode", () => {
    withTempDir((tempDir) => {
      try {
        const filePath = path.join(tempDir, "async-append.log");
        spdog.setPattern("%v");
        spdog.useAsyncBasicFileLogger("async-append", filePath, true);
        spdog.info("first line");
        spdog.useAsyncBasicFileLogger("async-append", filePath, null);
        spdog.info("second line");
        spdog.useAsyncBasicFileLogger("async-append", filePath);
        spdog.info("third line");
        spdog.flush();

        assert.deepEqual(readLogLines(filePath), ["first line", "second line", "third line"]);
      } finally {
        resetLogger();
      }
    });
  });

  test("changing the async pattern keeps queued messages on their original pattern", () => {
    withTempDir((tempDir) => {
      try {
        const filePath = path.join(tempDir, "async-pattern-change.log");
        const before = Array.from({ length: 12_000 }, (_, index) => `before:message ${index}`);
        spdog.setPattern("before:%v");
        spdog.useAsyncBasicFileLogger("async-pattern-change", filePath, true);
        for (let index = 0; index < before.length; index += 1) {
          spdog.info(`message ${index}`);
        }

        spdog.setPattern("after:%v");
        spdog.info("new pattern");
        spdog.flush();

        assert.deepEqual(readLogLines(filePath), [...before, "after:new pattern"]);
      } finally {
        resetLogger();
      }
    });
  });

  test("failed async file logger switch preserves the previous async logger", () => {
    withTempDir((tempDir) => {
      try {
        const filePath = path.join(tempDir, "async-valid.log");
        spdog.setPattern("%v");
        spdog.useAsyncBasicFileLogger("async-valid", filePath, true);
        spdog.info("before failed switch");

        assert.throws(
          () => spdog.useAsyncBasicFileLogger("async-invalid", tempDir, true),
          /Failed opening file|system error/
        );

        spdog.info("after failed switch");
        spdog.flush();
        assert.deepEqual(readLogLines(filePath), ["before failed switch", "after failed switch"]);
      } finally {
        resetLogger();
      }
    });
  });

  test("async flush failures allow switching to a working logger", {
    skip: process.platform !== "linux" && "/dev/full regression requires Linux"
  }, () => {
    withTempDir((tempDir) => {
      execFileSync(process.execPath, ["--input-type=module", "--eval", `
        import assert from "node:assert/strict";
        import { readFileSync } from "node:fs";
        import spdog from "./dist/index.js";

        spdog.setPattern("%v");
        spdog.setFlushOn("off");

        spdog.useAsyncBasicFileLogger("full-before-console", "/dev/full");
        spdog.info("buffered message before console recovery");
        assert.doesNotThrow(() => spdog.useConsoleLogger());

        for (const mode of ["sync", "async"]) {
          spdog.useAsyncBasicFileLogger("full-before-file", "/dev/full");
          spdog.info("buffered message before file recovery");
          const filePath = process.env.SPDOG_TEST_FILE + "." + mode;
          assert.doesNotThrow(() => {
            if (mode === "sync") {
              spdog.useBasicFileLogger("recovered-file", filePath, true);
            } else {
              spdog.useAsyncBasicFileLogger("recovered-file", filePath, true);
            }
          });
          spdog.info("recovered " + mode + " file");
          spdog.flush();
          assert.equal(readFileSync(filePath, "utf8").trim(), "recovered " + mode + " file");
        }

        spdog.useAsyncBasicFileLogger("full-explicit-flush", "/dev/full");
        spdog.info("buffered message before explicit flush");
        assert.throws(() => spdog.flush(), /Failed flush/);
        spdog.useConsoleLogger();
      `], {
        cwd: path.join(dirname, ".."),
        env: {
          ...process.env,
          SPDOG_TEST_FILE: path.join(tempDir, "recovered.log")
        },
        timeout: 30_000,
        stdio: "pipe"
      });
    });
  });

  test("switching async file logger drains before truncating the same path", () => {
    withTempDir((tempDir) => {
      try {
        const filePath = path.join(tempDir, "same-path.log");
        spdog.setPattern("%v");

        for (const nextMode of ["sync", "async"] as const) {
          spdog.useAsyncBasicFileLogger("before-truncate", filePath, true);
          for (let index = 0; index < 12_000; index += 1) {
            spdog.info(`discarded before ${nextMode} ${index}`);
          }

          if (nextMode === "sync") {
            spdog.useBasicFileLogger("after-truncate", filePath, true);
          } else {
            spdog.useAsyncBasicFileLogger("after-truncate", filePath, true);
          }
          spdog.info(`retained after ${nextMode}`);
          spdog.flush();

          assert.deepEqual(readLogLines(filePath), [`retained after ${nextMode}`]);
        }
      } finally {
        resetLogger();
      }
    });
  });

  test("async logger inherits pattern, level, and flush threshold across logger switches", async () => {
    await withTempDir(async (tempDir) => {
      try {
        const filePath = path.join(tempDir, "async-settings.log");
        spdog.setPattern("inherited:%l:%v");
        spdog.setLevel("warn");
        spdog.setFlushOn("error");
        spdog.useAsyncConsoleLogger();
        spdog.useAsyncBasicFileLogger("async-settings", filePath, true);
        spdog.info("filtered");
        spdog.warn("buffered warning");
        spdog.error("flush trigger");

        const expected = ["inherited:warning:buffered warning", "inherited:error:flush trigger"];
        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline && readLogLines(filePath).length < expected.length) {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }

        assert.deepEqual(readLogLines(filePath), expected);
      } finally {
        resetLogger();
      }
    });
  });

  test("switching to console loggers drains the previous async file logger", () => {
    withTempDir((tempDir) => {
      try {
        spdog.setPattern("%v");
        for (const consoleMode of ["sync", "async"] as const) {
          const filePath = path.join(tempDir, `${consoleMode}-console-switch.log`);
          const messages = Array.from({ length: 10_000 }, (_, index) => `${consoleMode} message ${index}`);
          spdog.useAsyncBasicFileLogger("before-console", filePath, true);
          for (const message of messages) {
            spdog.info(message);
          }
          if (consoleMode === "sync") {
            spdog.useConsoleLogger();
          } else {
            spdog.useAsyncConsoleLogger();
          }

          assert.deepEqual(readLogLines(filePath), messages);
        }
      } finally {
        resetLogger();
      }
    });
  });

  test("worker threads can switch loggers concurrently without crashing", async () => {
    await withTempDir(async (tempDir) => {
      try {
        const workerCount = 4;
        const iterations = 200;
        const filePaths = Array.from({ length: workerCount }, (_, index) => path.join(tempDir, `worker-${index}.log`));

        await Promise.all(filePaths.map((filePath, index) => runWorker(index, filePath, iterations)));

        const totalBytes = filePaths.reduce((sum, filePath) => {
          if (!fs.existsSync(filePath)) {
            return sum;
          }
          return sum + fs.statSync(filePath).size;
        }, 0);

        assert.ok(totalBytes > 0, "expected at least one worker log file to contain data");
      } finally {
        spdog.useConsoleLogger();
      }
    });
  });

  test("worker environment cleanup flushes and releases the last logger", () => {
    withTempDir((tempDir) => {
      const filePath = path.join(tempDir, "worker-cleanup.log");

      execFileSync(process.execPath, [path.join(dirname, "worker-cleanup-fixture.ts")], {
        cwd: path.join(dirname, ".."),
        env: {
          ...process.env,
          SPDOG_TEST_FILE: filePath
        },
        timeout: 30_000,
        stdio: "pipe"
      });

      const contents = fs.readFileSync(filePath, "utf8");
      assert.match(contents, /worker cleanup hook message/);
    });
  });

  for (const mode of ["main", "worker"] as const) {
    test(`async ${mode} environment cleanup drains pending messages before process exit`, () => {
      withTempDir((tempDir) => {
        const filePath = path.join(tempDir, `async-${mode}-cleanup.log`);
        const burst = 25_000;

        execFileSync(process.execPath, [path.join(dirname, "worker-cleanup-fixture.ts")], {
          cwd: path.join(dirname, ".."),
          env: {
            ...process.env,
            SPDOG_TEST_FILE: filePath,
            SPDOG_TEST_MODE: mode,
            SPDOG_TEST_ASYNC: "1",
            SPDOG_TEST_BURST: String(burst)
          },
          timeout: 30_000,
          stdio: "pipe"
        });

        assert.deepEqual(
          readLogLines(filePath),
          Array.from({ length: burst }, (_, index) => `worker cleanup hook message 0:0:${index}`)
        );
      });
    });
  }

  test("concurrent worker logger switches and cleanup preserve every message", () => {
    withTempDir((tempDir) => {
      const filePath = path.join(tempDir, "concurrent.log");
      const workerCount = 4;
      const switches = 24;
      const burst = 400;

      execFileSync(process.execPath, [path.join(dirname, "worker-cleanup-fixture.ts")], {
        cwd: path.join(dirname, ".."),
        env: {
          ...process.env,
          SPDOG_TEST_FILE: filePath,
          SPDOG_TEST_MODE: "concurrent",
          SPDOG_TEST_ASYNC: "1",
          SPDOG_TEST_BURST: String(burst),
          SPDOG_TEST_SWITCHES: String(switches),
          SPDOG_TEST_WORKERS: String(workerCount)
        },
        timeout: 30_000,
        stdio: "pipe"
      });

      const actual = Array.from({ length: workerCount }, (_, workerId) =>
        readLogLines(`${filePath}.${workerId}`)
      ).flat();
      const expected = Array.from({ length: workerCount }, (_, workerId) =>
        Array.from({ length: switches }, (_, switchId) =>
          Array.from({ length: burst }, (_, index) => `worker cleanup hook message ${workerId}:${switchId}:${index}`)
        ).flat()
      ).flat();

      assert.equal(actual.length, expected.length);
      assert.deepEqual(actual.sort(), expected.sort());
    });
  });
}
