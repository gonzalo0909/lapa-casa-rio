
requireAuth();
renderNav('ical');

const PLATFORM_LABELS = {
  airbnb:      'Airbnb',
  booking:     'Booking.com',
  hostelworld: 'Hostelworld',
  expedia:     'Expedia',
};

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

// ── Habitaciones: caché compartida entre select y renderFeeds ────────────────

// ?type=hostel|apartment: cuando se embebe dentro de Hostel o Apartamentos solo muestra
// las habitaciones, feeds y URLs de exportación de ese tipo. Sin parámetro, muestra todo.
const PROPERTY_TYPE = (() => {
  const t = new URLSearchParams(window.location.search).get('type');
  return t === 'hostel' || t === 'apartment' ? t : '';
})();

let roomsCache = []; // [{ id, name }] hostel + apartamentos
let apartmentsCache = []; // [{ id, name }]

async function loadApartments() {
  try {
    const data = await apiFetch('/admin/room-types');
    apartmentsCache = (data && data.apartments) ? data.apartments : [];
  } catch {
    apartmentsCache = [];
  }
}

async function loadRoomOptions() {
  try {
    const [data] = await Promise.all([apiFetch('/rooms'), loadApartments()]);
    const hostel = PROPERTY_TYPE === 'apartment' ? [] : (data.rooms ?? []);
    if (PROPERTY_TYPE === 'hostel') { apartmentsCache = []; }
    roomsCache = [...hostel, ...apartmentsCache];
    const select = document.getElementById('feed-room');
    const opts = (list) => list.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    select.innerHTML =
      `<optgroup label="Hostel">${opts(hostel)}</optgroup>` +
      (apartmentsCache.length ? `<optgroup label="Apartamentos">${opts(apartmentsCache)}</optgroup>` : '');
  } catch {
    document.getElementById('feed-room').innerHTML = '<option value="">Error al cargar habitaciones</option>';
  }
}

function roomName(roomTypeId) {
  const r = roomsCache.find((r) => r.id === roomTypeId);
  return r ? r.name : roomTypeId;
}

// ── Feeds ────────────────────────────────────────────────────────────────────

async function loadFeeds() {
  try {
    // /ical/status trae los feeds y el resultado de la última lectura de cada uno.
    const data = await apiFetch('/ical/status');
    let feeds = data.feeds ?? [];
    if (PROPERTY_TYPE) { feeds = feeds.filter((f) => roomsCache.some((r) => r.id === f.roomTypeId)); }
    renderFeeds(feeds, data.feedStatus ?? {});
  } catch (err) {
    showMsg('feeds-msg', escapeHtml(err.message), 'error');
  }
}

function feedStatusCell(st) {
  if (!st) { return '<span style="color:#888;">Sin lecturas aún</span>'; }
  const when = new Date(st.lastSyncAt).toLocaleString('pt-BR');
  const counts = `${st.imported ?? 0} nueva(s) · ${st.updated ?? 0} actualizada(s) · ${st.cancelled ?? 0} cancelada(s)`;
  const errs = st.errors ?? [];
  const state = st.success
    ? '<span style="color:#1e8e3e">OK</span>'
    : '<span style="color:#c0392b">Falló</span>';
  const detail = errs.map((e) => `<div style="color:#c0392b;font-size:11px;">• ${escapeHtml(e)}</div>`).join('');
  return `${state} · ${escapeHtml(when)}<div style="font-size:11px;color:#888;">${escapeHtml(counts)}</div>${detail}`;
}

