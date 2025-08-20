// routes/availability.js
"use strict";
const express = require("express");
const router = express.Router();
const holds = require("../services/holds");

// Capacidad por cuarto (debe calzar con el front)
const ROOMS = { 1:12, 3:12, 5:7, 6:7 };

router.get("/", (req,res)=>{
  try{
    const from = String(req.query.from||"");
    const to   = String(req.query.to||"");
    if(!from || !to) return res.status(400).json({ok:false,error:"missing_dates"});

    const occ = holds.getOccupiedByRange(from,to); // {roomId:[beds]}
    // normalizar: asegurar arrays y no exceder capacidad
    const occupied = {};
    for (const id of Object.keys(ROOMS)){
      const list = Array.from(new Set(occ[id]||[])).filter(n=>Number(n)>=1 && Number(n)<=ROOMS[id]);
      occupied[id] = list;
    }
    res.json({ ok:true, occupied, rooms: ROOMS });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e.message||e) });
  }
});

module.exports = router;
