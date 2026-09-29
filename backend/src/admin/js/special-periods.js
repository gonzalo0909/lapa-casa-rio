//
// ?type=hostel|apartment -- misma convención que blocking.js: esta página
// se embebe vía iframe dentro de Habitaciones y de Apartamentos por
// separado, cada una viendo solo sus propias reglas.

requireAuth();
renderNav('special-periods');

const PROPERTY_TYPE = new URLSearchParams(window.location.search).get('type') === 'apartment' ? 'apartment' : 'hostel';

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

function fmtDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function fmtShort(value) {
  const [, m, d] = value.split('-');
  return `${d}/${m}`;
}

async function loadRoomOptions() {
  const units = PROPERTY_TYPE === 'apartment'
    ? (await apiFetch('/admin/room-types')).apartments
    : (await apiFetch('/rooms')).rooms;
  const select = document.getElementById('rule-room');
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
    const today = new Date().toISOString().slice(0, 10);
    holidayPresets = [...thisYear.presets, ...nextYear.presets].filter((p) => p.endDate >= today);
    const select = document.getElementById('rule-holiday');
    select.innerHTML = '<option value="">— Elegir fechas manualmente —</option>'
      + holidayPresets.map((p) =>
          `<option value="${p.key}-${p.startDate.slice(0, 4)}">${p.name} (${fmtShort(p.startDate)}–${fmtShort(p.endDate)})</option>`
        ).join('');
  } catch {
    // el formulario sigue funcionando sin el autocompletado de feriados
  }
}

document.getElementById('rule-holiday').addEventListener('change', (event) => {
  const value = event.target.value;
  if (!value) return;
  const [key, year] = value.split(/-(\d{4})$/);
  const preset = holidayPresets.find((p) => p.key === key && p.startDate.startsWith(year));
  if (!preset) return;
  document.getElementById('rule-start').value = preset.startDate;
  document.getElementById('rule-end').value = preset.endDate;
  if (!document.getElementById('rule-label').value) {
    document.getElementById('rule-label').value = preset.name;
  }
  jumpCalendarTo(preset.startDate);
});

// --- Mini calendario para elegir Desde/Hasta tocando los días ---

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW_NAMES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateStr(value) {
  const [y, m, d] = value.split('-').map(Number);
  return { y, m: m - 1, d };
}

const todayStr = (() => {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
})();

let calMonth = new Date();
calMonth.setDate(1);

function jumpCalendarTo(dateStr) {
  const { y, m } = parseDateStr(dateStr);
  calMonth = new Date(y, m, 1);
  renderCalendar();
}

function renderCalendar() {
  document.getElementById('cal-label').textContent =
    `${MONTH_NAMES[calMonth.getMonth()]} ${calMonth.getFullYear()}`;

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const startDate = document.getElementById('rule-start').value;
  const endDate = document.getElementById('rule-end').value;

  let cells = DOW_NAMES.map((d) => `<div class="mini-cal-dow">${d}</div>`).join('');

  for (let i = 0; i < 42; i++) {
    const dayOffset = i - firstDow;
    let y = year, m = month, d, muted = false;
    if (dayOffset < 0) {
      d = daysInPrevMonth + dayOffset + 1;
      m = month - 1;
      if (m < 0) { m = 11; y = year - 1; }
      muted = true;
    } else if (dayOffset >= daysInMonth) {
      d = dayOffset - daysInMonth + 1;
      m = month + 1;
      if (m > 11) { m = 0; y = year + 1; }
      muted = true;
    } else {
      d = dayOffset + 1;
    }
    const dateStr = toDateStr(y, m, d);

    let cls = 'mini-cal-day';
    if (muted) cls += ' muted';
    if (dateStr === todayStr) cls += ' today';
    if (startDate && endDate && dateStr >= startDate && dateStr <= endDate) cls += ' in-range';
    if (dateStr === startDate || dateStr === endDate) cls += ' range-edge';

    cells += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
  }

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = cells;
  grid.querySelectorAll('.mini-cal-day').forEach((cell) => {
    cell.addEventListener('click', () => onCalendarDayClick(cell.dataset.date));
  });
}