function renderFeeds(feeds, feedStatus) {
  const tbody = document.querySelector('#feeds-table tbody');
  if (!feeds.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#888;">Sin feeds configurados</td></tr>';
    return;
  }
  tbody.innerHTML = feeds.map((f) => `
    <tr data-id="${f.id}" data-url="${escapeHtml(f.url)}" data-active="${f.isActive ? '1' : '0'}">
      <td>${escapeHtml(PLATFORM_LABELS[f.channelCode] ?? f.channelCode)}</td>
      <td>${escapeHtml(roomName(f.roomTypeId))}</td>
      <td style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(f.url)}">${escapeHtml(f.url)}</td>
      <td><span class="badge ${f.isActive ? 'confirmed' : 'cancelled'}">${f.isActive ? 'Activo' : 'Pausado'}</span></td>
      <td style="font-size:12px;">${feedStatusCell(feedStatus[f.id])}</td>
      <td style="white-space:nowrap;">
        <button data-action="diagnose-feed">Diagnosticar</button>
        <button data-action="edit-feed">Editar URL</button>
        <button data-action="toggle-feed">${f.isActive ? 'Pausar' : 'Activar'}</button>
        <button data-action="delete-feed">Quitar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="delete-feed"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteFeed(btn.closest('tr').dataset.id));
  });
  tbody.querySelectorAll('button[data-action="diagnose-feed"]').forEach((btn) => {
    btn.addEventListener('click', () => diagnoseFeed(btn.closest('tr').dataset.id, btn));
  });
  tbody.querySelectorAll('button[data-action="edit-feed"]').forEach((btn) => {
    btn.addEventListener('click', () => editFeedUrl(btn.closest('tr')));
  });
  tbody.querySelectorAll('button[data-action="toggle-feed"]').forEach((btn) => {
    btn.addEventListener('click', () => toggleFeed(btn.closest('tr')));
  });
}

// Muestra, evento por evento, qué hace el sistema con lo que devuelve la plataforma.
async function diagnoseFeed(feedId, btn) {
  btn.disabled = true;
  const box = document.getElementById('feeds-msg');
  try {
    const data = await apiFetch(`/ical/feeds/${feedId}/diagnose`);
    const rows = (data && data.rows) || [];
    box.innerHTML = rows.length
      ? `<div class="msg success" style="overflow-x:auto;"><strong>Diagnóstico del feed</strong>
          <button type="button" id="copy-diagnosis-btn" style="margin-left:10px;font-size:12px;padding:2px 9px;">Copiar diagnóstico</button>
          <table style="width:100%;font-size:12px;margin-top:6px;border-collapse:collapse;">
            <tr><th style="text-align:left;">Entrada</th><th style="text-align:left;">Salida</th><th>Noches</th><th style="text-align:left;">Qué hace el sistema</th></tr>
            ${rows.map((r) => `<tr><td>${escapeHtml(r.checkIn)}</td><td>${escapeHtml(r.checkOut)}</td><td style="text-align:center;">${r.nights}</td><td>${escapeHtml(r.verdict)}</td></tr>`).join('')}
          </table></div>`
      : '<div class="msg success">El feed no devolvió ningún evento.</div>';
    const copyBtn = document.getElementById('copy-diagnosis-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = ['Entrada\tSalida\tNoches\tUID\tQué hace el sistema']
          .concat(rows.map((r) => [r.checkIn, r.checkOut, r.nights, r.uid, r.verdict].join('\t')))
          .join('\n');
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        copyBtn.textContent = '✓ Copiado';
        setTimeout(() => { copyBtn.textContent = 'Copiar diagnóstico'; }, 2000);
      });
    }
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    showMsg('feeds-msg', escapeHtml(err.message), 'error');
  } finally {
    btn.disabled = false;
  }
}

async function editFeedUrl(row) {
  const url = prompt('Nueva URL del feed .ics:', row.dataset.url);
  if (url === null || url.trim() === '' || url.trim() === row.dataset.url) { return; }
  try { new URL(url.trim()); } catch {
    showMsg('feeds-msg', 'La URL no es válida.', 'error');
    return;
  }
  try {
    await apiFetch(`/ical/feeds/${row.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ url: url.trim() }) });
    showMsg('feeds-msg', 'URL actualizada.', 'success');
    loadFeeds();
  } catch (err) {
    showMsg('feeds-msg', escapeHtml(err.message), 'error');
  }
}

