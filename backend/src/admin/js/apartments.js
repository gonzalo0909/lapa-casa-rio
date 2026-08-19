// lapa-casa-hostel/backend/src/admin/js/apartments.js

let currentAptId = null;

async function loadApartments() {
  const res = await apiFetch('/admin/room-types');
  const apts = res.data?.apartments ?? [];
  const container = document.getElementById('apt-list');
  if (!apts.length) { container.textContent = 'Sin apartamentos'; return; }
  container.innerHTML = '';
  apts.forEach(apt => {
    const btn = document.createElement('button');
    btn.className = 'apt-btn';
    btn.dataset.id = apt.id;
    btn.innerHTML = `
      <span>
        <strong>${apt.name}</strong>
        <span style="font-size:.75rem;color:#888;display:block">${apt.code} · ${apt.capacity} huésp.</span>
      </span>
      <span class="badge ${apt.photo_count > 0 ? 'badge-ok' : 'badge-empty'}" id="badge-${apt.id}">
        ${apt.photo_count} foto${apt.photo_count !== 1 ? 's' : ''}
      </span>`;
    btn.addEventListener('click', () => selectApt(apt));
    container.appendChild(btn);
  });
}

async function selectApt(apt) {
  currentAptId = apt.id;
  document.querySelectorAll('.apt-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.apt-btn[data-id="${apt.id}"]`)?.classList.add('active');
  document.getElementById('photo-panel').style.display = '';
  document.getElementById('photo-panel-title').textContent = `📸 ${apt.name}`;
  await loadPhotos();
}

async function loadPhotos() {
  if (!currentAptId) return;
  const res = await apiFetch(`/admin/room-types/${currentAptId}/photos`);
  renderPhotos(res.data?.photos ?? []);
}

function renderPhotos(photos) {
  const grid = document.getElementById('photo-grid');
  if (!photos.length) { grid.innerHTML = '<p style="font-size:.85rem;color:#888;font-style:italic">Sin fotos. Subí la primera usando el formulario de arriba.</p>'; return; }
  grid.innerHTML = '';
  photos.forEach(p => {
    const card = document.createElement('div');
    card.className = `photo-card${p.is_primary ? ' primary' : ''}`;
    card.innerHTML = `
      <img src="${p.image_url}" alt="${p.alt_text || 'foto'}">
      <div class="actions">
        ${p.is_primary
          ? '<span class="btn-primary-label">★ Principal</span>'
          : `<button class="btn-set-primary" onclick="setPrimary('${p.id}')">Hacer principal</button>`
        }
        <button class="btn-delete" onclick="deletePhoto('${p.id}')">Eliminar</button>
      </div>`;
    grid.appendChild(card);
  });
}

async function setPrimary(photoId) {
  await apiFetch(`/admin/room-types/photos/${photoId}`, { method: 'PATCH', body: JSON.stringify({ isPrimary: true }) });
  showMsg('apt-msg', 'Foto principal actualizada', true);
  await loadPhotos();
}

async function deletePhoto(photoId) {
  if (!confirm('¿Eliminar esta foto?')) return;
  await apiFetch(`/admin/room-types/photos/${photoId}`, { method: 'DELETE' });
  showMsg('apt-msg', 'Foto eliminada', true);
  await loadPhotos();
  await loadApartments();
}

document.getElementById('upload-btn').addEventListener('click', async () => {
  const file = document.getElementById('photo-file').files[0];
  if (!file || !currentAptId) { showMsg('upload-msg', 'Seleccioná un archivo y un apartamento', false); return; }
  const formData = new FormData();
  formData.append('photo', file);
  document.getElementById('upload-btn').textContent = 'Subiendo…';
  try {
    await fetch(`/api/v1/admin/room-types/${currentAptId}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    showMsg('upload-msg', 'Foto subida', true);
    document.getElementById('photo-file').value = '';
    await loadPhotos();
    await loadApartments();
  } catch {
    showMsg('upload-msg', 'Error al subir', false);
  } finally {
    document.getElementById('upload-btn').textContent = '+ Subir foto';
  }
});

function showMsg(id, text, ok) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.cssText = `padding:.55rem .85rem;border-radius:8px;margin-bottom:.75rem;font-size:.84rem;
    background:${ok ? '#ecfdf5' : '#fef2f2'};color:${ok ? '#065f46' : '#991b1b'};
    border:1px solid ${ok ? '#6ee7b7' : '#fca5a5'}`;
  setTimeout(() => { el.textContent = ''; el.style.cssText = ''; }, 3500);
}

loadApartments();
