#!/usr/bin/env node
/** Start Next.js and FastAPI together, and stop both when either exits. */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_CLI = path.join(ROOT_DIR, "node_modules", "next", "dist", "bin", "next");
const PYTHON_WRAPPER = path.join(ROOT_DIR, "scripts", "py.mjs");

const services = [
  {
    name: "Next.js",
    args: [NEXT_CLI, "dev", "-H", "0.0.0.0", "-p", "3000"],
  },
  {
    name: "FastAPI",
    args: [PYTHON_WRAPPER, "dev"],
    // Ask the wrapper to stop its Python child over IPC. On Windows, killing a
    // Node child process does not reliably signal that process's descendants.
    useIpcForShutdown: true,
  },
];

const children = [];
let remaining = services.length;
let shuttingDown = false;
let exitCode = 0;

function exitCodeForSignal(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 1;
}

function forceStop(entry, signal) {
  const { child } = entry;
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32" && child.pid) {
    // Last-resort Windows fallback: unlike ChildProcess.kill(), taskkill /T
    // also terminates a child tree if the IPC shutdown handshake fails.
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.once("error", () => {
      try {
        child.kill(signal);
      } catch {
        // The process may have exited already.
      }
    });
    return;
  }

  try {
    child.kill(signal);
  } catch {
    try {
      child.kill();
    } catch {
      // It may have exited between the state check and kill().
    }
  }
}

function stopEntry(entry, signal) {
  const { child, service } = entry;
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (service.useIpcForShutdown && child.connected) {
    entry.killTimer = setTimeout(() => forceStop(entry, signal), 5000);
    entry.killTimer.unref();

    try {
      child.send({ type: "shutdown" }, (error) => {
        if (error) forceStop(entry, signal);
      });
    } catch {
      forceStop(entry, signal);
    }
    return;
  }

  forceStop(entry, signal);
}

function stopAll(code, signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;

  for (const entry of children) stopEntry(entry, signal);
}

process.on("SIGINT", () => stopAll(130));
process.on("SIGTERM", () => stopAll(143));

let failedToSpawn = false;
for (const service of services) {
  console.log(`Starting ${service.name}...`);
  let child;
  try {
    child = spawn(process.execPath, service.args, {
      cwd: ROOT_DIR,
      stdio: service.useIpcForShutdown
        ? ["inherit", "inherit", "inherit", "ipc"]
        : "inherit",
      windowsHide: true,
    });
  } catch (error) {
    console.error(`Could not start ${service.name}: ${error.message}`);
    failedToSpawn = true;
    remaining -= 1;
    continue;
  }

  const entry = { child, service, killTimer: null };
  children.push(entry);
  child.once("error", (error) => {
    console.error(`Could not start ${service.name}: ${error.message}`);
    stopAll(1);
  });
  child.once("close", (code, signal) => {
    if (entry.killTimer) clearTimeout(entry.killTimer);

    if (!shuttingDown) {
      const serviceExitCode = code ?? exitCodeForSignal(signal);
      if (serviceExitCode !== 0) {
        console.error(`${service.name} stopped with exit code ${serviceExitCode}.`);
      }
      stopAll(serviceExitCode);
    }

    remaining -= 1;
    if (remaining === 0) process.exitCode = exitCode;
  });
}

if (failedToSpawn) stopAll(1);
if (remaining === 0) process.exitCode = exitCode;
