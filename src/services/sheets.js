"use strict";

async function notifySheets(event) {
  console.log("Notificando a Google Sheets:", event);
  return true;
}

module.exports = { notifySheets };
