/******************************
 * Lapa Casa – Google Apps Script (Sheets + Crons + Backups)
 ******************************/

// ======= CONFIG =======
const SHEET_NAME            = 'Reservas';
const CRON_TOKEN            = '1f6cbe0e-3d13-4d2a-93a3-7b4a8c2b9e57';
const BACKEND_BASE          = 'https://lapacasahostel.com/api';
const BACKUP_FOLDER_NAME    = 'LapaCasa_Backups';
const BACKUP_RETENTION_DAYS = 30;
// =======================

// Base + columnas derivadas por cuarto
const HEADERS_BASE = [
  'booking_id','nombre','email','telefono',
  'entrada','salida','hombres','mujeres',
  'camas_json','total','pay_status','created_at'
];
const ROOM_COLS = ['room1_beds','room3_beds','room5_beds','room6_beds'];
const HEADERS = [...HEADERS_BASE, ...ROOM_COLS];

/* ========= Web App ========= */
function doGet(e) {
  try {
    const mode = String(e?.parameter?.mode || '').trim().toLowerCase();
    if (mode === 'rows') return json_({ ok:true, rows: getRows_() });
    const sh = ensureSheet_();
    return json_({ ok:true, sheet:SHEET_NAME, lastRow: sh.getLastRow(), headers: getCurrentHeaders_(sh) });
  } catch (err) {
    return json_({ ok:false, error:String(err) });
  }
}

function doPost(e) {
  try {
    if (!e?.postData?.contents) return json_({ ok:false, error:'Sin cuerpo' });
    let body; try { body = JSON.parse(e.postData.contents); }
    catch (err) { return json_({ ok:false, error:'JSON inválido', detail:String(err) }); }
    const action = String(body.action || '').trim().toLowerCase();
    if (action === 'payment_update')  return json_(updatePayment_(body));
    if (action === 'upsert_booking')  return json_(upsertBooking_(body));
    return json_(createBooking_(body));
  } catch (err) {
    return json_({ ok:false, error:String(err) });
  }
}

/* ========= Core ========= */
function ensureSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    sh.appendRow(HEADERS);
  }
  return sh;
}

function getCurrentHeaders_(sh) {
  return (sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]||[]);
}

function getRows_() {
  const sh = ensureSheet_();
  const vals = sh.getDataRange().getValues();
  const headers = vals.shift();
  return vals.filter(r => r.join('').trim()!=='').map(r=>{
    const o={}; headers.forEach((h,i)=>{o[h]=r[i];}); return o;
  });
}

function createBooking_(data) {
  const sh = ensureSheet_();
  const row = HEADERS.map(h => {
    if (h==='created_at') return new Date().toISOString();
    if (h==='camas_json') return JSON.stringify(data.camas||{});
    return data[h]||'';
  });
  sh.appendRow(row);
  return { ok:true, booking_id:data.booking_id };
}

function upsertBooking_(data) {
  const sh = ensureSheet_();
  const rows = getRows_();
  const idx = rows.findIndex(r=>String(r.booking_id)===String(data.booking_id));
  if (idx>=0) {
    const rowN = idx+2;
    HEADERS.forEach((h,i)=>{
      let val='';
      if(h==='camas_json') val=JSON.stringify(data.camas||{});
      else if(h==='created_at') val=rows[idx][h]||new Date().toISOString();
      else val=data[h]||'';
      sh.getRange(rowN,i+1).setValue(val);
    });
    return { ok:true, updated:true, booking_id:data.booking_id };
  }
  return createBooking_(data);
}

function updatePayment_(body) {
  const sh = ensureSheet_();
  const rows = getRows_();
  const idx = rows.findIndex(r=>String(r.booking_id)===String(body.booking_id));
  if (idx>=0) {
    sh.getRange(idx+2, HEADERS.indexOf('pay_status')+1).setValue(body.pay_status||'paid');
    return { ok:true, updated:true, booking_id:body.booking_id };
  }
  return { ok:false, error:'booking_not_found' };
}

/* ========= Utilitarios ========= */
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
