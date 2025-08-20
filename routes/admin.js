// routes/admin.js
"use strict";
const express = require("express");
const router = express.Router();

const ADMIN_USER  = process.env.ADMIN_USER  || "admin";
const ADMIN_PASS  = process.env.ADMIN_PASS  || "admin";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ADMIN_IP_WHITELIST = String(process.env.ADMIN_IP_WHITELIST || "")
  .split(",").map(s=>s.trim()).filter(Boolean);

function normalizeIp(ip){ return String(ip || "").replace(/^::ffff:/, "").toLowerCase(); }
function ipAllowed(ip){
  if (!ADMIN_IP_WHITELIST.length) return true;
  const norm = normalizeIp(ip);
  return ADMIN_IP_WHITELIST.some(w => {
    const wNorm = w.toLowerCase();
    if (wNorm.includes("/")) {
      const base = wNorm.split("/")[0].replace(/::$/, "");
      return norm.startsWith(base);
    }
    return norm === wNorm;
  });
}

router.post("/login", (req,res)=>{
  if(!ipAllowed(req.ip)) return res.status(403).json({ok:false,error:"ip_denied"});
  const { user, pass, token } = Object(req.body||{});
  if ((user===ADMIN_USER && pass===ADMIN_PASS) || (ADMIN_TOKEN && token===ADMIN_TOKEN)) {
    req.session.user = ADMIN_USER;
    return res.json({ ok:true });
  }
  return res.status(401).json({ ok:false, error:"invalid_credentials" });
});

router.post("/logout", (req,res)=>{
  req.session = null;
  res.json({ ok:true });
});

router.get("/me", (req,res)=>{
  res.json({ ok:true, user: req.session?.user || null, ip: normalizeIp(req.ip) });
});

module.exports = router;
