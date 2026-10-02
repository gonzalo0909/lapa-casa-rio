
requireAuth();
renderNav('bookings');

// ?type=hostel|apartment: cuando la página se embebe dentro de Hostel o de Apartamentos
// (rooms.html / apartments.html) muestra solo las reservas de ese tipo.
const PROPERTY_TYPE = (() => {
  const t = new URLSearchParams(window.location.search).get('type');
  return t === 'hostel' || t === 'apartment' ? t : '';
})();

const state = { page: 1, limit: 20, total: 0, sortKey: null, sortDir: 1, rows: [] };

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

// Hostel y apartamentos comparten esta misma tabla (property_type +
// unit_names vienen del join agregado en GET /admin/bookings) -- sin
// esto no había forma de saber, mirando la lista, de cuál se trataba.
function propertyTypeCell(b) {
  const label = b.property_type === 'apartment' ? 'Apartamento' : b.property_type === 'hostel' ? 'Hostel' : '—';
  const names = b.unit_names ? escapeHtml(b.unit_names) : '';
  return names
    ? `<strong>${names}</strong><br><small style="color:#888;">${label}</small>`
    : label;
}

const CHANNEL_LABELS = { direct: 'Directo', booking: 'Booking.com', airbnb: 'Airbnb', hostelworld: 'Hostelworld', expedia: 'Expedia' };
function channelCell(b) {
  const label = escapeHtml(CHANNEL_LABELS[b.channel_code] || b.channel_code || '—');
  return b.channel_code && b.channel_code !== 'direct'
    ? `<span class="badge" style="background:#e6eefc;color:#2c5cc5;">${label}</span>`
    : label;
}

function nightsOf(b) {
  const a = Date.parse(String(b.check_in_date).slice(0, 10));
  const z = Date.parse(String(b.check_out_date).slice(0, 10));
  return Math.max(1, Math.round((z - a) / 86400000));
}

// Las reservas importadas por iCal traen un correo inventado (ota_xxx@booking.import):
// no se muestra, no es un dato real del huésped.
function guestCell(b) {
  // Reservas de OTA: el iCal no trae el huesped; si el admin cargo un nombre, se muestra.
  const placeholderName = /\(iCal\)$|^OTA Guest$/i.test(b.guest_name || '');
  if (/\.import$/i.test(b.guest_email || '') && placeholderName) {
    return `<span style="color:#888;">Sin datos del huésped</span><br><small style="color:#888;">el iCal de ${escapeHtml(CHANNEL_LABELS[b.channel_code] || b.channel_code)} no los incluye</small>`;
  }
  return `${escapeHtml(b.guest_name)}<br><small style="color:#888;">${escapeHtml(b.guest_email)}</small>`;
}

function stayCell(b) {
  const n = nightsOf(b);
  const beds = b.property_type === 'apartment' ? '' : ` · ${b.beds_count} cama${b.beds_count === 1 ? '' : 's'}`;
  return `${fmtDate(b.check_in_date)} → ${fmtDate(b.check_out_date)}<br><small style="color:#888;">${n} noche${n === 1 ? '' : 's'}${beds}</small>`;
}

function actionsCell(b) {
  const isOta = b.channel_code && b.channel_code !== 'direct';
  // Una reserva de OTA se puede completar/corregir aca, pero cancelarla libera fechas en Lapa:
  // si sigue vigente en la OTA, esas fechas se podrian vender dos veces (el confirm lo advierte).
  return `
        <button data-action="edit" data-id="${b.id}">Editar</button>
        ${isOta ? '' : `<button data-action="resend" data-id="${b.id}">Reenviar email</button>`}
        ${b.status !== 'cancelled' ? `<button data-action="cancel" data-id="${b.id}" data-num="${b.reservation_number}" data-ota="${isOta ? CHANNEL_LABELS[b.channel_code] || b.channel_code : ''}" style="background:#c0392b;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Cancelar</button>` : ''}`;
}

