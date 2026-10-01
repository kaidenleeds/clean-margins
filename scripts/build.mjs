import { rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { force: true, recursive: true });
await build({
  bundle: true,
  entryPoints: ["src/worker.js"],
  format: "esm",
  legalComments: "none",
  minify: true,
  outfile: "dist/worker.js",
  platform: "browser",
  sourcemap: true,
  target: "es2022",
});

console.log("Built dist/worker.js");