function onCalendarDayClick(dateStr) {
  const startInput = document.getElementById('rule-start');
  const endInput = document.getElementById('rule-end');
  const start = startInput.value;
  const end = endInput.value;

  if (!start || (start && end)) {
    startInput.value = dateStr;
    endInput.value = '';
  } else if (dateStr < start) {
    startInput.value = dateStr;
  } else {
    endInput.value = dateStr;
  }
  renderCalendar();
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth.setMonth(calMonth.getMonth() - 1);
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calMonth.setMonth(calMonth.getMonth() + 1);
  renderCalendar();
});
document.getElementById('rule-start').addEventListener('change', renderCalendar);
document.getElementById('rule-end').addEventListener('change', renderCalendar);

let currentRules = [];

async function loadRules() {
  try {
    const data = await apiFetch(`/admin/special-period-rules?propertyType=${PROPERTY_TYPE}`);
    currentRules = data.rules;
    renderRules(currentRules);
  } catch (err) {
    showMsg('rules-msg', err.message, 'error');
  }
}

function renderRules(rules) {
  const tbody = document.querySelector('#rules-table tbody');
  if (rules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#888;">Sin reglas activas</td></tr>';
    return;
  }
  tbody.innerHTML = rules.map((r) => `
    <tr data-id="${r.id}">
      <td>${r.roomName}</td>
      <td><input type="date" class="row-start" value="${r.startDate}"></td>
      <td><input type="date" class="row-end" value="${r.endDate}"></td>
      <td><input type="number" class="row-minnights" min="1" step="1" value="${r.minNights}" style="width:70px;"></td>
      <td><input type="number" class="row-price" min="0" step="0.01" value="${r.pricePerNight}" style="width:90px;"></td>
      <td><input type="text" class="row-label" value="${r.label || ''}" style="width:130px;"></td>
      <td><button data-action="save">Guardar</button></td>
      <td><button data-action="delete">Quitar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="save"]').forEach((btn) => {
    btn.addEventListener('click', () => saveRow(btn.closest('tr')));
  });
  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteRule(btn.closest('tr').dataset.id));
  });
}

async function saveRow(row) {
  const id = row.dataset.id;
  const startDate = row.querySelector('.row-start').value;
  const endDate = row.querySelector('.row-end').value;
  const minNights = parseInt(row.querySelector('.row-minnights').value, 10);
  const pricePerNight = parseFloat(row.querySelector('.row-price').value);
  const label = row.querySelector('.row-label').value;

  try {
    await apiFetch(`/admin/special-period-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ startDate, endDate, minNights, pricePerNight, label })
    });
    showMsg('rules-msg', 'Regla actualizada.', 'success');
    loadRules();
  } catch (err) {
    showMsg('rules-msg', err.message, 'error');
  }
}

async function deleteRule(id) {
  try {
    await apiFetch(`/admin/special-period-rules/${id}`, { method: 'DELETE' });
    showMsg('rules-msg', 'Regla eliminada.', 'success');
    loadRules();
  } catch (err) {
    showMsg('rules-msg', err.message, 'error');
  }
}

document.getElementById('rule-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const roomTypeId = document.getElementById('rule-room').value;
  const startDate = document.getElementById('rule-start').value;
  const endDate = document.getElementById('rule-end').value;
  const minNights = parseInt(document.getElementById('rule-minnights').value, 10);
  const pricePerNight = parseFloat(document.getElementById('rule-price').value);
  const label = document.getElementById('rule-label').value;

  try {
    await apiFetch('/admin/special-period-rules', {
      method: 'POST',
      body: JSON.stringify({ roomTypeId, startDate, endDate, minNights, pricePerNight, label })
    });
    showMsg('rule-msg', 'Regla creada.', 'success');
    document.getElementById('rule-form').reset();
    renderCalendar();
    loadRules();
  } catch (err) {
    showMsg('rule-msg', err.message, 'error');
  }
});

loadHolidayPresets();
loadRoomOptions();
loadRules();
renderCalendar();
