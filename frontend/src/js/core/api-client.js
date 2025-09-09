"use strict";

(function (global) {
  const BASE = (global.__CONFIG__ && global.__CONFIG__.BACKEND_BASE) || "/api";

  async function http(url, opts = {}) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) throw new Error(typeof body === "string" ? body : (body.error || "http_error"));
    return body;
  }

  async function getAvailability(from, to) {
    const u = new URL(`${BASE}/availability`, location.origin);
    u.searchParams.set("from", from);
    u.searchParams.set("to", to);
    return http(u.toString());
  }

  async function startHold(payload) {
    return http(`${BASE}/holds/start`, { method: "POST", body: JSON.stringify(payload) });
  }

  async function confirmHold(holdId) {
    return http(`${BASE}/holds/confirm`, { method: "POST", body: JSON.stringify({ holdId, status: "paid" }) });
  }

  async function stripeSession(order) {
    return http(`${BASE}/payments/stripe/session`, { method: "POST", body: JSON.stringify({ order }) });
  }

  async function mpCheckout(order) {
    return http(`${BASE}/payments/mp/checkout`, { method: "POST", body: JSON.stringify({ order }) });
  }

  global.ApiClient = { getAvailability, startHold, confirmHold, stripeSession, mpCheckout };
})(window);
