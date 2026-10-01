import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const localPython = process.platform === "win32"
  ? ".venv/Scripts/python.exe"
  : ".venv/bin/python";
const candidates = [
  localPython,
  ...(process.platform === "win32" ? ["python"] : ["python3", "python"]),
];

async function run(executable) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { stdio: "inherit" });
    child.once("error", (error) => resolve({ error }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

let found = false;
for (const executable of candidates) {
  if (executable.includes("/") && !existsSync(executable)) continue;
  const result = await run(executable);
  if (result.error?.code === "ENOENT") continue;
  if (result.error) throw result.error;
  found = true;
  if (result.signal) {
    console.error(`Python stopped after receiving ${result.signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.code ?? 1;
  }
  break;
}

if (!found) {
  console.error("Python 3 was not found. Install Python 3.11 or newer, then try again.");
  process.exitCode = 1;
}
