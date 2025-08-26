/**
 * code.gs
 * API REST para Google Sheets - Reservas Lapa Casa Hostel
 * Permite: leer, crear, actualizar reservas y hacer backups automáticos
 */

const SHEET_NAME            = 'Reservas';
const CRON_TOKEN            = '1f6cbe0e-3d13-4d2a-93a3-7b4a8c2b9e57';
const BACKEND_BASE          = 'https://lapacasahostel.com/api';
const BACKUP_FOLDER_NAME    = 'LapaCasa_Backups';
const BACKUP_RETENTION_DAYS = 30;

const HEADERS_BASE = [
  'booking_id', 'nombre', 'email', 'telefono',
  'entrada', 'salida', 'hombres', 'mujeres',
  'camas_json', 'total', 'pay_status', 'created_at', 'source'
];

const ROOM_COLS = ['room1_beds', 'room3_beds', 'room5_beds', 'room6_beds'];
const HEADERS = [...HEADERS_BASE, ...ROOM_COLS];

// ========= Web App =========
function doGet(e) {
  try {
    const mode = (e?.parameter?.mode || '').trim().toLowerCase();
    if (mode === 'rows') {
      return json_({ ok: true, rows: getRows_() });
    }
    const sheet = ensureSheet_();
    return json_({
      ok: true,
      sheet: SHEET_NAME,
      lastRow: sheet.getLastRow(),
      headers: getCurrentHeaders_(sheet)
    });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    if (!e?.postData?.contents) {
      return json_({ ok: false, error: 'Sin cuerpo en la solicitud' });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return json_({ ok: false, error: 'JSON inválido', detail: err.message });
    }

    const action = (body.action || '').trim().toLowerCase();

    if (action === 'payment_update')  return json_(updatePayment_(body));
    if (action === 'upsert_booking')  return json_(upsertBooking_(body));
    if (action === 'create_booking')  return json_(createBooking_(body));

    return json_(createBooking_(body));
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

// ========= Core =========
function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME, 0);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function getCurrentHeaders_(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  return (range.getValues()[0] || []).map(String);
}

function getRows_() {
  const sheet = ensureSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values.shift();
  return values.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] !== '' ? row[i] : null;
    });
    return obj;
  });
}

function upsertBooking_(data) {
  const sheet = ensureSheet_();
  const headers = getCurrentHeaders_(sheet);
  const bookingId = String(data.booking_id || '').trim();

  if (!bookingId) {
    throw new Error('booking_id es requerido');
  }

  const rowData = headers.map(header => {
    const value = data[header];
    return value === null || value === undefined ? '' : value;
  });

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === bookingId) {
      sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
      return { ok: true, updated: true, booking_id: bookingId };
    }
  }

  sheet.appendRow(rowData);
  return { ok: true, inserted: true, booking_id: bookingId };
}

function createBooking_(data) {
  const now = new Date().toISOString();
  const booking = {
    booking_id: data.booking_id || `BKG-${Date.now()}`,
    created_at: now,
    pay_status: data.pay_status || 'pending',
    ...data
  };
  return upsertBooking_(booking);
}

function updatePayment_(data) {
  const sheet = ensureSheet_();
  const bookingId = String(data.booking_id || '').trim();
  if (!bookingId) return { ok: false, error: 'booking_id requerido' };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === bookingId) {
      const statusCol = 11; // Índice de 'pay_status'
      sheet.getRange(i + 1, statusCol).setValue(data.pay_status || 'pending');
      return { ok: true, updated: true, booking_id: bookingId };
    }
  }
  return { ok: false, error: 'not_found' };
}

// ========= Backups =========
function dailyBackup_() {
  const folder = getOrCreateFolder_(BACKUP_FOLDER_NAME);
  const ss = SpreadsheetApp.getActive();
  const file = DriveApp.getFileById(ss.getId());
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const copyName = `${SHEET_NAME}_backup_${timestamp}`;
  const copy = file.makeCopy(copyName, folder);
  cleanupOldBackups_(folder);
  return { ok: true, backupId: copy.getId(), name: copyName };
}

function getOrCreateFolder_(name) {
  const iter = DriveApp.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
}

function cleanupOldBackups_(folder) {
  const cutoffTime = new Date().getTime() - (BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const files = folder.getFiles();
  let deletedCount = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated().getTime() < cutoffTime) {
      file.setTrashed(true);
      deletedCount++;
    }
  }
  return { deleted: deletedCount };
}

// ========= Utils =========
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
