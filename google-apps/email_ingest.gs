/*******************************************************
 * email_ingest.gs — Ingesta de emails (Booking sin iCal)
 *******************************************************/

const INGEST = {
  SENDER_FILTER: 'from:(booking.com) OR from:(reservations@booking.com)',
  SUBJECT_MATCH: /(reserva|booking|reservation|confirmación|confirmacao|confirmation)/i,
  ONLY_UNREAD: true,
  LABEL_NAME: 'lapa/ingested',
  LOOKBACK_DAYS: 14,
  DEFAULT_PAY_STATUS: 'pending'
};

// Trigger cada 10 minutos
function installIngestTrigger() {
  ScriptApp.getProjectTriggers().forEach(tr => {
    if (tr.getHandlerFunction() === 'fetchBookingEmails') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('fetchBookingEmails').timeBased().everyMinutes(10).create();
  ensureLabel_();
}

// Corrida manual
function fetchBookingEmails() {
  ensureLabel_();
  const label = GmailApp.getUserLabelByName(INGEST.LABEL_NAME);
  const query = buildQuery_();
  const threads = GmailApp.search(query, 0, 200);
  if (!threads.length) return;

  threads.forEach(th => {
    const msg = th.getMessages().slice(-1)[0];
    const subj = (msg.getSubject() || '').trim();
    if (!INGEST.SUBJECT_MATCH.test(subj)) return;

    const parsed = parseMessage_(msg);
    if (!parsed) return;

    try {
      upsertBooking_(parsed); // usa la función de code.gs
      if (INGEST.ONLY_UNREAD) th.markRead();
      if (label) th.addLabel(label);
    } catch (e) {
      console.warn('upsert error:', e);
    }
  });
}

/* ================= Helpers ================= */
function buildQuery_(){
  const since = new Date(); since.setDate(since.getDate()-INGEST.LOOKBACK_DAYS);
  const ymd = Utilities.formatDate(since, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  return `${INGEST.SENDER_FILTER} subject:(${INGEST.SUBJECT_MATCH.source}) after:${ymd}`;
}
function ensureLabel_(){ if(!GmailApp.getUserLabelByName(INGEST.LABEL_NAME)) GmailApp.createLabel(INGEST.LABEL_NAME); }
function parseMessage_(msg){
  const body = msg.getPlainBody();
  const id = 'BKG-'+msg.getId();
  const name = matchOne_(body, /Nombre[: ]+(.+)/i);
  const email = matchOne_(body, /Email[: ]+(.+)/i);
  const phone = matchOne_(body, /Tel[eé]fono[: ]+(.+)/i);
  const checkin = normalizeDate_(matchOne_(body,/Check[- ]?in[: ]+(\d{1,2}\/\d{1,2}\/\d{4})/i));
  const checkout= normalizeDate_(matchOne_(body,/Check[- ]?out[: ]+(\d{1,2}\/\d{1,2}\/\d{4})/i));
  const pax = toInt_(matchOne_(body,/(Huéspedes|Guests)[: ]+(\d+)/i,2));
  return { booking_id:id, nombre:name, email, telefono:phone, entrada:checkin, salida:checkout, hombres:pax||0, mujeres:0, camas:{}, total:0, pay_status:INGEST.DEFAULT_PAY_STATUS };
}
function matchOne_(txt,re,idx=1){ const m=txt.match(re); return m? m[idx].trim():''; }
function toInt_(s){ const n=parseInt(s,10); return isNaN(n)?0:n; }
function normalizeDate_(s){ if(!s) return ''; const [d,m,y]=s.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
