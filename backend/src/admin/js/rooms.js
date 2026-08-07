// lapa-casa-hostel/backend/src/admin/js/rooms.js
// ventana4 (bloque 2)

requireAuth();
renderNav('rooms');

function showMsg(text, type) {
  document.getElementById('rooms-msg').innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

async function loadRooms() {
  try {
    const data = await apiFetch('/rooms');
    renderRooms(data.rooms);
  } catch (err) {
    showMsg(err.message, 'error');
  }
}

function renderRooms(rooms) {
  const list = document.getElementById('room-list');
  list.innerHTML = rooms.map(r => `
    <div class="room-row" data-id="${r.id}">
      <div>
        <div class="name">${r.name}</div>
        <div class="meta">${r.capacity} camas · ${r.code}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <label style="font-size:13px;">
          <input type="checkbox" class="is-flexible" ${r.isFlexible ? 'checked' : ''}> Flexible
        </label>
        <label style="font-size:13px;">R$/cama <input type="number" step="1" class="base-price" value="${r.basePrice}" style="width:70px;"></label>
        <label style="font-size:13px;" title="A partir de cuantas camas se aplica el descuento por grupo, para este cuarto">
          Descuento desde <input type="number" step="1" min="1" class="discount-min-beds" value="${r.groupDiscountMinBeds}" style="width:50px;"> camas
        </label>
        <label style="font-size:13px;" title="Porcentaje de descuento aplicado desde esa cantidad de camas">
          <input type="number" step="1" min="0" max="99" class="discount-pct" value="${Math.round(r.groupDiscountPercentage * 100)}" style="width:50px;">%
        </label>
        <button data-action="save">Guardar</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('button[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', () => saveRoom(btn.closest('.room-row')));
  });
}

async function saveRoom(row) {
  const id = row.dataset.id;
  const basePrice = Number(row.querySelector('.base-price').value);
  const isFlexible = row.querySelector('.is-flexible').checked;
  const groupDiscountMinBeds = Number(row.querySelector('.discount-min-beds').value);
  const groupDiscountPercentage = Number(row.querySelector('.discount-pct').value) / 100;

  try {
    await apiFetch(`/admin/rooms/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ basePrice, isFlexible, groupDiscountMinBeds, groupDiscountPercentage })
    });
    showMsg('Habitación actualizada.', 'success');
  } catch (err) {
    showMsg(err.message, 'error');
  }
}

loadRooms();
