"use strict";

/**
 * scripts/load-test.js
 * Stress test de endpoints críticos
 */

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const TARGET = process.env.LOAD_TEST_URL || `${process.env.BASE_URL}/api/availability?from=2025-01-01&to=2025-01-02`;
const REQUESTS = Number(process.env.LOAD_TEST_REQ || 200);

async function run() {
  console.log(`Running load test: ${REQUESTS} requests -> ${TARGET}`);
  const start = Date.now();

  const promises = [];
  for (let i = 0; i < REQUESTS; i++) {
    promises.push(fetch(TARGET).then(r => r.status).catch(() => "ERR"));
  }

  const results = await Promise.all(promises);
  const ok = results.filter(r => r === 200).length;
  const fail = results.length - ok;
  console.log(`Done in ${Date.now() - start}ms -> OK: ${ok}, FAIL: ${fail}`);
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = { run };
