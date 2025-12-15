#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const plopBin = require.resolve("plop/bin/plop.js");
const plopfile = path.resolve(__dirname, "..", "plopfile.cjs");

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [plopBin, "--plopfile", plopfile, "--cwd", process.cwd(), ...args], {
  stdio: "inherit"
});

process.exit(result.status ?? 1);

