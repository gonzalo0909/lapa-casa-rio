"use strict";

/**
 * Middleware: Admin Guard
 * Protege rutas admin por token + whitelist de IPs
 */

function adminGuard(req, res, next) {
  const token = req.headers["x-admin-token"];
  const ip = req.ip || req.connection?.remoteAddress || "";

  const whitelistRaw = process.env.ADMIN_IP_WHITELIST || "";
  const whitelist = whitelistRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const tokenMatch = token && token === process.env.ADMIN_TOKEN;
  const ipMatch = !whitelist.length || whitelist.includes(ip);

  if (!tokenMatch || !ipMatch) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return next();
}

module.exports = { adminGuard };
