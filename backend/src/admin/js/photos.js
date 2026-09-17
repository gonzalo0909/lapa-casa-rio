// lapa-casa-hostel/backend/src/admin/js/photos.js
//
// Fotos de documento de identidad, subidas automáticamente por los
// huéspedes al reservar (GET /admin/guests/document-photos). Solo
// lectura -- reemplaza el uploader manual que había acá antes, que en
// realidad era para la galería de marketing "bitácora de viajantes"
// (esa funcionalidad se movió a gallery.html/gallery.js, sigue viva).

requireAuth();
renderNav('photos');

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

async function loadDocumentPhotos() {
  try {
    const data = await apiFetch('/admin/guests/document-photos');
    renderGrid(data.guests);
  } catch (err) {
    showMsg('gallery-msg', err.message, 'error');
  }
}

function renderGrid(guests) {
  const grid = document.getElementById('doc-grid');
  if (guests.length === 0) {
    grid.innerHTML = '<p style="color:#888;">Todavía ningún huésped subió su documento.</p>';
    return;
  }

  grid.innerHTML = guests.map(g => `
    <div class="doc-card">
      <img src="${escapeHtml(g.document_photo_url)}" alt="Documento de ${escapeHtml(g.full_name)}">
      <div class="body">
        <div class="name">${escapeHtml(g.full_name)}</div>
        <div class="meta">${escapeHtml(g.email || '')}</div>
        ${g.reservation_number ? `<div class="meta">Reserva ${escapeHtml(g.reservation_number)} · ${fmtDate(g.check_in_date)} – ${fmtDate(g.check_out_date)}</div>` : ''}
        <div class="meta">Subida: ${g.document_photo_uploaded_at ? fmtDate(g.document_photo_uploaded_at) : '—'}</div>
      </div>
    </div>
  `).join('');
}

loadDocumentPhotos();