async function toggleFeed(row) {
  const activate = row.dataset.active !== '1';
  if (!activate && !confirm('¿Pausar este feed? Dejará de sincronizarse y sus reservas importadas dejarán de vigilarse.')) { return; }
  try {
    const data = await apiFetch(`/ical/feeds/${row.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: activate }) });
    const n = data && data.feed && data.feed.orphanedReservations ? data.feed.orphanedReservations : 0;
    showMsg('feeds-msg', n
      ? `Feed pausado. Quedan ${n} reserva(s) importada(s) activas que ya nadie vigila y siguen bloqueando fechas: cancélalas desde Reservas si ya no corresponden.`
      : (activate ? 'Feed activado.' : 'Feed pausado.'), n ? 'error' : 'success');
    loadFeeds();
  } catch (err) {
    showMsg('feeds-msg', escapeHtml(err.message), 'error');
  }
}

async function deleteFeed(id) {
  if (!confirm('¿Eliminar este feed? Dejará de sincronizarse.')) return;
  try {
    const data = await apiFetch(`/ical/feeds/${id}`, { method: 'DELETE' });
    const n = (data && data.orphanedReservations) || 0;
    showMsg('feeds-msg', n
      ? `Feed eliminado. Quedan ${n} reserva(s) importada(s) activas que ya nadie vigila y siguen bloqueando fechas: cancélalas desde Reservas si ya no corresponden.`
      : 'Feed eliminado.', n ? 'error' : 'success');
    loadFeeds();
  } catch (err) {
    showMsg('feeds-msg', escapeHtml(err.message), 'error');
  }
}

document.getElementById('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const channelCode = document.getElementById('feed-channel').value;
  const roomTypeId  = document.getElementById('feed-room').value;
  const url         = document.getElementById('feed-url').value.trim();

  try { new URL(url); } catch {
    showMsg('add-msg', 'La URL no es válida.', 'error');
    return;
  }

  try {
    await apiFetch('/ical/import/config', {
      method: 'POST',
      body: JSON.stringify({ channelCode, roomTypeId, url }),
    });
    showMsg('add-msg', 'Feed agregado correctamente.', 'success');
    document.getElementById('add-form').reset();
    loadFeeds();
  } catch (err) {
    showMsg('add-msg', escapeHtml(err.message), 'error');
  }
});

// ── Sync manual ──────────────────────────────────────────────────────────────

async function loadSyncStatus() {
  try {
    // response.data = { feeds: [...], syncStatus: { airbnb: { lastSyncAt, success, ... }, ... } }
    const data = await apiFetch('/ical/status');
    const el = document.getElementById('sync-status');
    if (!data) return;

    const totalFeeds = (data.feeds ?? []).length;

    // Encontrar la sync más reciente entre todos los canales
    const syncEntries = Object.values(data.syncStatus ?? {});
    const lastSyncAt = syncEntries
      .map((s) => s.lastSyncAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    const fmtDT = (iso) => new Date(iso).toLocaleString('pt-BR');
    const channels = Object.entries(data.syncStatus ?? {});
    const lines = channels.map(([code, st]) => {
      const label = PLATFORM_LABELS[code] ?? code;
      const errs = st.errors ?? [];
      const head = `<strong>${escapeHtml(label)}</strong> — última sync ${st.lastSyncAt ? fmtDT(st.lastSyncAt) : '—'} · ` +
        `${st.imported ?? 0} importada(s) · ${st.cancelled ?? 0} cancelada(s) · ` +
        (errs.length ? `<span style="color:#c0392b">${errs.length} error(es)</span>` : '<span style="color:#1e8e3e">sin errores</span>');
      const detail = errs.map((e) => `<div style="color:#c0392b;margin-left:12px;">• ${escapeHtml(e)}</div>`).join('');
      return `<div style="margin-bottom:6px;">${head}${detail}</div>`;
    });
    el.innerHTML = (lastSyncAt ? '' : 'Sin sincronizaciones aún · ') + `Feeds configurados: ${totalFeeds}` +
      (lines.length ? `<div style="margin-top:8px;">${lines.join('')}</div>` : '');
  } catch {
    // No bloquea la página si el status falla
  }
}

document.getElementById('sync-btn').addEventListener('click', async () => {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = 'Sincronizando...';
  showMsg('sync-msg', '', '');
  try {
    const data = await apiFetch('/ical/sync', { method: 'POST' });
    const ok   = data.successfulFeeds ?? '?';
    const fail = data.failedFeeds ?? 0;
    const imp  = data.totalImported ?? 0;
    const results = data.results ?? [];
    const known  = results.reduce((n, r) => n + (r.alreadyKnown ?? 0), 0);
    const upd    = results.reduce((n, r) => n + (r.updated ?? 0), 0);
    const canc   = data.totalCancelled ?? 0;
    const errors = results.flatMap((r) => r.errors ?? []);
    const detail = errors.length
      ? `<br><strong>Eventos con error (${errors.length}):</strong><br>` +
        errors.map((e) => `• ${escapeHtml(e)}`).join('<br>')
      : '';
    showMsg('sync-msg',
      `Sync completada — ${ok} feed(s) OK · ${fail} fallido(s) · ${imp} importado(s) nuevos · ${upd} actualizado(s) · ${canc} cancelado(s) · ${known} ya conocidos.${detail}`,
      errors.length || fail ? 'error' : 'success'
    );
    loadFeeds();
    loadSyncStatus();
  } catch (err) {
    showMsg('sync-msg', escapeHtml(err.message), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⟳ Sincronizar agora todos os feeds';
  }
});

// ── URLs de exportación ──────────────────────────────────────────────────────

async function loadExportURLs() {
  try {
    const data = await apiFetch('/rooms');
    if (PROPERTY_TYPE === 'hostel') { apartmentsCache = []; }
    else if (!apartmentsCache.length) { await loadApartments(); }
    const rooms = [
      ...(PROPERTY_TYPE === 'apartment' ? [] : (data.rooms ?? [])).map((r) => ({ ...r, exportPath: `/api/v1/ical/export/${r.id}` })),
      ...apartmentsCache.map((a) => ({ ...a, name: `${a.name} (apartamento)`, exportPath: `/api/v1/ical/apartment/export/${a.id}`, apartmentId: a.id })),
    ];
    const base = window.location.origin;
    const el = document.getElementById('export-list');
    const tokenData = await apiFetch('/ical/export-token');
    if (!tokenData || !tokenData.token) {
      el.innerHTML = '<p style="color:red;">Falta configurar ICAL_EXPORT_TOKEN en el servidor: sin él los feeds de exportación no responden.</p>';
      return;
    }
    const tokenQs = `?token=${encodeURIComponent(tokenData.token)}`;
    // Token propio de cada apartamento (si no tiene, devuelve el global)
    let aptTokens = {};
    try { aptTokens = (await apiFetch('/ical/apartment-tokens')).tokens || {}; } catch (_) { aptTokens = {}; }

    if (!rooms.length) {
      el.innerHTML = '<p style="color:#888;">Sin habitaciones disponibles.</p>';
      return;
    }

    // Un URL por OTA: cada una omite las reservas que vinieron de ella misma (evita el eco).
    const OTAS = ['booking', 'airbnb'];
    el.innerHTML = rooms.map((r) => `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:10px;">
          <span>${escapeHtml(r.name)}</span>
          ${r.apartmentId ? `<button data-action="regen-token" data-apt="${escapeHtml(r.apartmentId)}" style="font-size:11px;padding:2px 8px;">Regenerar enlace</button>` : ''}
        </div>
        ${OTAS.map((ota) => {
          // Apartamentos: enlace con token y canal en la ruta y terminado en .ics (Booking lo acepta mejor
          // que el que lleva ?query). Hostel: formato anterior.
          const url = r.apartmentId
            ? `${base}/api/v1/ical/apartment/feed/${encodeURIComponent(aptTokens[r.apartmentId] || tokenData.token)}/${r.apartmentId}/${ota}.ics`
            : `${base}${r.exportPath}${tokenQs}&channel=${ota}`;
          return `
          <div style="font-size:12px;margin:6px 0 2px;">Para pegar en ${escapeHtml(PLATFORM_LABELS[ota])}:</div>
          <div data-url="${escapeHtml(url)}" style="display:flex;align-items:center;gap:8px;background:var(--bg,#f5f5f5);border:1px solid #ddd;border-radius:6px;padding:8px 12px;">
            <code style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(url)}</code>
            <button data-action="copy-url" style="white-space:nowrap;font-size:12px;">Copiar</button>
          </div>`;
        }).join('')}
      </div>
    `).join('');

    // onclick="..." en el HTML lo bloquea la CSP del backend (scriptSrc:
    // 'self', sin unsafe-inline) -- el botón "Copiar" nunca funcionó antes.
    el.querySelectorAll('button[data-action="copy-url"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.closest('[data-url]').dataset.url;
        copyToClipboard(url, btn);
      });
    });
    el.querySelectorAll('button[data-action="regen-token"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Regenerar el enlace de este apartamento?\n\nEl enlace actual deja de funcionar: tendrás que pegar el nuevo en Booking y Airbnb.')) { return; }
        btn.disabled = true;
        try {
          await apiFetch(`/ical/apartment/${btn.dataset.apt}/regenerate-token`, { method: 'POST' });
          await loadExportURLs();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    document.getElementById('export-list').innerHTML = `<p style="color:red;">${escapeHtml(err.message)}</p>`;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

// Primero las habitaciones: loadFeeds() las usa para mostrar el nombre en vez del id.
loadRoomOptions().then(loadFeeds);
loadSyncStatus();
loadExportURLs();
