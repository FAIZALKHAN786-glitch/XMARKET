#!/usr/bin/env node
/**
 * Cross-platform setup and launcher for the FastAPI service.
 *
 *   node scripts/py.mjs install
 *   node scripts/py.mjs dev
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const VENV_DIR = path.join(BACKEND_DIR, ".venv");
const REQUIREMENTS_FILE = path.join(BACKEND_DIR, "requirements.txt");
const VENV_PYTHON =
  process.platform === "win32"
    ? path.join(VENV_DIR, "Scripts", "python.exe")
    : path.join(VENV_DIR, "bin", "python");

// Python Launcher is the most reliable option on Windows, where `python` can
// be a Microsoft Store alias. Keep the same fallback order on other platforms.
const SYSTEM_PYTHON_CANDIDATES = [
  { command: "py", args: ["-3"] },
  { command: "python", args: [] },
  { command: "python3", args: [] },
];

let activeChild = null;
let interruptedBy = null;

function signalExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 1;
}

function handleSignal(signal) {
  if (!interruptedBy) interruptedBy = signal;

  if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
    try {
      activeChild.kill(signal);
    } catch {
      // Fall back to an unqualified kill if the platform does not support the
      // specific signal (notably some Windows versions of Node).
      try {
        activeChild.kill();
      } catch {
        // The child may have exited between the checks and kill().
      }
    }
  }
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));
if (typeof process.send === "function") {
  // dev:all uses IPC to ask this wrapper to stop; this lets it shut down the
  // Python child gracefully on Windows, where killing a Node process does not
  // reliably deliver a signal to that process's children.
  process.on("message", (message) => {
    if (message && typeof message === "object" && message.type === "shutdown") {
      handleSignal("SIGTERM");
    }
  });
}

function findSystemPython() {
  for (const candidate of SYSTEM_PYTHON_CANDIDATES) {
    const probe = spawnSync(
      candidate.command,
      [
        ...candidate.args,
        "-c",
        "import sys; raise SystemExit(0 if sys.version_info.major == 3 else 1)",
      ],
      {
        cwd: ROOT_DIR,
        stdio: "ignore",
        windowsHide: true,
      }
    );

    if (!probe.error && probe.status === 0) return candidate;
  }

  throw new Error(
    "Python 3 was not found. Install Python 3 (on Windows, enable the Python Launcher) " +
      "and verify it with `py -3 --version`."
  );
}

function runChild(command, args, description) {
  if (interruptedBy) return Promise.resolve(signalExitCode(interruptedBy));

  return new Promise((resolve) => {
    let child;
    let spawnError = null;

    try {
      child = spawn(command, args, {
        cwd: ROOT_DIR,
        stdio: "inherit",
        windowsHide: true,
      });
    } catch (error) {
      console.error(`Could not start ${description}: ${error.message}`);
      resolve(1);
      return;
    }

    activeChild = child;
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code, signal) => {
      if (activeChild === child) activeChild = null;

      if (spawnError) {
        console.error(`Could not start ${description}: ${spawnError.message}`);
        resolve(1);
        return;
      }

      if (interruptedBy) {
        resolve(signalExitCode(interruptedBy));
        return;
      }

      resolve(code ?? signalExitCode(signal));
    });
  });
}

async function createVenv() {
  const systemPython = findSystemPython();
  console.log(`Creating backend/.venv with ${systemPython.command} ${systemPython.args.join(" ")}`.trim());

  const code = await runChild(
    systemPython.command,
    [...systemPython.args, "-m", "venv", VENV_DIR],
    "Python virtual environment setup"
  );
  if (code !== 0) return code;

  if (!existsSync(VENV_PYTHON)) {
    console.error(`Python did not create the expected virtual environment at ${VENV_DIR}.`);
    return 1;
  }

  return 0;
}

async function installRequirements() {
  let code = await runChild(
    VENV_PYTHON,
    ["-m", "pip", "install", "--upgrade", "pip"],
    "pip upgrade"
  );
  if (code !== 0) return code;

  code = await runChild(
    VENV_PYTHON,
    ["-m", "pip", "install", "-r", REQUIREMENTS_FILE],
    "FastAPI requirements installation"
  );
  return code;
}

async function install() {
  if (!existsSync(VENV_PYTHON)) {
    const code = await createVenv();
    if (code !== 0) return code;
  }

  return installRequirements();
}

async function dev() {
  if (!existsSync(VENV_PYTHON)) {
    console.log("No Python virtual environment found; creating it and installing backend requirements.");
    const code = await install();
    if (code !== 0) return code;
  }

  return runChild(
    VENV_PYTHON,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--app-dir",
      BACKEND_DIR,
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
    ],
    "FastAPI development server"
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "install") return install();
  if (command === "dev") return dev();

  console.error("Usage: node scripts/py.mjs <install|dev>");
  return 2;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (typeof process.disconnect === "function" && process.connected) {
    process.disconnect();
  }
}
