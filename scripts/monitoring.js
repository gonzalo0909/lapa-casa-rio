"use strict";

/**
 * scripts/monitoring.js
 * Monitoreo simple de endpoints críticos
 */

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const targets = [
  `${process.env.BASE_URL}/api/health`,
  `${process.env.BASE_URL}/api/availability?from=2025-01-01&to=2025-01-02`
];

async function checkTargets() {
  for (const url of targets) {
    try {
      const res = await fetch(url);
      console.log(`[MONITOR] ${url} -> ${res.status}`);
    } catch (err) {
      console.error(`[MONITOR] ${url} error: ${err.message}`);
    }
  }
}

if (require.main === module) {
  checkTargets().then(() => process.exit(0));
}

module.exports = { checkTargets };
