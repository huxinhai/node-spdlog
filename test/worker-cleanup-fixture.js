const fs = require("node:fs");
const { Worker, isMainThread, workerData } = require("node:worker_threads");

const expectedMessage = "worker cleanup hook message";

function fail(error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

if (isMainThread) {
  const filePath = process.env.SPDOG_TEST_FILE;

  if (!filePath) {
    fail(new Error("SPDOG_TEST_FILE is required"));
  } else {
    const worker = new Worker(__filename, {
      workerData: { filePath }
    });

    worker.once("error", fail);
    worker.once("exit", (code) => {
      if (code !== 0) {
        fail(new Error(`worker exited with code ${code}`));
        return;
      }
    });
  }
} else {
  const spdog = require("../dist");

  spdog.useBasicFileLogger("cleanup-worker", workerData.filePath, true);
  spdog.info(expectedMessage);
}
