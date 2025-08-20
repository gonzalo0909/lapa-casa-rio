// routes/events.js
"use strict";
const express = require("express");
const router = express.Router();

const ENABLE_EVENTS = String(process.env.ENABLE_EVENTS||"0")==="1";
const EVENTS_FEEDS = String(process.env.EVENTS_FEEDS||"").split(",").map(s=>s.trim()).filter(Boolean);
const EVENTS_TTL_HOURS = Number(process.env.EVENTS_TTL_HOURS||24);

let cache = { ts:0, data: [] };

router.get("/", async (_req,res)=>{
  if(!ENABLE_EVENTS) return res.json({ ok:true, data:[] });
  const now = Date.now();
  if (now - cache.ts < EVENTS_TTL_HOURS*3600*1000) return res.json({ ok:true, data:cache.data, cached:true });
  // Fetch muy simple (sin parse RSS real, placeholder)
  try{
    const data = EVENTS_FEEDS.map((u,i)=>({ id:i+1, source:u, title:`Feed ${i+1}`, url:u }));
    cache = { ts: now, data };
    res.json({ ok:true, data });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
