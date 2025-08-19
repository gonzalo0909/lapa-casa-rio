"use strict";
/**
 * middleware/session.js
 * Cookie de sesión firmada (sin libs externas).
 * Compatible con rutas que usan: req.session = {logged:true} y logout con req.session = null.
 */
const crypto = require("crypto");

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "lapa_sess";
const SECRET = process.env.ADMIN_SESSION_SECRET || "change-me";
const MAX_AGE_S = Number(process.env.ADMIN_SESSION_MAX_AGE || 7 * 24 * 3600); // 7 días
const SECURE = String(process.env.NODE_ENV).toLowerCase() === "production";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function sign(obj) {
  const payload = Buffer.from(JSON.stringify(obj || {}));
  const mac = crypto.createHmac("sha256", SECRET).update(payload).digest();
  return `${b64url(payload)}.${b64url(mac)}`;
}
function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [pay, mac] = token.split(".");
  const payload = fromB64url(pay);
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  if (crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    try { return JSON.parse(payload.toString("utf8")); } catch { return null; }
  }
  return null;
}
function parseCookies(h) {
  const out = {};
  if (!h) return out;
  h.split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}
function setCookie(res, name, val, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(val)}`];
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.max(0, opts.maxAge | 0)}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

module.exports = function session() {
  return function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req.headers.cookie || "");
    const tok = cookies[COOKIE_NAME];
    const initial = verify(tok) || {};
    let changed = false;

    // sesión disponible en req
    req.session = initial;

    // marcar cambios si se reasigna o muta
    const handler = {
      set(obj, prop, value) { changed = true; obj[prop] = value; return true; },
      deleteProperty(obj, prop) { changed = true; delete obj[prop]; return true; }
    };
    req.session = new Proxy(req.session, handler);

    // helper explícito (opcional)
    req.clearSession = () => { changed = true; req.session = {}; req._clearSession = true; };

    // al terminar la respuesta, persistir si cambió
    res.on("finish", () => {
      try {
        if (req._clearSession || req.session === null) {
          setCookie(res, COOKIE_NAME, "", { maxAge: 0, httpOnly: true, sameSite: "Lax", secure: SECURE });
          return;
        }
        if (changed) {
          const token = sign(req.session);
          setCookie(res, COOKIE_NAME, token, {
            maxAge: MAX_AGE_S, httpOnly: true, sameSite: "Lax", secure: SECURE
          });
        }
      } catch { /* noop */ }
    });

    next();
  };
};
