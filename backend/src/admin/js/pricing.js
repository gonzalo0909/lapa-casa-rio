// lapa-casa-hostel/backend/src/admin/js/pricing.js
// ventana4 (bloque 2)

requireAuth();
renderNav('pricing');

const SEASON_LABELS = { alta: 'Alta (Dic-Mar)', media: 'Media (Abr-May, Oct-Nov)', baja: 'Baja (Jun-Sep)', carnaval: 'Carnaval' };

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

async function loadPricing() {
  try {
    const data = await apiFetch('/admin/pricing');
    renderSeasons(data.ratePlans);
    renderCarnival(data.carnivalDates);
    renderDiscountTiers(data.groupDiscountTiers);
    document.getElementById('surcharge-pct').value = data.cardSurchargePercent;
  } catch (err) {
    showMsg('seasons-msg', err.message, 'error');
  }
}

document.getElementById('surcharge-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const cardSurchargePercent = Number(document.getElementById('surcharge-pct').value);
  try {
    await apiFetch('/admin/pricing', { method: 'PUT', body: JSON.stringify({ cardSurchargePercent }) });
    showMsg('surcharge-msg', 'Recargo por tarjeta actualizado.', 'success');
  } catch (err) {
    showMsg('surcharge-msg', err.message, 'error');
  }
});

function renderDiscountTiers(tiers) {
  const tbody = document.querySelector('#discount-tiers-table tbody');
  const sorted = [...tiers].sort((a, b) => a.min_beds - b.min_beds);
  tbody.innerHTML = sorted.map(t => `
    <tr data-id="${t.id}">
      <td><input type="number" step="1" min="1" class="min-beds" value="${t.min_beds}" style="width:60px;"> personas o más</td>
      <td><input type="number" step="1" min="0" max="99" class="pct" value="${Math.round(t.percentage * 100)}" style="width:60px;">%</td>
      <td><button data-action="save-tier">Guardar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="save-tier"]').forEach(btn => {
    btn.addEventListener('click', () => saveDiscountTier(btn.closest('tr')));
  });
}

async function saveDiscountTier(row) {
  const id = row.dataset.id;
  const minBeds = Number(row.querySelector('.min-beds').value);
  const percentage = Number(row.querySelector('.pct').value) / 100;
  try {
    await apiFetch(`/admin/group-discount-tiers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ minBeds, percentage })
    });
    showMsg('discount-tiers-msg', 'Tramo de descuento actualizado.', 'success');
    loadPricing();
  } catch (err) {
    showMsg('discount-tiers-msg', err.message, 'error');
  }
}

function renderSeasons(ratePlans) {
  const tbody = document.querySelector('#seasons-table tbody');
  tbody.innerHTML = ratePlans.map(p => `
    <tr data-season="${p.season_type}">
      <td>${SEASON_LABELS[p.season_type] || p.season_type}</td>
      <td><input type="number" step="0.01" class="multiplier" value="${p.multiplier}" style="width:80px;"></td>
      <td><input type="number" step="1" class="min-nights" value="${p.min_nights}" style="width:60px;"></td>
      <td><button data-action="save-season">Guardar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="save-season"]').forEach(btn => {
    btn.addEventListener('click', () => saveSeason(btn.closest('tr')));
  });
}

async function saveSeason(row) {
  const seasonType = row.dataset.season;
  const multiplier = Number(row.querySelector('.multiplier').value);
  const minNights = Number(row.querySelector('.min-nights').value);
  try {
    await apiFetch('/admin/pricing', { method: 'PUT', body: JSON.stringify({ seasonType, multiplier, minNights }) });
    showMsg('seasons-msg', `Temporada "${SEASON_LABELS[seasonType] || seasonType}" actualizada.`, 'success');
  } catch (err) {
    showMsg('seasons-msg', err.message, 'error');
  }
}

function renderCarnival(dates) {
  const tbody = document.querySelector('#carnival-table tbody');
  const sorted = [...dates].sort((a, b) => a.year - b.year);
  tbody.innerHTML = sorted.map(d => `
    <tr><td>${d.year}</td><td>${fmtDate(d.start_date)}</td><td>${fmtDate(d.end_date)}</td></tr>
  `).join('') || '<tr><td colspan="3" style="color:#888;">Sin fechas cargadas</td></tr>';
}

document.getElementById('carnival-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const year = Number(document.getElementById('carnival-year').value);
  const startDate = document.getElementById('carnival-start').value;
  const endDate = document.getElementById('carnival-end').value;

  try {
    await apiFetch('/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify({ carnival: { year, startDate, endDate } })
    });
    showMsg('carnival-msg', `Carnaval ${year} guardado.`, 'success');
    loadPricing();
  } catch (err) {
    showMsg('carnival-msg', err.message, 'error');
  }
});

loadPricing();
