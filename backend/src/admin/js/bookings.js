// lapa-casa-hostel/backend/src/admin/js/bookings.js
// ventana4 (bloque 2)

requireAuth();
renderNav('bookings');

const state = { page: 1, limit: 20, total: 0, sortKey: null, sortDir: 1, rows: [] };

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

function currentFilters() {
  return {
    status: document.getElementById('filter-status').value,
    from: document.getElementById('filter-from').value,
    to: document.getElementById('filter-to').value
  };
}

async function loadBookings() {
  try {
    const f = currentFilters();
    const params = new URLSearchParams({ page: state.page, limit: state.limit });
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
      <td>${b.reservation_number}</td>
      <td>${b.guest_name}<br><small style="color:#888;">${b.guest_email}</small></td>
      <td>${fmtDate(b.check_in_date)}</td>
      <td>${fmtDate(b.check_out_date)}</td>
      <td>${b.beds_count}</td>
      <td>${fmtCurrency(b.final_price)}</td>
      <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      <td>
        <button data-action="edit" data-id="${b.id}">Editar</button>
        <button data-action="resend" data-id="${b.id}">Reenviar email</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="color:#888;">Sin reservas para estos filtros</td></tr>';

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => openEdit(btn.dataset.id))
  );
  tbody.querySelectorAll('button[data-action="resend"]').forEach(btn =>
    btn.addEventListener('click', () => resendConfirmation(btn.dataset.id))
  );
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
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-notes').value = '';
  document.getElementById('edit-price').value = booking.final_price;
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

document.getElementById('filter-apply').addEventListener('click', () => { state.page = 1; loadBookings(); });
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
  const notes = document.getElementById('edit-notes').value;
  const price = document.getElementById('edit-price').value;

  const payload = {};
  if (notes) payload.specialRequests = notes;
  if (price) payload.finalPrice = Number(price);

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
