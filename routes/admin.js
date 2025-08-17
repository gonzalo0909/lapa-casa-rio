"use strict";
/**
 * routes/admin.js — Login simple con usuario/contraseña de env
 */
const express = require("express");
const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin";
const ADMIN_IPS  = (process.env.ADMIN_IP_WHITELIST || "").split(",").map(s=>s.trim()).filter(Boolean);

// middleware de IP whitelist
router.use((req,res,next)=>{
  if (!ADMIN_IPS.length) return next();
  const ip = req.ip || req.connection.remoteAddress || "";
  if (ADMIN_IPS.some(wl => ip.includes(wl))) return next();
  return res.status(403).json({ ok:false, error:"ip_forbidden" });
});

// login
router.post("/login", express.json(), (req,res)=>{
  const { user, pass } = req.body || {};
  if (user===ADMIN_USER && pass===ADMIN_PASS) {
    req.session.user = ADMIN_USER;
    return res.json({ ok:true });
  }
  res.status(401).json({ ok:false, error:"invalid_credentials" });
});

// logout
router.post("/logout",(req,res)=>{
  req.session.destroy(()=> res.json({ ok:true }));
});

// guardia
router.use((req,res,next)=>{
  if (req.session && req.session.user===ADMIN_USER) return next();
  return res.status(401).json({ ok:false, error:"not_logged_in" });
});

// panel dummy
router.get("/", (_req,res)=> res.sendFile(require("path").join(__dirname,"..","admin","index.html")));

module.exports = router;
