"use strict";

async function getEvents() {
  // Demo: reemplaza por fetch a tus FEEDS si querés
  return [{ title: "Evento demo", date: new Date().toISOString() }];
}

module.exports = { getEvents };
