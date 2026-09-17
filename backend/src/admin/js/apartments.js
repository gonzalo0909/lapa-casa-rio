// lapa-casa-hostel/backend/src/admin/js/apartments.js
// Editor completo de apartamentos: datos, fotos y resenas.
// Cargado como archivo externo (CSP: scriptSrc 'self').

(function () {
  if (typeof renderNav === 'function') renderNav('apartments');

  var RT = '/admin/room-types';
  var currentId = null;
  var editingReviewId = null;
  var amenitiesMaster = [
    'Wifi', 'Aire acondicionado', 'Cocina equipada', 'Lavadora', 'Secadora',
    'TV', 'Balcon', 'Vista a la calle', 'Bano privado', 'Calefaccion',
    'Microondas', 'Nevera', 'Congelador', 'Horno', 'Cafetera',
    'Ropa de cama', 'Toallas', 'Parking', 'Ascensor', 'Piscina',
    'Terraza', 'Parrilla / Churrasqueira', 'Escritorio', 'Cuna disponible',
    'Primera linea de playa', 'Vista al mar', 'Jardin'
  ];
  var selectedAmenities = [];

  // ── Tabs internos ─────────────────────────────────────────────────────────
  var INNER_TABS = ['datos', 'fotos', 'resenas'];
  INNER_TABS.forEach(function (t) {
    var btn = document.getElementById('itbtn-' + t);
    if (btn) btn.addEventListener('click', function () { switchInnerTab(t); });
  });

  function switchInnerTab(name) {
    INNER_TABS.forEach(function (t) {
      var btn   = document.getElementById('itbtn-' + t);
      var panel = document.getElementById('itab-' + t);
      if (btn)   btn.classList.toggle('active', t === name);
      if (panel) panel.classList.toggle('active', t === name);
    });
  }

  // ── Lista de apartamentos ─────────────────────────────────────────────────
  function loadList() {
    return apiFetch(RT)
      .then(function (data) {
        var apts = (data && data.apartments) ? data.apartments : [];
        var el   = document.getElementById('apt-list');
        if (!apts.length) { el.innerHTML = '<p style="color:var(--text-muted)">Sin apartamentos.</p>'; return; }
        el.innerHTML = '';
        apts.forEach(function (apt) {
          var btn = document.createElement('button');
          btn.className = 'apt-item';
          btn.dataset.id = apt.id;
          var hasPhotos = apt.photo_count > 0;
          btn.innerHTML =
            '<div>' +
              '<div class="apt-item-name">' + esc(apt.name) + '</div>' +
              '<div class="apt-item-sub">' + esc(apt.code) + ' · ' + apt.capacity + ' huésp.</div>' +
            '</div>' +
            '<span class="photo-badge' + (hasPhotos ? ' has-photos' : '') + '">' +
              apt.photo_count + ' foto' + (apt.photo_count !== 1 ? 's' : '') +
            '</span>';
          btn.addEventListener('click', function () { selectApt(apt.id, apt.name); });
          el.appendChild(btn);
        });
        // Si habia uno seleccionado, lo remarca
        if (currentId) {
          var active = el.querySelector('[data-id="' + currentId + '"]');
          if (active) active.classList.add('active');
        }
      })
      .catch(function (e) { showMsg('page-msg', 'Error cargando lista: ' + e.message, 'error'); });
  }

  function selectApt(id, name) {
    currentId = id;
    document.querySelectorAll('.apt-item').forEach(function (b) { b.classList.remove('active'); });
    var btn = document.querySelector('.apt-item[data-id="' + id + '"]');
    if (btn) btn.classList.add('active');
    document.getElementById('editor-title').textContent = name;
    document.getElementById('editor').style.display = '';
    loadDatos();
    loadPhotos();
    loadReviews();
  }

  // ── TAB DATOS ─────────────────────────────────────────────────────────────
  function loadDatos() {
    return apiFetch(RT + '/' + currentId)
      .then(function (apt) {
        setVal('f-name',          apt.name          || '');
        setVal('f-neighborhood',  apt.neighborhood  || '');
        setVal('f-capacity',      apt.capacity      != null ? apt.capacity : '');
        setVal('f-bedrooms',      apt.bedrooms      != null ? apt.bedrooms : '');
        setVal('f-bathrooms',     apt.bathrooms     != null ? apt.bathrooms : '');
        setVal('f-base-price',    apt.base_price    != null ? Number(apt.base_price).toFixed(2) : '');
        setVal('f-description',   apt.description   || '');
        selectedAmenities = Array.isArray(apt.amenities) ? apt.amenities.slice() : [];
        renderAmenities();
        // ratings
        setVal('r-rating',  apt.external_rating       != null ? apt.external_rating : '');
        setVal('r-count',   apt.external_review_count != null ? apt.external_review_count : '');
        setVal('r-label',   apt.external_rating_label || '');
      })
      .catch(function (e) { showMsg('datos-msg', 'Error: ' + e.message, 'error'); });
  }

  function renderAmenities() {
    var grid = document.getElementById('amenity-grid');
    grid.innerHTML = '';
    amenitiesMaster.forEach(function (a) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'amenity-chip' + (selectedAmenities.indexOf(a) >= 0 ? ' selected' : '');
      chip.textContent = a;
      chip.addEventListener('click', function () {
        var idx = selectedAmenities.indexOf(a);
        if (idx >= 0) { selectedAmenities.splice(idx, 1); chip.classList.remove('selected'); }
        else          { selectedAmenities.push(a);         chip.classList.add('selected'); }
      });
      grid.appendChild(chip);
    });
  }

  var saveDatosBtn = document.getElementById('save-datos-btn');
  if (saveDatosBtn) saveDatosBtn.addEventListener('click', function () {
    if (!currentId) return;
    setDisabled(saveDatosBtn, true);
    saveDatosBtn.textContent = 'Guardando...';
    var payload = {
      name:          getVal('f-name'),
      neighborhood:  getVal('f-neighborhood'),
      capacity:      Number(getVal('f-capacity')),
      bedrooms:      getVal('f-bedrooms') !== '' ? Number(getVal('f-bedrooms')) : null,
      bathrooms:     getVal('f-bathrooms') !== '' ? Number(getVal('f-bathrooms')) : null,
      base_price:    Number(getVal('f-base-price')),
      description:   getVal('f-description'),
      amenities:     selectedAmenities.slice()
    };
    apiFetch(RT + '/' + currentId, { method: 'PUT', body: JSON.stringify(payload) })
      .then(function () {
        showMsg('datos-msg', 'Datos guardados', 'ok');
        setTimeout(function () { showMsg('datos-msg', '', ''); }, 2500);
        return loadList();
      })
      .catch(function (e) { showMsg('datos-msg', 'Error: ' + e.message, 'error'); })
      .finally(function () { saveDatosBtn.textContent = 'Guardar datos'; setDisabled(saveDatosBtn, false); });
  });

  // ── TAB FOTOS ─────────────────────────────────────────────────────────────
  function loadPhotos() {
    if (!currentId) return;
    return apiFetch(RT + '/' + currentId + '/photos')
      .then(function (data) {
        var photos = (data && data.photos) ? data.photos : [];
        renderPhotos(photos);
      })
      .catch(function (e) { showMsg('fotos-msg', 'Error: ' + e.message, 'error'); });
  }

  function renderPhotos(photos) {
    var grid = document.getElementById('photo-grid');
    if (!photos.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin fotos. Subi la primera usando el formulario de arriba.</p>';
      return;
    }
    grid.innerHTML = '';
    photos.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'photo-card' + (p.is_primary ? ' primary' : '');
      var primaryHtml = p.is_primary
        ? '<span class="btn-primary-label">Principal</span>'
        : '<button data-pid="' + p.id + '" class="btn-set-primary" style="color:var(--accent);background:none;border:none;cursor:pointer;font-size:12px">Hacer principal</button>';
      card.innerHTML =
        '<img src="' + esc(p.image_url) + '" alt="' + esc(p.alt_text || 'foto') + '">' +
        '<div class="photo-actions">' +
          primaryHtml +
          '<button data-pid="' + p.id + '" class="btn-delete" style="color:var(--danger);background:none;border:none;cursor:pointer;font-size:12px">Eliminar</button>' +
        '</div>';
      grid.appendChild(card);
    });

    grid.querySelectorAll('.btn-set-primary').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apiFetch(RT + '/photos/' + btn.dataset.pid, { method: 'PATCH', body: JSON.stringify({ isPrimary: true }) })
          .then(function () { return loadPhotos(); })
          .catch(function (e) { alert('Error: ' + e.message); });
      });
    });
    grid.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Eliminar esta foto?')) return;
        apiFetch(RT + '/photos/' + btn.dataset.pid, { method: 'DELETE' })
          .then(function () { return Promise.all([loadPhotos(), loadList()]); })
          .catch(function (e) { alert('Error: ' + e.message); });
      });
    });
  }

  var uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) uploadBtn.addEventListener('click', function () {
    var file = document.getElementById('photo-file').files[0];
    if (!file || !currentId) { showMsg('fotos-msg', 'Selecciona un archivo primero', 'error'); return; }
    var fd = new FormData();
    fd.append('photo', file);
    uploadBtn.textContent = 'Subiendo...';
    setDisabled(uploadBtn, true);
    fetch('/api/v1' + RT + '/' + currentId + '/photos', {
      method: 'POST',
      credentials: 'include',
      body: fd
    })
      .then(function (res) { return res.json(); })
      .then(function (body) {
        if (body.success === false) throw new Error(body.error || 'Error al subir');
        document.getElementById('photo-file').value = '';
        showMsg('fotos-msg', 'Foto subida', 'ok');
        setTimeout(function () { showMsg('fotos-msg', '', ''); }, 2500);
        return Promise.all([loadPhotos(), loadList()]);
      })
      .catch(function (e) { showMsg('fotos-msg', 'Error: ' + e.message, 'error'); })
      .finally(function () { uploadBtn.textContent = 'Subir foto'; setDisabled(uploadBtn, false); });
  });

  // ── TAB RESENAS ───────────────────────────────────────────────────────────
  function loadReviews() {
    if (!currentId) return;
    return apiFetch(RT + '/' + currentId + '/reviews')
      .then(function (reviews) {
        renderReviews(reviews || []);
      })
      .catch(function (e) { showMsg('resenas-msg', 'Error: ' + e.message, 'error'); });
  }

  function renderReviews(reviews) {
    var list = document.getElementById('reviews-list');
    if (!reviews.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Sin resenas. Agrega la primera abajo.</p>';
      return;
    }
    list.innerHTML = reviews.map(function (r) {
      var stars = '';
      var n = Math.round(Number(r.rating));
      for (var i = 0; i < 5; i++) stars += (i < n ? '★' : '☆');
      return '<div class="review-card' + (!r.is_published ? ' unpublished' : '') + '" id="rv-card-' + r.id + '">' +
        '<div class="review-header">' +
          '<div>' +
            '<div class="review-author">' + esc(r.author_name) + '</div>' +
            '<div class="review-platform">' + esc(r.platform) + (!r.is_published ? ' · no publicada' : '') + '</div>' +
          '</div>' +
          '<div class="review-stars">' + stars + ' <span style="font-size:12px;color:var(--text-muted)">' + Number(r.rating).toFixed(1) + '</span></div>' +
        '</div>' +
        '<div class="review-comment">' + esc(r.comment) + '</div>' +
        '<div class="review-date">' + (r.review_date || '') + '</div>' +
        '<div class="review-actions">' +
          '<button class="btn-edit-review" data-id="' + r.id + '">Editar</button>' +
          '<button class="btn-del-review"  data-id="' + r.id + '">Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.btn-edit-review').forEach(function (btn) {
      btn.addEventListener('click', function () { startEditReview(btn.dataset.id, reviews); });
    });
    list.querySelectorAll('.btn-del-review').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Eliminar resena?')) return;
        apiFetch(RT + '/reviews/' + btn.dataset.id, { method: 'DELETE' })
          .then(function () { return loadReviews(); })
          .catch(function (e) { alert('Error: ' + e.message); });
      });
    });
  }

  function startEditReview(id, reviews) {
    var rv = reviews.find(function (r) { return r.id === id; });
    if (!rv) return;
    editingReviewId = id;
    setVal('rv-author',   rv.author_name || '');
    setVal('rv-platform', rv.platform    || 'Admin');
    setVal('rv-rating',   rv.rating      != null ? rv.rating : '');
    setVal('rv-date',     rv.review_date || '');
    setVal('rv-comment',  rv.comment     || '');
    var chk = document.getElementById('rv-published');
    if (chk) chk.checked = rv.is_published !== false;
    document.getElementById('review-form-title').textContent = 'Editar resena';
    document.getElementById('cancel-review-btn').style.display = '';
  }

  var cancelReviewBtn = document.getElementById('cancel-review-btn');
  if (cancelReviewBtn) cancelReviewBtn.addEventListener('click', function () {
    editingReviewId = null;
    document.getElementById('review-form-title').textContent = 'Nueva resena';
    cancelReviewBtn.style.display = 'none';
    ['rv-author','rv-rating','rv-date','rv-comment'].forEach(function (id) { setVal(id, ''); });
    var chk = document.getElementById('rv-published');
    if (chk) chk.checked = true;
  });

  var saveReviewBtn = document.getElementById('save-review-btn');
  if (saveReviewBtn) saveReviewBtn.addEventListener('click', function () {
    if (!currentId) return;
    var author  = getVal('rv-author').trim();
    var rating  = getVal('rv-rating');
    var comment = getVal('rv-comment').trim();
    if (!author || !rating || !comment) {
      showMsg('resenas-msg', 'Autor, rating y comentario son requeridos', 'error');
      return;
    }
    var chk     = document.getElementById('rv-published');
    var payload = {
      author_name:  author,
      platform:     getVal('rv-platform') || 'Admin',
      rating:       Number(rating),
      comment:      comment,
      review_date:  getVal('rv-date') || null,
      is_published: chk ? chk.checked : true
    };
    setDisabled(saveReviewBtn, true);
    saveReviewBtn.textContent = 'Guardando...';
    var url    = editingReviewId ? RT + '/reviews/' + editingReviewId : RT + '/' + currentId + '/reviews';
    var method = editingReviewId ? 'PUT' : 'POST';
    apiFetch(url, { method: method, body: JSON.stringify(payload) })
      .then(function () {
        showMsg('resenas-msg', editingReviewId ? 'Resena actualizada' : 'Resena guardada', 'ok');
        setTimeout(function () { showMsg('resenas-msg', '', ''); }, 2500);
        editingReviewId = null;
        document.getElementById('review-form-title').textContent = 'Nueva resena';
        document.getElementById('cancel-review-btn').style.display = 'none';
        ['rv-author','rv-rating','rv-date','rv-comment'].forEach(function (id) { setVal(id, ''); });
        if (chk) chk.checked = true;
        return loadReviews();
      })
      .catch(function (e) { showMsg('resenas-msg', 'Error: ' + e.message, 'error'); })
      .finally(function () { saveReviewBtn.textContent = 'Guardar resena'; setDisabled(saveReviewBtn, false); });
  });

  var saveAggBtn = document.getElementById('save-aggregate-btn');
  if (saveAggBtn) saveAggBtn.addEventListener('click', function () {
    if (!currentId) return;
    var rating = getVal('r-rating');
    var count  = getVal('r-count');
    var label  = getVal('r-label');
    setDisabled(saveAggBtn, true);
    saveAggBtn.textContent = 'Guardando...';
    apiFetch(RT + '/' + currentId, {
      method: 'PUT',
      body: JSON.stringify({
        external_rating:        rating !== '' ? Number(rating) : null,
        external_review_count:  count  !== '' ? Number(count)  : null,
        external_rating_label:  label  || null
      })
    })
      .then(function () {
        showMsg('resenas-msg', 'Puntuacion guardada', 'ok');
        setTimeout(function () { showMsg('resenas-msg', '', ''); }, 2500);
      })
      .catch(function (e) { showMsg('resenas-msg', 'Error: ' + e.message, 'error'); })
      .finally(function () { saveAggBtn.textContent = 'Guardar puntuacion'; setDisabled(saveAggBtn, false); });
  });

  // ── Utilidades ────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function getVal(id)        { var el = document.getElementById(id); return el ? el.value : ''; }
  function setVal(id, v)     { var el = document.getElementById(id); if (el) el.value = v; }
  function setDisabled(el,d) { if (el) el.disabled = d; }
  function showMsg(elId, text, type) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = text ? '<div class="msg ' + type + '">' + esc(text) + '</div>' : '';
  }

  // ── Arranque ──────────────────────────────────────────────────────────────
  loadList();

})();

// ── Pestañas externas (Apartamentos / Bloqueos / Ofertas / Precios dinámicos) ──
// Fuera del IIFE de arriba porque no necesita nada de su estado interno.
// Como archivo externo: la CSP del backend (scriptSrc: 'self', sin
// unsafe-inline) bloquea silenciosamente cualquier <script> inline.
document.querySelectorAll('.outer-tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var tab = btn.dataset.otab;
    document.querySelectorAll('.outer-tab-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
    document.querySelectorAll('.outer-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'opanel-' + tab); });
  });
});
