// lapa-casa-hostel/backend/src/admin/js/ical.js

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

// ── Cargar habitaciones para el select ──────────────────────────────────────

async function loadRoomOptions() {
  try {
    const data = await apiFetch('/rooms');
    const select = document.getElementById('feed-room');
    select.innerHTML = (data.rooms ?? []).map(
      (r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`
    ).join('');
  } catch {
    document.getElementById('feed-room').innerHTML = '<option value="">Error al cargar habitaciones</option>';
  }
}

// ── Feeds ────────────────────────────────────────────────────────────────────

async function loadFeeds() {
  try {
    const data = await apiFetch('/ical/feeds');
    renderFeeds(data.feeds ?? []);
  } catch (err) {
    showMsg('feeds-msg', err.message, 'error');
  }
}

function renderFeeds(feeds) {
  const tbody = document.querySelector('#feeds-table tbody');
  if (!feeds.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#888;">Sin feeds configurados</td></tr>';
    return;
  }
  tbody.innerHTML = feeds.map((f) => `
    <tr data-id="${f.id}">
      <td>${escapeHtml(PLATFORM_LABELS[f.channelCode] ?? f.channelCode)}</td>
      <td>${escapeHtml(f.roomName ?? f.roomTypeId)}</td>
      <td style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(f.url)}">${escapeHtml(f.url)}</td>
      <td><span class="badge ${f.isActive ? 'confirmed' : 'cancelled'}">${f.isActive ? 'Activo' : 'Inactivo'}</span></td>
      <td><button data-action="delete-feed">Quitar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="delete-feed"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteFeed(btn.closest('tr').dataset.id));
  });
}

async function deleteFeed(id) {
  if (!confirm('¿Eliminar este feed? Dejará de sincronizarse.')) return;
  try {
    await apiFetch(`/ical/feeds/${id}`, { method: 'DELETE' });
    showMsg('feeds-msg', 'Feed eliminado.', 'success');
    loadFeeds();
  } catch (err) {
    showMsg('feeds-msg', err.message, 'error');
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
    showMsg('add-msg', err.message, 'error');
  }
});

// ── Sync manual ──────────────────────────────────────────────────────────────

async function loadSyncStatus() {
  try {
    const data = await apiFetch('/ical/status');
    const el = document.getElementById('sync-status');
    if (data) {
      el.textContent = [
        data.lastSync   ? `Última sync: ${fmtDate(data.lastSync)}` : null,
        data.totalFeeds !== undefined ? `Feeds activos: ${data.totalFeeds}` : null,
      ].filter(Boolean).join(' · ');
    }
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
    showMsg('sync-msg',
      `Sync completada — ${ok} feed(s) OK · ${fail} error(es) · ${imp} bloqueo(s) importado(s).`,
      'success'
    );
    loadFeeds();
    loadSyncStatus();
  } catch (err) {
    showMsg('sync-msg', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⟳ Sincronizar agora todos os feeds';
  }
});

// ── URLs de exportación ──────────────────────────────────────────────────────

async function loadExportURLs() {
  try {
    const data = await apiFetch('/rooms');
    const rooms = data.rooms ?? [];
    const base = window.location.origin;
    const el = document.getElementById('export-list');

    if (!rooms.length) {
      el.innerHTML = '<p style="color:#888;">Sin habitaciones disponibles.</p>';
      return;
    }

    el.innerHTML = rooms.map((r) => {
      const url = `${base}/api/v1/ical/export/${r.id}`;
      return `
        <div style="margin-bottom:14px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${escapeHtml(r.name)}</div>
          <div style="display:flex;align-items:center;gap:8px;background:var(--bg,#f5f5f5);border:1px solid #ddd;border-radius:6px;padding:8px 12px;">
            <code style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(url)}</code>
            <button onclick="copyToClipboard('${escapeHtml(url)}', this)" style="white-space:nowrap;font-size:12px;">Copiar</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('export-list').innerHTML = `<p style="color:red;">${escapeHtml(err.message)}</p>`;
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard?.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {
    prompt('Copiá esta URL:', text);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

loadRoomOptions();
loadFeeds();
loadSyncStatus();
loadExportURLs();
