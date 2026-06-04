const { copyFileSync, mkdirSync } = require("node:fs") as typeof import("node:fs");

mkdirSync("dist", { recursive: true });
copyFileSync("src/type.d.ts", "dist/type.d.ts");
