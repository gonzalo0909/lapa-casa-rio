// lapa-casa-hostel/backend/src/admin/js/blocking.js
//
// ?type=hostel|apartment filtra qué unidades aparecen en el selector --
// esta misma página se embebe (vía iframe) tanto dentro de Habitaciones
// (?type=hostel) como dentro de Apartamentos (?type=apartment). Sin el
// parámetro, muestra hostel por default (uso directo de la página).

requireAuth();
renderNav('blocking');

const REASON_LABELS = { maintenance: 'Mantenimiento', owner: 'Reserva del propietario', seasonal: 'Sazonalidade', other: 'Otro' };
const PROPERTY_TYPE = new URLSearchParams(window.location.search).get('type') === 'apartment' ? 'apartment' : 'hostel';

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

function fmtDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

async function loadRoomOptions() {
  // /rooms (público) ya devuelve solo hostel; /admin/room-types ya devuelve solo apartamentos.
  const units = PROPERTY_TYPE === 'apartment'
    ? (await apiFetch('/admin/room-types')).apartments
    : (await apiFetch('/rooms')).rooms;
  const select = document.getElementById('block-room');
  select.innerHTML = units.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
}

async function loadBlocks() {
  try {
    const data = await apiFetch('/admin/blocked-dates');
    renderBlocks(data.blocks);
  } catch (err) {
    showMsg('blocks-msg', err.message, 'error');
  }
}

function renderBlocks(blocks) {
  const tbody = document.querySelector('#blocks-table tbody');
  if (blocks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#888;">Sin fechas bloqueadas</td></tr>';
    return;
  }
  tbody.innerHTML = blocks.map((b) => `
    <tr data-id="${b.id}">
      <td>${b.roomName}</td>
      <td>${fmtDate(b.startDate)}</td>
      <td>${fmtDate(b.endDate)}</td>
      <td>${b.reason || REASON_LABELS[b.blockType] || b.blockType}${b.notes ? ` — ${b.notes}` : ''}</td>
      <td><button data-action="unblock">Quitar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="unblock"]').forEach((btn) => {
    btn.addEventListener('click', () => unblock(btn.closest('tr').dataset.id));
  });
}

async function unblock(id) {
  try {
    await apiFetch(`/admin/blocked-dates/${id}`, { method: 'DELETE' });
    showMsg('blocks-msg', 'Bloqueo eliminado.', 'success');
    loadBlocks();
  } catch (err) {
    showMsg('blocks-msg', err.message, 'error');
  }
}

document.getElementById('block-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const roomTypeId = document.getElementById('block-room').value;
  const startDate = document.getElementById('block-start').value;
  const endDate = document.getElementById('block-end').value;
  const blockType = document.getElementById('block-reason').value;
  const notes = document.getElementById('block-notes').value;

  try {
    await apiFetch('/admin/blocked-dates', {
      method: 'POST',
      body: JSON.stringify({ roomTypeId, startDate, endDate, blockType, reason: REASON_LABELS[blockType], notes })
    });
    showMsg('block-msg', 'Fechas bloqueadas.', 'success');
    document.getElementById('block-form').reset();
    loadBlocks();
  } catch (err) {
    showMsg('block-msg', err.message, 'error');
  }
});

loadRoomOptions();
loadBlocks();
