const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads");

if (!isMainThread) {
  const spdog = require("../dist");

  try {
    for (let index = 0; index < workerData.iterations; index += 1) {
      if (index % 3 === 0) {
        spdog.useConsoleLogger();
      } else {
        spdog.useBasicFileLogger(workerData.loggerName, workerData.filePath, index === 1);
      }

      spdog.info(`worker ${workerData.id} iteration ${index}`);
    }

    spdog.flush();
    parentPort.postMessage({ ok: true });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    });
  }
} else {
  const spdog = require("../dist");

  function withTempDir(run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spdog-test-"));
    let result;

    try {
      result = run(tempDir);
    } catch (error) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }

    if (result && typeof result.then === "function") {
      return result.finally(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return result;
  }

  function runWorker(id, filePath, iterations) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        callback(value);
      };

      const worker = new Worker(__filename, {
        workerData: {
          id,
          filePath,
          iterations,
          loggerName: `worker-${id}`
        }
      });

      worker.once("message", (message) => {
        if (message && message.ok) {
          finish(resolve);
          return;
        }

        finish(reject, new Error(message && message.error ? message.error : `worker ${id} failed`));
      });

      worker.once("error", (error) => finish(reject, error));
      worker.once("exit", (code) => {
        if (code !== 0) {
          finish(reject, new Error(`worker ${id} exited with code ${code}`));
        }
      });
    });
  }

  test("useBasicFileLogger keeps previous logger active when new file logger creation fails", () => {
    withTempDir((tempDir) => {
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
    });
  });

  test("optional boolean accepts null and preserves append mode default", () => {
    withTempDir((tempDir) => {
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
    });
  });

  test("invalid log levels list supported values", () => {
    assert.throws(
      () => spdog.setLevel("verbose"),
      /Supported levels: trace, debug, info, warn, error, critical, off/
    );
  });

  test("worker threads can switch loggers concurrently without crashing", async () => {
    await withTempDir(async (tempDir) => {
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
    });
  });

  test("worker environment cleanup flushes and releases the last logger", () => {
    withTempDir((tempDir) => {
      const filePath = path.join(tempDir, "worker-cleanup.log");

      execFileSync(process.execPath, [path.join(__dirname, "worker-cleanup-fixture.js")], {
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
