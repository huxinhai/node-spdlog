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
      'import spdog from "node-spdlog"; console.log(JSON.stringify(spdog.version)); spdog.info("packed npm install verification ok");'
    ],
    {
      cwd: tempDir,
      stdio: "inherit"
    }
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
