#!/usr/bin/env node
'use strict';

// Shim the browser globals that crosscolor.js expects, then run the test harness.

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

global.window = global;
global.performance = performance;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { documentElement: { setAttribute: () => {} } };
global.fetch = async (url) => {
  const text = fs.readFileSync(path.resolve(__dirname, url), 'utf8');
  return { json: async () => JSON.parse(text) };
};

require('./crosscolor.js');

const n = parseInt(process.argv[2] || '10', 10);
crosscolor.testGeneration(n).catch(err => { console.error(err); process.exit(1); });