function currentFilters() {
  return {
    q: document.getElementById('filter-q').value.trim(),
    channel: document.getElementById('filter-channel').value,
    status: document.getElementById('filter-status').value,
    from: document.getElementById('filter-from').value,
    to: document.getElementById('filter-to').value
  };
}

async function loadBookings() {
  try {
    const f = currentFilters();
    const params = new URLSearchParams({ page: state.page, limit: state.limit });
    if (PROPERTY_TYPE) params.set('type', PROPERTY_TYPE);
    if (f.q) params.set('q', f.q);
    if (f.channel) params.set('channel', f.channel);
    if (f.status) params.set('status', f.status);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);

    const data = await apiFetch(`/admin/bookings?${params.toString()}`);
    state.rows = data.bookings;
    state.total = data.pagination.total;
    renderTable();
    renderPagination();
  } catch (err) {
    showMsg('bookings-msg', err.message, 'error');
  }
}

function renderTable() {
  let rows = [...state.rows];
  if (state.sortKey) {
    rows.sort((a, b) => {
      const va = a[state.sortKey], vb = b[state.sortKey];
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * state.sortDir;
    });
  }

  const tbody = document.querySelector('#bookings-table tbody');
  tbody.innerHTML = rows.map(b => `
    <tr>
      <td style="white-space:nowrap">${escapeHtml(b.reservation_number)}</td>
      <td>${channelCell(b)}</td>
      <td>${propertyTypeCell(b)}</td>
      <td>${guestCell(b)}</td>
      <td style="white-space:nowrap">${stayCell(b)}</td>
      <td>${b.channel_code && b.channel_code !== 'direct' ? '<span title="El iCal de la OTA no trae precio" style="color:#888">—</span>' : fmtCurrency(b.final_price)}</td>
      <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      <td>${actionsCell(b)}</td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="color:#888;">Sin reservas para estos filtros</td></tr>';

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => openEdit(btn.dataset.id))
  );
  tbody.querySelectorAll('button[data-action="resend"]').forEach(btn =>
    btn.addEventListener('click', () => resendConfirmation(btn.dataset.id))
  );
  tbody.querySelectorAll('button[data-action="cancel"]').forEach(btn =>
    btn.addEventListener('click', () => cancelBooking(btn.dataset.id, btn.dataset.num, btn.dataset.ota))
  );
}

async function cancelBooking(id, num, ota) {
  const warning = ota
    ? `¿Cancelar la reserva ${num}?\n\nOJO: es una reserva de ${ota}. Cancelarla acá libera esas fechas en Lapa; si sigue vigente en ${ota}, se podrían vender dos veces.\n\nEsta acción no se puede deshacer.`
    : `¿Cancelar la reserva ${num}? Esta acción no se puede deshacer.`;
  if (!confirm(warning)) return;
  try {
    await apiFetch(`/admin/bookings/${id}`, { method: 'DELETE' });
    showMsg('bookings-msg', `Reserva ${num} cancelada.`, 'success');
    loadBookings();
  } catch (err) {
    showMsg('bookings-msg', err.message, 'error');
  }
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
  document.getElementById('page-info').textContent = `Página ${state.page} de ${totalPages} (${state.total} reservas)`;
  document.getElementById('page-prev').disabled = state.page <= 1;
  document.getElementById('page-next').disabled = state.page >= totalPages;
}

function openEdit(id) {
  const booking = state.rows.find(b => b.id === id);
  if (!booking) return;
  const isApartment = booking.property_type === 'apartment';
  const placeholder = /\(iCal\)$|^OTA Guest$/i.test(booking.guest_name || '');
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-guest-name').value = placeholder ? '' : (booking.guest_name || '');
  document.getElementById('edit-guest-phone').value = booking.guest_phone || '';
  document.getElementById('edit-notes').value = booking.special_requests || '';
  document.getElementById('edit-price').value = booking.final_price;
  const ci = document.getElementById('edit-checkin');
  const co = document.getElementById('edit-checkout');
  ci.value = String(booking.check_in_date).slice(0, 10);
  co.value = String(booking.check_out_date).slice(0, 10);
  ci.disabled = co.disabled = !isApartment;
  document.getElementById('edit-dates-hint').textContent = isApartment
    ? ''
    : 'Las fechas solo se pueden cambiar en reservas de apartamento. En el hostel: cancelar y crear una nueva.';
  document.getElementById('edit-msg').innerHTML = '';
  document.getElementById('edit-panel').classList.remove('hidden');
  document.getElementById('edit-panel').scrollIntoView({ behavior: 'smooth' });
}

async function resendConfirmation(id) {
  try {
    await apiFetch(`/admin/bookings/${id}/resend-confirmation`, { method: 'POST' });
    showMsg('bookings-msg', 'Email de confirmación reenviado.', 'success');
  } catch (err) {
    showMsg('bookings-msg', err.message, 'error');
  }
}

document.getElementById('filter-clear').addEventListener('click', () => {
  ['filter-q', 'filter-channel', 'filter-status', 'filter-from', 'filter-to'].forEach((id) => { document.getElementById(id).value = ''; });
  state.page = 1;
  loadBookings();
});
document.getElementById('filter-apply').addEventListener('click', () => { state.page = 1; loadBookings(); });
document.getElementById('filter-q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { state.page = 1; loadBookings(); }
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
  const f = currentFilters();
  const params = new URLSearchParams();
  if (f.status) params.set('status', f.status);
  if (f.from)   params.set('from',   f.from);
  if (f.to)     params.set('to',     f.to);
  // El servidor responde con Content-Disposition: attachment,
  // el browser descarga el archivo sin navegar fuera de la pagina.
  window.location.href = '/api/v1/admin/bookings/export?' + params.toString();
});
document.getElementById('page-prev').addEventListener('click', () => { if (state.page > 1) { state.page--; loadBookings(); } });
document.getElementById('page-next').addEventListener('click', () => { state.page++; loadBookings(); });

document.querySelectorAll('#bookings-table th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    state.sortDir = state.sortKey === key ? -state.sortDir : 1;
    state.sortKey = key;
    renderTable();
  });
});

document.getElementById('edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('edit-id').value;
  const booking = state.rows.find(b => b.id === id);
  const guestName = document.getElementById('edit-guest-name').value.trim();
  const guestPhone = document.getElementById('edit-guest-phone').value.trim();
  const notes = document.getElementById('edit-notes').value;
  const price = document.getElementById('edit-price').value;
  const checkIn = document.getElementById('edit-checkin');
  const checkOut = document.getElementById('edit-checkout');

  const payload = {};
  if (notes) payload.specialRequests = notes;
  if (price) payload.finalPrice = Number(price);
  if (guestName || guestPhone) {
    payload.guest = {};
    if (guestName) payload.guest.fullName = guestName;
    if (guestPhone) payload.guest.phone = guestPhone;
  }
  // Solo se mandan las fechas si cambiaron (y el campo esta habilitado: reservas de apartamento).
  if (!checkIn.disabled && booking) {
    if (checkIn.value && checkIn.value !== String(booking.check_in_date).slice(0, 10)) payload.checkIn = checkIn.value;
    if (checkOut.value && checkOut.value !== String(booking.check_out_date).slice(0, 10)) payload.checkOut = checkOut.value;
  }

  try {
    await apiFetch(`/admin/bookings/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    showMsg('edit-msg', 'Reserva actualizada.', 'success');
    // El panel se queda abierto mostrando el mensaje -- esconderlo en el
    // mismo tick que se pinta el mensaje lo dejaba invisible siempre.
    loadBookings();
  } catch (err) {
    showMsg('edit-msg', err.message, 'error');
  }
});

loadBookings();
