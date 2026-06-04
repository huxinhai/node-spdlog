import type { NativeBinding } from "../src/type";

const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const { execFileSync } =
  require("node:child_process") as typeof import("node:child_process");
const fs = require("node:fs") as typeof import("node:fs");
const os = require("node:os") as typeof import("node:os");
const path = require("node:path") as typeof import("node:path");
const test = require("node:test") as typeof import("node:test");
const { Worker, isMainThread, parentPort, workerData } =
  require("node:worker_threads") as typeof import("node:worker_threads");

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
  return require("../dist") as NativeBinding;
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

      const worker = new Worker(__filename, {
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
          /Failed opening file/
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

      execFileSync(process.execPath, [path.join(__dirname, "worker-cleanup-fixture.ts")], {
        cwd: path.join(__dirname, ".."),
        env: {
          ...process.env,
          SPDOG_TEST_FILE: filePath
        },
        stdio: "pipe"
      });

      const contents = fs.readFileSync(filePath, "utf8");
      assert.match(contents, /worker cleanup hook message/);
    });
  });
}
