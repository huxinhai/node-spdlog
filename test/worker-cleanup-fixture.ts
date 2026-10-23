import { Worker, isMainThread, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

import type { NativeBinding } from "../src/type.js";

const expectedMessage = "worker cleanup hook message";
const filename = fileURLToPath(import.meta.url);

type CleanupWorkerData = {
  filePath: string;
  async: boolean;
  burst: number;
  switches: number;
  workerId: number;
  concurrent: boolean;
};

async function writeMessages(data: CleanupWorkerData): Promise<void> {
  const spdog = (await import("../dist/index.js")) as NativeBinding;
  spdog.setPattern("%v");

  for (let switchId = 0; switchId < data.switches; switchId += 1) {
    const async = data.async && (!data.concurrent || switchId % 2 === 0);
    if (async) {
      spdog.useAsyncBasicFileLogger("cleanup-worker", data.filePath);
    } else {
      spdog.useBasicFileLogger("cleanup-worker", data.filePath);
    }

    for (let index = 0; index < data.burst; index += 1) {
      spdog.info(`${expectedMessage} ${data.workerId}:${switchId}:${index}`);
    }
  }
}

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
    const concurrent = process.env.SPDOG_TEST_MODE === "concurrent";
    const data: CleanupWorkerData = {
      filePath,
      async: process.env.SPDOG_TEST_ASYNC === "1",
      burst: Number(process.env.SPDOG_TEST_BURST ?? "1"),
      switches: Number(process.env.SPDOG_TEST_SWITCHES ?? "1"),
      workerId: 0,
      concurrent
    };

    if (process.env.SPDOG_TEST_MODE === "main") {
      await writeMessages(data);
    } else {
      const workerCount = concurrent ? Number(process.env.SPDOG_TEST_WORKERS ?? "4") : 1;
      for (let workerId = 0; workerId < workerCount; workerId += 1) {
        const worker = new Worker(filename, {
          workerData: {
            ...data,
            filePath: concurrent ? `${filePath}.${workerId}` : filePath,
            workerId
          } satisfies CleanupWorkerData
        });

        worker.once("error", fail);
        worker.once("exit", (code: number) => {
          if (code !== 0) {
            fail(new Error(`worker exited with code ${code}`));
          }
        });
      }
    }
  }
} else {
  const data = workerData as CleanupWorkerData;
  await writeMessages(data);
}
