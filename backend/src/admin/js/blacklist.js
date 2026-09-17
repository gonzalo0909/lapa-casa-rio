// lapa-casa-hostel/backend/src/admin/js/blacklist.js
// Lista negra de huespedes: listado, bloqueo y desbloqueo.
// Archivo externo — cumple CSP (scriptSrc: self, sin unsafe-inline).

(function () {
  if (typeof renderNav === 'function') renderNav('blacklist');

  var GUESTS = '/admin/guests';
  var currentPage = 1;
  var currentFilter = 'all'; // 'all' | 'true' | 'false'
  var searchTimeout = null;
  var blockingId = null;
  var total = 0;
  var LIMIT = 50;

  var tbody      = document.getElementById('guests-body');
  var pageInfo   = document.getElementById('page-info');
  var pagination = document.getElementById('pagination');
  var prevBtn    = document.getElementById('prev-btn');
  var nextBtn    = document.getElementById('next-btn');
  var searchInput = document.getElementById('search-input');
  var pageMsg    = document.getElementById('page-msg');
  var modal      = document.getElementById('block-modal');
  var modalReason = document.getElementById('modal-reason');
  var modalNotes  = document.getElementById('modal-notes');
  var modalConfirm = document.getElementById('modal-confirm');
  var modalCancel  = document.getElementById('modal-cancel');

  // ── Filtros de tab ──────────────────────────────────────────────────────────
  document.querySelectorAll('.filter-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      currentPage = 1;
      loadGuests();
    });
  });

  // ── Búsqueda con debounce ───────────────────────────────────────────────────
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      currentPage = 1;
      loadGuests();
    }, 350);
  });

  // ── Paginación ──────────────────────────────────────────────────────────────
  prevBtn.addEventListener('click', function () {
    if (currentPage > 1) { currentPage--; loadGuests(); }
  });
  nextBtn.addEventListener('click', function () {
    var totalPages = Math.ceil(total / LIMIT);
    if (currentPage < totalPages) { currentPage++; loadGuests(); }
  });

  // ── Modal ───────────────────────────────────────────────────────────────────
  modalCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  modalConfirm.addEventListener('click', function () {
    if (!blockingId) return;
    var reason = modalReason.value.trim();
    var notes  = modalNotes.value.trim();
    apiFetch(GUESTS + '/' + blockingId + '/block', {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason, notes: notes }),
    }).then(function () {
      closeModal();
      showMsg('Huesped bloqueado', false);
      loadGuests();
    }).catch(function (err) {
      showMsg(err.message || 'Error al bloquear', true);
    });
  });

  function openModal(id) {
    blockingId = id;
    modalReason.value = '';
    modalNotes.value  = '';
    modal.style.display = 'flex';
    modalReason.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    blockingId = null;
  }

  // ── Carga de datos ──────────────────────────────────────────────────────────
  function loadGuests() {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Cargando...</td></tr>';
    var qs = '?page=' + currentPage + '&limit=' + LIMIT;
    var search = searchInput.value.trim();
    if (search) qs += '&search=' + encodeURIComponent(search);
    if (currentFilter !== 'all') qs += '&blocked=' + currentFilter;

    apiFetch(GUESTS + qs).then(function (data) {
      var guests = data.guests || [];
      total = (data.pagination && data.pagination.total) || 0;
      renderTable(guests);
      renderPagination();
    }).catch(function (err) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Error al cargar: ' + (err.message || 'desconocido') + '</td></tr>';
    });
  }

  function renderTable(guests) {
    if (!guests.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Sin resultados.</td></tr>';
      return;
    }

    tbody.innerHTML = guests.map(function (g) {
      var blocked = g.blocked;
      var badge = blocked
        ? '<span class="badge-blocked">Bloqueado</span>'
        : '<span class="badge-ok">Activo</span>';
      var reason = blocked && g.blocked_reason
        ? '<div class="reason-text" title="' + esc(g.blocked_reason) + '">' + esc(g.blocked_reason) + '</div>'
        : '';
      var action = blocked
        ? '<button class="btn-unblock" data-id="' + g.id + '" data-name="' + esc(g.full_name) + '">Desbloquear</button>'
        : '<button class="btn-block" data-id="' + g.id + '" data-name="' + esc(g.full_name) + '">Bloquear</button>';
      return '<tr>' +
        '<td>' + esc(g.full_name) + '</td>' +
        '<td>' + esc(g.email || '—') + '</td>' +
        '<td>' + esc(g.phone || '—') + '</td>' +
        '<td>' + esc(g.country || '—') + '</td>' +
        '<td>' + (g.reservation_count || 0) + '</td>' +
        '<td>' + badge + '</td>' +
        '<td>' + reason + '</td>' +
        '<td>' + action + '</td>' +
        '</tr>';
    }).join('');

    // Wire buttons after innerHTML
    tbody.querySelectorAll('.btn-block').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(btn.getAttribute('data-id'));
      });
    });
    tbody.querySelectorAll('.btn-unblock').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var name = btn.getAttribute('data-name');
        if (!confirm('Desbloquear a ' + name + '?')) return;
        apiFetch(GUESTS + '/' + id + '/unblock', { method: 'PATCH' }).then(function () {
          showMsg('Huesped desbloqueado', false);
          loadGuests();
        }).catch(function (err) {
          showMsg(err.message || 'Error al desbloquear', true);
        });
      });
    });
  }

  function renderPagination() {
    var totalPages = Math.ceil(total / LIMIT);
    if (totalPages <= 1) {
      pagination.style.display = 'none';
      return;
    }
    pagination.style.display = 'flex';
    pageInfo.textContent = 'Pagina ' + currentPage + ' de ' + totalPages + ' (' + total + ' total)';
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showMsg(text, isError) {
    pageMsg.textContent = text;
    pageMsg.className = 'msg ' + (isError ? 'error' : 'success');
    pageMsg.style.display = 'block';
    setTimeout(function () { pageMsg.style.display = 'none'; }, 3500);
  }

  // ── Inicio ──────────────────────────────────────────────────────────────────
  loadGuests();
})();
