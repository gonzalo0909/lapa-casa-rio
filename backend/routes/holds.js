const express = require('express');
const router = express.Router();

const holds = new Map();
const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

function nowMs(){ return Date.now(); }
function sweep(){
  const cutoff = nowMs();
  for (const [id, h] of holds.entries()){
    if (!h || !h.expiresAt || h.expiresAt <= cutoff) holds.delete(id);
  }
}

router.post('/start', (req,res)=>{
  try{
    sweep();
    const b = req.body || {};
    const holdId = String(b.holdId || `HOLD-${Date.now()}`);
    const ttlMin = DEFAULT_TTL_MINUTES > 0 ? DEFAULT_TTL_MINUTES : 10;
    const ttlMs  = ttlMin * 60 * 1000;
    holds.set(holdId, {
      holdId,
      entrada: b.entrada || '',
      salida:  b.salida || '',
      hombres: Number(b.hombres || 0),
      mujeres: Number(b.mujeres || 0),
      camas:   b.camas || {},
      total:   Number(b.total || 0),
      createdAt: new Date(),
      ttlMs,
      expiresAt: nowMs() + ttlMs,
      status: 'hold'
    });
    return res.json({ ok:true, holdId, expiresAt: nowMs() + ttlMs });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

router.post('/confirm', (req,res)=>{
  try{
    const { holdId, status } = req.body || {};
    if(!holdId) return res.status(400).json({ ok:false, error:'holdId requerido' });
    const item = holds.get(String(holdId));
    if(!item) return res.status(404).json({ ok:false, error:'hold_not_found' });
    item.status = status || 'paid';
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

router.post('/release', (req,res)=>{
  try{
    const { holdId } = req.body || {};
    if(!holdId) return res.status(400).json({ ok:false, error:'holdId requerido' });
    holds.delete(String(holdId));
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

router.get('/:id', (req,res)=>{
  const id = String(req.params.id || '');
  const item = holds.get(id);
  if(!item) return res.status(404).json({ ok:false, error:'hold_not_found' });
  return res.json({ ok:true, hold:item });
});

module.exports = router;
