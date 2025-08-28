/**
 * email_ingest_multisource.gs
 * Ingesta de reservas desde emails de múltiples plataformas
 * Plataformas: Booking.com, Airbnb, Expedia, Hostelworld, Despegar
 * Gmail + Google Sheets, sin APIs oficiales
 */

const INGEST_CONFIG = {
  SENDER_PATTERNS: [
    'from:(booking.com)',
    'from:(airbnb.com)',
    'from:(expedia.com)',
    'from:(hostelworld.com)',
    'from:(reservas@despegar.com)'
  ].join(' OR '),
  SUBJECT_KEYWORDS: /(reserva|booking|reservation|confirmaci[oó]n|confirmation|buchen)/i,
  ONLY_UNREAD: true,
  LABEL_NAME: 'lapa/ingested',
  LOOKBACK_DAYS: 14,
  DEFAULT_PAY_STATUS: 'pending'
};

/** Trigger cada 10 minutos */
function installIngestTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'fetchAllPlatformEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('fetchAllPlatformEmails').timeBased().everyMinutes(10).create();
  ensureLabel_();
}

/** Busca emails de todas las plataformas y los procesa */
function fetchAllPlatformEmails() {
  ensureLabel_();
  const label = GmailApp.getUserLabelByName(INGEST_CONFIG.LABEL_NAME);
  const query = buildSearchQuery_();
  const threads = GmailApp.search(query, 0, 200);
  if (!threads.length) return;

  threads.forEach(thread => {
    try {
      const message = thread.getMessages().slice(-1)[0];
      const subject = (message.getSubject() || '').trim();
      if (!INGEST_CONFIG.SUBJECT_KEYWORDS.test(subject)) return;

      const body = stripHtml_(message.getBody());
      const platform = detectPlatform_(message);
      if (!platform) return;

      const parser = PARSERS[platform];
      const parsed = parser ? parser(body, message) : basicParse_(body, platform);

      if (parsed && parsed.booking_id) {
        // Normalización y defaults
        parsed.pay_status = parsed.pay_status || INGEST_CONFIG.DEFAULT_PAY_STATUS;
        parsed.created_at = parsed.created_at || new Date().toISOString();
        parsed.camas_json = parsed.camas_json || '{}';
        parsed.telefono = parsed.telefono || '';

        upsertBookingToSheet_(parsed);
        if (INGEST_CONFIG.ONLY_UNREAD) thread.markRead();
        if (label) thread.addLabel(label);
      }
    } catch (e) {
      console.warn('Error procesando email:', e && e.message ? e.message : e);
    }
  });
}

/* ============= DETECCIÓN DE PLATAFORMA ============= */
function detectPlatform_(message) {
  const from = String(message.getFrom() || '').toLowerCase();
  const subject = String(message.getSubject() || '').toLowerCase();
  if (from.includes('booking.com')) return 'booking';
  if (from.includes('airbnb.com') || subject.includes('airbnb')) return 'airbnb';
  if (from.includes('expedia.com')) return 'expedia';
  if (from.includes('hostelworld.com')) return 'hostelworld';
  if (from.includes('despegar.com')) return 'despegar';
  return null;
}

