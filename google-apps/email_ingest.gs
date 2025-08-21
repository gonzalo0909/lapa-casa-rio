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
      upsertBooking_(parsed); // usa la función del code.gs
      if (INGEST.ONLY_UNREAD) th.markRead();
      if (label) th.addLabel(label);
    } catch (e) {
      console.warn('upsert error:', e);
    }
  });
}

/* ================= PARSER ================= */
// ... Incluye aquí el resto del parser que nos proporcionaste,
// con las funciones parseMessage_, buildQuery_, ensureLabel_,
// stripHtml_, matchOne_, toInt_, toMoney_, normalizeDate_, etc.
