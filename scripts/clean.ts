const { rmSync } = require("node:fs") as typeof import("node:fs");

for (const dir of ["build", "dist", "artifacts"] as const) {
  rmSync(dir, { recursive: true, force: true });
}
