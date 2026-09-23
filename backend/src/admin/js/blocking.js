//
// ?type=hostel|apartment filtra qué unidades aparecen en el selector --
// esta misma página se embebe (vía iframe) tanto dentro de Habitaciones
// (?type=hostel) como dentro de Apartamentos (?type=apartment). Sin el
// parámetro, muestra hostel por default (uso directo de la página).
//
// El bloqueo es siempre por habitación y por fecha, elegidos a mano --
// "Feriado" solo autocompleta Desde/Hasta/Motivo para no tener que
// calcularlos, no aplica nada por su cuenta a otras habitaciones.

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

// dd/mm, sin año -- para no alargar demasiado las opciones del desplegable de feriados
function fmtShort(value) {
  const [, m, d] = value.split('-');
  return `${d}/${m}`;
}

async function loadRoomOptions() {
  // /rooms (público) ya devuelve solo hostel; /admin/room-types ya devuelve solo apartamentos.
  const units = PROPERTY_TYPE === 'apartment'
    ? (await apiFetch('/admin/room-types')).apartments
    : (await apiFetch('/rooms')).rooms;
  const select = document.getElementById('block-room');
  select.innerHTML = units.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
}

let holidayPresets = [];

async function loadHolidayPresets() {
  const year = new Date().getFullYear();
  try {
    const [thisYear, nextYear] = await Promise.all([
      apiFetch(`/admin/holiday-blocks/presets?year=${year}`),
      apiFetch(`/admin/holiday-blocks/presets?year=${year + 1}`)
    ]);
    holidayPresets = [...thisYear.presets, ...nextYear.presets];
    const select = document.getElementById('block-holiday');
    select.innerHTML = '<option value="">— Elegir fechas manualmente —</option>'
      + holidayPresets.map((p) =>
          `<option value="${p.key}-${p.startDate.slice(0, 4)}">${p.name} (${fmtShort(p.startDate)}–${fmtShort(p.endDate)})</option>`
        ).join('');
  } catch {
    // el formulario sigue funcionando sin el autocompletado de feriados
  }
}

document.getElementById('block-holiday').addEventListener('change', (event) => {
  const value = event.target.value;
  if (!value) return;
  const [key, year] = value.split(/-(\d{4})$/);
  const preset = holidayPresets.find((p) => p.key === key && p.startDate.startsWith(year));
  if (!preset) return;
  document.getElementById('block-start').value = preset.startDate;
  document.getElementById('block-end').value = preset.endDate;
  document.getElementById('block-reason').value = 'seasonal';
});

let currentBlocks = [];

async function loadBlocks() {
  try {
    const data = await apiFetch(`/admin/blocked-dates?propertyType=${PROPERTY_TYPE}`);
    currentBlocks = data.blocks;
    renderBlocks(currentBlocks);
  } catch (err) {
    showMsg('blocks-msg', err.message, 'error');
  }
}

const REASON_OPTIONS = Object.entries(REASON_LABELS)
  .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

function renderBlocks(blocks) {
  const tbody = document.querySelector('#blocks-table tbody');
  if (blocks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#888;">Sin fechas bloqueadas</td></tr>';
    return;
  }
  tbody.innerHTML = blocks.map((b) => `
    <tr data-id="${b.id}">
      <td>${b.roomName}</td>
      <td><input type="date" class="row-start" value="${b.startDate}"></td>
      <td><input type="date" class="row-end" value="${b.endDate}"></td>
      <td>
        <select class="row-blocktype">${REASON_OPTIONS}</select>
        <input type="text" class="row-reason" value="${b.reason || ''}" placeholder="Motivo (texto)" style="margin-top:4px;">
      </td>
      <td><button data-action="save">Guardar</button></td>
      <td><button data-action="unblock">Quitar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach((row) => {
    const block = blocks.find((b) => b.id === row.dataset.id);
    row.querySelector('.row-blocktype').value = block.blockType;
  });

  tbody.querySelectorAll('button[data-action="unblock"]').forEach((btn) => {
    btn.addEventListener('click', () => unblock(btn.closest('tr').dataset.id));
  });
  tbody.querySelectorAll('button[data-action="save"]').forEach((btn) => {
    btn.addEventListener('click', () => saveRow(btn.closest('tr')));
  });
}

async function saveRow(row) {
  const id = row.dataset.id;
  const startDate = row.querySelector('.row-start').value;
  const endDate = row.querySelector('.row-end').value;
  const blockType = row.querySelector('.row-blocktype').value;
  const reason = row.querySelector('.row-reason').value;

  try {
    await apiFetch(`/admin/blocked-dates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ startDate, endDate, blockType, reason })
    });
    showMsg('blocks-msg', 'Bloqueo actualizado.', 'success');
    loadBlocks();
  } catch (err) {
    showMsg('blocks-msg', err.message, 'error');
  }
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
  const holidayValue = document.getElementById('block-holiday').value;
  const holidayPreset = holidayPresets.find((p) => holidayValue === `${p.key}-${p.startDate.slice(0, 4)}`);
  const reason = holidayPreset ? holidayPreset.name : REASON_LABELS[blockType];

  try {
    await apiFetch('/admin/blocked-dates', {
      method: 'POST',
      body: JSON.stringify({ roomTypeId, startDate, endDate, blockType, reason, notes })
    });
    showMsg('block-msg', 'Fechas bloqueadas.', 'success');
    document.getElementById('block-form').reset();
    loadBlocks();
  } catch (err) {
    showMsg('block-msg', err.message, 'error');
  }
});

document.getElementById('block-unblock-btn').addEventListener('click', async () => {
  const roomTypeId = document.getElementById('block-room').value;
  const startDate = document.getElementById('block-start').value;
  const endDate = document.getElementById('block-end').value;

  const matches = currentBlocks.filter((b) =>
    b.roomTypeId === roomTypeId && b.startDate === startDate && b.endDate === endDate
  );

  if (matches.length === 0) {
    showMsg('block-msg', 'No hay un bloqueo con esa habitación y esas fechas exactas -- fijate en "Fechas bloqueadas" abajo y editá la fila correcta directo.', 'error');
    return;
  }

  try {
    for (const match of matches) {
      await apiFetch(`/admin/blocked-dates/${match.id}`, { method: 'DELETE' });
    }
    showMsg('block-msg', 'Bloqueo eliminado.', 'success');
    loadBlocks();
  } catch (err) {
    showMsg('block-msg', err.message, 'error');
  }
});

loadHolidayPresets();
loadRoomOptions();
loadBlocks();
