const express = require('express');
const router = express.Router();

/**
 * HOLDs en memoria (simple). En producción, usa DB/Redis.
 * Estructura:
 *  holds[holdId] = {
 *    holdId, entrada, salida, hombres, mujeres, camas, total,
 *    createdAt, ttlMs
 *  }
 */
const holds = new Map();
const DEFAULT_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES || 10);

function nowMs(){ return Date.now(); }
function sweep(){
  const cutoff = nowMs();
  for (const [id, h] of holds.entries()){
    if (!h || !h.expiresAt || h.expiresAt <= cutoff) holds.delete(id);
  }
}

/** POST /api/holds/start
 *  body: { holdId, entrada, salida, hombres, mujeres, camas, total }
 *  resp: { ok:true, holdId, expiresAt }
 */
router.post('/start', express.json(), (req,res)=>{
  try{
    sweep();
    const b = req.body || {};
    const holdId = String(b.holdId || `HOLD-${Date.now()}`);
    const ttlMin = DEFAULT_TTL_MINUTES > 0 ? DEFAULT_TTL_MINUTES : 10;
    const ttlMs  = ttlMin * 60 * 1000;
    const item = {
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
    };
    holds.set(holdId, item);
    return res.json({ ok:true, holdId, expiresAt: item.expiresAt });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

/** POST /api/holds/confirm
 *  body: { holdId, status }  // status: 'paid'|'released'
 *  resp: { ok:true }
 */
router.post('/confirm', express.json(), (req,res)=>{
  try{
    const { holdId, status } = req.body || {};
    if(!holdId) return res.status(400).json({ ok:false, error:'holdId requerido' });
    const item = holds.get(String(holdId));
    if(!item) return res.status(404).json({ ok:false, error:'hold_not_found' });
    item.status = status || 'paid';
    // En una implementación real, aquí escribirías la reserva definitiva en DB.
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

/** POST /api/holds/release
 *  body: { holdId }
 *  resp: { ok:true }
 */
router.post('/release', express.json(), (req,res)=>{
  try{
    const { holdId } = req.body || {};
    if(!holdId) return res.status(400).json({ ok:false, error:'holdId requerido' });
    holds.delete(String(holdId));
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

/** GET /api/holds/:id (debug opcional) */
router.get('/:id', (req,res)=>{
  const id = String(req.params.id || '');
  const item = holds.get(id);
  if(!item) return res.status(404).json({ ok:false, error:'hold_not_found' });
  return res.json({ ok:true, hold:item });
});

module.exports = router;