/* ============= PARSERS POR PLATAFORMA ============= */
const PARSERS = {
  booking: function(body, message) {
    return {
      booking_id: matchOne_(body, /ID\s*[:\-]?\s*(\d{6,})/i) || extractIdFromSubject_(message.getSubject()),
      nombre: matchOne_(body, /Nombre[:\s]+([^\n<]+)/i),
      email: matchOne_(body, /Email[:\s]+(\S+@\S+)/i),
      telefono: matchOne_(body, /Tel[eé][^:]*[:\s]+([+()\-\s\d]+)/i),
      entrada: normalizeDate_(matchOne_(body, /Check.?in[:\s]+(\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      salida:  normalizeDate_(matchOne_(body, /Check.?out[:\s]+(\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      hombres: toInt_(matchOne_(body, /Hombres?[:\s]+(\d+)/i)),
      mujeres: toInt_(matchOne_(body, /Mujeres?[:\s]+(\d+)/i)),
      total: toMoney_(matchOne_(body, /Total[:\s]+[R$€]?\s*([\d,\.]+)/i)),
      source: 'booking.com'
    };
  },

  airbnb: function(body) {
    return {
      booking_id: matchOne_(body, /Reservation:\s*([A-Z0-9\-]{6,})/i),
      nombre: matchOne_(body, /Guest:\s*([^\n]+)/i),
      email: matchOne_(body, /Email:\s*(\S+@\S+)/i),
      entrada: normalizeDate_(matchOne_(body, /Check-in:\s*([^\n]+)/i)),
      salida:  normalizeDate_(matchOne_(body, /Check-out:\s*([^\n]+)/i)),
      hombres: toInt_(matchOne_(body, /Guests?:\s*(\d+)/i)),
      mujeres: 0,
      total: toMoney_(matchOne_(body, /Total:\s*[€$]?\s*([\d,\.]+)/i)),
      source: 'airbnb'
    };
  },

  expedia: function(body) {
    return {
      booking_id: matchOne_(body, /Booking\s*ID[:\s]+([A-Z0-9\-]+)/i),
      nombre: matchOne_(body, /Customer Name[:\s]+([^\n]+)/i),
      email: matchOne_(body, /Email[:\s]+(\S+@\S+)/i),
      entrada: normalizeDate_(matchOne_(body, /Arrival:\s*([^\d]*\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      salida:  normalizeDate_(matchOne_(body, /Departure:\s*([^\d]*\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      hombres: toInt_(matchOne_(body, /Guests?:\s*(\d+)/i)),
      mujeres: 0,
      total: toMoney_(matchOne_(body, /Total Charge[:\s]+[US]*\$?\s*([\d,\.]+)/i)),
      source: 'expedia'
    };
  },

  hostelworld: function(body) {
    return {
      booking_id: matchOne_(body, /Booking Ref:\s*([A-Z0-9\-]+)/i),
      nombre: matchOne_(body, /Name:\s*([^\n]+)/i),
      email: matchOne_(body, /Email:\s*(\S+@\S+)/i),
      entrada: normalizeDate_(matchOne_(body, /Arrival:\s*([^\d]*\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      salida:  normalizeDate_(matchOne_(body, /Departure:\s*([^\d]*\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      hombres: toInt_(matchOne_(body, /Male:\s*(\d+)/i)),
      mujeres: toInt_(matchOne_(body, /Female:\s*(\d+)/i)),
      total: toMoney_(matchOne_(body, /Total:\s*€?\s*([\d,\.]+)/i)),
      source: 'hostelworld'
    };
  },

  despegar: function(body) {
    return {
      booking_id: matchOne_(body, /Reserva:\s*([A-Z0-9\-]+)/i),
      nombre: matchOne_(body, /Nombre:\s*([^\n]+)/i),
      email: matchOne_(body, /Email:\s*(\S+@\S+)/i),
      entrada: normalizeDate_(matchOne_(body, /Check-in:\s*([^\d]*\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      salida:  normalizeDate_(matchOne_(body, /Check-out:\s*([^\d]*\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
      hombres: toInt_(matchOne_(body, /Adultos:\s*(\d+)/i)),
      mujeres: 0,
      total: toMoney_(matchOne_(body, /Total:\s*R?\$?\s*([\d,\.]+)/i)),
      source: 'despegar'
    };
  }
};

/* ============= AUXILIARES ============= */
function buildSearchQuery_() {
  const cutoff = new Date(Date.now() - INGEST_CONFIG.LOOKBACK_DAYS * 86400000);
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1);
  const d = String(cutoff.getDate());
  const after = `${y}/${m}/${d}`;
  const unread = INGEST_CONFIG.ONLY_UNREAD ? ' is:unread' : '';
  return `${INGEST_CONFIG.SENDER_PATTERNS} after:${after}${unread}`;
}

function ensureLabel_() {
  if (!GmailApp.getUserLabelByName(INGEST_CONFIG.LABEL_NAME)) {
    GmailApp.createLabel(INGEST_CONFIG.LABEL_NAME);
  }
}

function stripHtml_(html) {
  // preservar saltos de línea básicos
  const withBreaks = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n');
  return withBreaks.replace(/<[^>]+>/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\s+/g, ' ').trim();
}

function matchOne_(text, regex) {
  const m = regex.exec(text);
  return m ? String(m[1]).trim() : '';
}

function toInt_(str) {
  const n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

function toMoney_(str) {
  return Number(String(str || '').replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
}

function normalizeDate_(str) {
  if (!str) return '';
  const cleaned = String(str).replace(/[^\d\/\-\s]/g, '');
  const parts = cleaned.split(/[/\-\s]/).filter(Boolean);
  if (parts.length !== 3) return '';
  let [d, m, y] = parts;
  if (y.length === 2) y = '20' + y;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extractIdFromSubject_(subject) {
  return matchOne_(String(subject || ''), /(\d{6,})/);
}

function basicParse_(body, source) {
  return {
    booking_id: 'AUTO_' + new Date().getTime(),
    nombre: matchOne_(body, /(?:Guest|Name|Cliente)[:\s]+([A-Za-zÀ-ÿ\s]+)/i),
    email: matchOne_(body, /Email[:\s]+(\S+@\S+)/i),
    entrada: normalizeDate_(matchOne_(body, /(?:Check.?in|Arrival)[^\d]*(\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
    salida:  normalizeDate_(matchOne_(body, /(?:Check.?out|Departure)[^\d]*(\d{1,2}[/\s]\d{1,2}[/\s]\d{2,4})/i)),
    hombres: toInt_(matchOne_(body, /(?:Guests?|Adultos)[:\s]+(\d+)/i)),
    mujeres: 0,
    total: toMoney_(matchOne_(body, /Total[:\s]+[R$€$]?\s*([\d,\.]+)/i)),
    source
  };
}

/* ============= INTEGRACIÓN CON SHEETS ============= */
function upsertBookingToSheet_(data) {
  const sheet = getBookingSheet_();
  const headers = getHeaders_(sheet);
  const values = headers.map(h => (data[h] !== undefined && data[h] !== null ? data[h] : ''));
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.booking_id)) {
      sheet.getRange(i + 1, 1, 1, values.length).setValues([values]);
      return { updated: true };
    }
  }
  sheet.appendRow(values);
  return { inserted: true };
}

function getBookingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Reservas');
  if (!sheet) {
    sheet = ss.insertSheet('Reservas', 0);
    const headers = [
      'booking_id', 'nombre', 'email', 'telefono',
      'entrada', 'salida', 'hombres', 'mujeres',
      'camas_json', 'total', 'pay_status', 'created_at', 'source'
    ];
    sheet.appendRow(headers);
  }
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/* ============= UTILS ============= */
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
