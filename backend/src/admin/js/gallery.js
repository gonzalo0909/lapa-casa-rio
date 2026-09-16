// lapa-casa-hostel/backend/src/admin/js/gallery.js
//
// "Bitácora de viajantes" -- galería pública de fotos de huéspedes que
// alimenta /galeria en el sitio. Antes vivía en photos.js/photos.html;
// se movió acá porque esa pestaña pasó a mostrar las fotos de documento
// de identidad (automáticas, sin subida manual). Contenido sin cambios.

requireAuth();
renderNav('gallery');

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

async function loadPhotos() {
  try {
    const data = await apiFetch('/admin/photos');
    renderGallery(data.photos);
  } catch (err) {
    showMsg('gallery-msg', err.message, 'error');
  }
}

function renderGallery(photos) {
  const grid = document.getElementById('photo-grid');
  if (photos.length === 0) {
    grid.innerHTML = '<p style="color:#888;">Todavía no subiste ninguna foto.</p>';
    return;
  }

  grid.innerHTML = photos.map(p => `
    <div class="photo-card ${p.is_published ? '' : 'unpublished'}" data-id="${p.id}">
      <img src="${escapeHtml(p.image_url)}" alt="">
      <div class="body">
        <input type="text" class="guest-name" value="${escapeHtml(p.guest_name || '')}" placeholder="Nombre">
        <input type="text" class="guest-country" value="${escapeHtml(p.guest_country || '')}" placeholder="País (2 letras)" maxlength="2">
        <input type="text" class="caption" value="${escapeHtml(p.caption || '')}" placeholder="Comentario">
        <div class="actions">
          <label style="font-size:12px;">
            <input type="checkbox" class="is-published" ${p.is_published ? 'checked' : ''}> Publicada
          </label>
          <div>
            <button data-action="save" style="font-size:12px;">Guardar</button>
            <button data-action="delete" style="font-size:12px;color:#b00;">Borrar</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('button[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', () => savePhoto(btn.closest('.photo-card')));
  });
  grid.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deletePhoto(btn.closest('.photo-card')));
  });
}

async function savePhoto(card) {
  const id = card.dataset.id;
  try {
    await apiFetch(`/admin/photos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        guestName: card.querySelector('.guest-name').value,
        guestCountry: card.querySelector('.guest-country').value,
        caption: card.querySelector('.caption').value,
        isPublished: card.querySelector('.is-published').checked
      })
    });
    showMsg('gallery-msg', 'Foto actualizada.', 'success');
    loadPhotos();
  } catch (err) {
    showMsg('gallery-msg', err.message, 'error');
  }
}

async function deletePhoto(card) {
  if (!confirm('¿Borrar esta foto? No se puede deshacer.')) return;
  const id = card.dataset.id;
  try {
    await apiFetch(`/admin/photos/${id}`, { method: 'DELETE' });
    showMsg('gallery-msg', 'Foto borrada.', 'success');
    loadPhotos();
  } catch (err) {
    showMsg('gallery-msg', err.message, 'error');
  }
}

document.getElementById('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById('photo-file');
  const file = fileInput.files[0];
  if (!file) return;

  const uploadBtn = document.getElementById('upload-btn');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Subiendo...';

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('guestName', document.getElementById('guest-name').value);
  formData.append('guestCountry', document.getElementById('guest-country').value);
  formData.append('caption', document.getElementById('caption').value);

  try {
    // No usa apiFetch: esa función fuerza Content-Type: application/json,
    // que rompe un multipart/form-data (el boundary lo tiene que poner
    // el propio browser).
    const csrfToken = getCookie('lch_admin_csrf');
    const res = await fetch('/api/v1/admin/photos', {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
      body: formData
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) {
      throw new Error(body.error || `Error ${res.status}`);
    }
    showMsg('upload-msg', 'Foto subida.', 'success');
    document.getElementById('upload-form').reset();
    loadPhotos();
  } catch (err) {
    showMsg('upload-msg', err.message, 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Subir foto';
  }
});

loadPhotos();
