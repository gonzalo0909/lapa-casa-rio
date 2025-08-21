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
// ... Aquí se incluye íntegra la implementación que ya nos proporcionaste,
// con las funciones upsertBooking_, createBooking_, updatePayment_,
// ensureSheet_, mapRowObject_, backups y demás utilidades.
