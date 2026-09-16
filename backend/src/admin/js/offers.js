// lapa-casa-hostel/backend/src/admin/js/offers.js
//
// Antes vivía como <script> inline dentro de offers.html, con botones
// onclick="..." -- ambas cosas las bloquea la CSP del backend (scriptSrc:
// 'self', sin unsafe-inline): ni el script arrancaba ni los onclick
// disparaban nada. Reescrito como archivo externo con addEventListener +
// data-action, mismo patrón que blocking.js/gallery.js.
//
// ?type=hostel|apartment -- esta página se embebe (vía iframe) tanto
// dentro de Habitaciones (?type=hostel) como dentro de Apartamentos
// (?type=apartment). Sin el parámetro, apartment por default (uso
// directo de la página, como era originalmente).

const PROPERTY_TYPE = new URLSearchParams(window.location.search).get('type') === 'hostel' ? 'hostel' : 'apartment';

let offersData = [];
let unitList = [];

async function loadUnits() {
  // /rooms (público) ya devuelve solo hostel; /admin/room-types ya devuelve solo apartamentos.
  unitList = PROPERTY_TYPE === 'hostel'
    ? (await apiFetch('/rooms')).rooms
    : (await apiFetch('/admin/room-types')).apartments;
}

function renderAptChecks(apts) {
  document.getElementById('apt-checks').innerHTML = apts.map(a =>
    `<label><input type="checkbox" class="apt-cb" value="${escapeHtml(a.id)}" checked> ${escapeHtml(a.label)}</label>`
  ).join('');
}

async function loadOffers() {
  try {
    const all = await apiFetch('/admin/offers') || [];
    const unitIds = new Set(unitList.map(u => u.id));
    // Solo ofertas que incluyen al menos una unidad de este tipo de propiedad
    // (o sin unidades específicas -- huérfanas de antes de este cambio, no aplican a nada real).
    offersData = all.filter(o => (o.apartment_ids || []).some(id => unitIds.has(id)));
    renderTable();
  } catch (e) {
    showMsg(document.getElementById('list-msg'), e.message, 'err');
  }
}

function renderTable() {
  const tbody = document.querySelector('#offers-table tbody');
  if (!offersData.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#888">Sin ofertas creadas</td></tr>';
    return;
  }
  tbody.innerHTML = offersData.map(o => `
    <tr data-id="${o.id}">
      <td><span class="code-chip">${escapeHtml(o.code)}</span></td>
      <td>${escapeHtml(o.label || '—')}</td>
      <td><b>${o.discount_percent}%</b></td>
      <td>${o.valid_from ? fmtDate(o.valid_from) : '—'}</td>
      <td>${o.valid_to   ? fmtDate(o.valid_to)   : '—'}</td>
      <td><span class="badge ${o.is_active ? 'badge-green' : 'badge-gray'}">${o.is_active ? 'Activa' : 'Inactiva'}</span></td>
      <td class="row-actions">
        <button data-action="edit">Editar</button>
        <button class="danger" data-action="delete">Eliminar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => editOffer(btn.closest('tr').dataset.id));
  });
  tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteOffer(btn.closest('tr').dataset.id));
  });
}

function editOffer(id) {
  const o = offersData.find(x => x.id === id);
  if (!o) return;
  document.getElementById('of-editing-id').value = id;
  document.getElementById('of-code').value     = o.code;
  document.getElementById('of-label').value    = o.label || '';
  document.getElementById('of-discount').value = o.discount_percent;
  document.getElementById('of-from').value     = o.valid_from?.slice(0, 10) || '';
  document.getElementById('of-to').value       = o.valid_to?.slice(0, 10)   || '';
  document.getElementById('of-active').checked = !!o.is_active;
  const ids = o.apartment_ids || [];
  document.querySelectorAll('.apt-cb').forEach(cb => {
    cb.checked = ids.length === 0 || ids.includes(cb.value);
  });
  document.getElementById('form-title').textContent = '✏️ Editar oferta';
}

function resetForm() {
  document.getElementById('of-editing-id').value = '';
  document.getElementById('of-code').value     = '';
  document.getElementById('of-label').value    = '';
  document.getElementById('of-discount').value = '';
  document.getElementById('of-from').value     = '';
  document.getElementById('of-to').value       = '';
  document.getElementById('of-active').checked = true;
  document.querySelectorAll('.apt-cb').forEach(cb => { cb.checked = true; });
  document.getElementById('form-title').textContent = '+ Nueva oferta';
  showMsg(document.getElementById('form-msg'), '', '');
}

async function saveOffer() {
  const msg = document.getElementById('form-msg');
  const editId = document.getElementById('of-editing-id').value;
  const aptIds = Array.from(document.querySelectorAll('.apt-cb:checked')).map(cb => cb.value);
  // Campos en camelCase -- el backend (CreateOfferSchema/UpdateOfferSchema
  // en admin.routes.ts) los espera así. Antes se mandaban en snake_case y
  // la validación Zod los rechazaba siempre (discountPercent llegaba
  // undefined): crear una oferta nunca funcionó.
  const body = {
    code:            document.getElementById('of-code').value.toUpperCase(),
    label:           document.getElementById('of-label').value,
    discountPercent: +document.getElementById('of-discount').value,
    validFrom:       document.getElementById('of-from').value || null,
    validTo:         document.getElementById('of-to').value   || null,
    apartmentIds:    aptIds,
    isActive:        document.getElementById('of-active').checked,
  };
  if (!body.code || !body.discountPercent) {
    return showMsg(msg, 'Código y descuento son obligatorios', 'err');
  }
  try {
    if (editId) {
      await apiFetch(`/admin/offers/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/admin/offers', { method: 'POST', body: JSON.stringify(body) });
    }
    showMsg(msg, '✅ Guardado', 'ok');
    resetForm();
    await loadOffers();
  } catch (e) {
    showMsg(msg, e.message, 'err');
  }
}

async function deleteOffer(id) {
  if (!confirm('¿Eliminar esta oferta?')) return;
  try {
    await apiFetch(`/admin/offers/${id}`, { method: 'DELETE' });
    await loadOffers();
  } catch (e) {
    showMsg(document.getElementById('list-msg'), e.message, 'err');
  }
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + (type || '');
  if (!type) el.style.display = 'none';
}

document.getElementById('save-offer-btn').addEventListener('click', saveOffer);
document.getElementById('cancel-offer-btn').addEventListener('click', resetForm);

(async () => {
  await requireAuth();
  renderNav('offers');
  document.getElementById('page-heading').textContent = PROPERTY_TYPE === 'hostel' ? '🏷️ Ofertas de Habitaciones' : '🏷️ Ofertas de Apartamentos';
  document.getElementById('units-label').textContent = PROPERTY_TYPE === 'hostel' ? 'Cuartos incluidos' : 'Apartamentos incluidos';
  await loadUnits();
  renderAptChecks(unitList.map(u => ({ id: u.id, label: u.name })));
  await loadOffers();
})();
