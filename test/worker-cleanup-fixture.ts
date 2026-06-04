import type { NativeBinding } from "../src/type";

const { Worker, isMainThread, workerData } =
  require("node:worker_threads") as typeof import("node:worker_threads");

const expectedMessage = "worker cleanup hook message";

type CleanupWorkerData = {
  filePath: string;
};

function fail(error: unknown): void {
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
      workerData: { filePath } satisfies CleanupWorkerData
    });

    worker.once("error", fail);
    worker.once("exit", (code: number) => {
      if (code !== 0) {
        fail(new Error(`worker exited with code ${code}`));
        return;
      }
    });
  }
} else {
  const spdog = require("../dist") as NativeBinding;
  const data = workerData as CleanupWorkerData;

  spdog.useBasicFileLogger("cleanup-worker", data.filePath, true);
  spdog.info(expectedMessage);
}
