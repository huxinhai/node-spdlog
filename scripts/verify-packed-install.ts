import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type PackResult = {
  filename: string;
};

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const packOutput = execFileSync(npmBin, ["pack", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
});
const [packResult] = JSON.parse(packOutput) as PackResult[];
if (!packResult?.filename) {
  throw new Error("npm pack did not return a package filename");
}

const tarballPath = path.resolve(packResult.filename);
const tempDir = mkdtempSync(path.join(tmpdir(), "node-spdlog-packed-install-"));

try {
  writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }));
  execFileSync(npmBin, ["install", tarballPath], {
    cwd: tempDir,
    stdio: "inherit"
  });
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import assert from "node:assert/strict";
       import { readFileSync } from "node:fs";
       import spdog, { useAsyncBasicFileLogger, useAsyncConsoleLogger } from "node-spdlog";
       console.log(JSON.stringify(spdog.version));
       spdog.info("packed npm install verification ok");
       spdog.setPattern("%v");
       assert.equal(useAsyncBasicFileLogger, spdog.useAsyncBasicFileLogger);
       assert.equal(useAsyncConsoleLogger, spdog.useAsyncConsoleLogger);
       useAsyncBasicFileLogger("packed-async-file", "async.log", true);
       spdog.info("async packed npm install verification ok");
       spdog.flush();
       assert.equal(readFileSync("async.log", "utf8").trimEnd(), "async packed npm install verification ok");
       useAsyncConsoleLogger();
       spdog.info("async packed console verification ok");
       spdog.flush();
       spdog.useConsoleLogger();`
    ],
    {
      cwd: tempDir,
      timeout: 30_000,
      stdio: "inherit"
    }
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
