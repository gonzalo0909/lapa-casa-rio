// lapa-casa-hostel/backend/src/admin/js/dynamic-pricing.js
// Script de la pagina de precios dinamicos.
// Cargado como archivo externo para cumplir con la CSP (scriptSrc: 'self').
// NO usa onclick ni otros event handlers inline.

(function () {
  // ── Estado ────────────────────────────────────────────────────────────────
  var DP = '/admin/dynamic-pricing';
  var cfg = {};
  var allUnits = [];

  // ── Init nav ──────────────────────────────────────────────────────────────
  if (typeof renderNav === 'function') renderNav('dynamic-pricing');

  // ── Tabs ──────────────────────────────────────────────────────────────────
  var TABS = ['hostel', 'apartments', 'global', 'events', 'calendar'];
  TABS.forEach(function (name) {
    var btn = document.getElementById('tbtn-' + name);
    if (btn) btn.addEventListener('click', function () { switchTab(name); });
  });

  function switchTab(name) {
    TABS.forEach(function (t) {
      var btn = document.getElementById('tbtn-' + t);
      var panel = document.getElementById('tab-' + t);
      if (btn) btn.classList.toggle('active', t === name);
      if (panel) panel.classList.toggle('active', t === name);
    });
  }

  // ?type=hostel|apartment -- esta página se embebe (vía iframe) tanto
  // dentro de Habitaciones (?type=hostel) como dentro de Apartamentos
  // (?type=apartment). En ese caso se oculta el toggle Hostel/Apartamentos
  // (queda implícito por dónde está embebida) y arranca en la pestaña
  // correspondiente. Sin el parámetro, se comporta como siempre (ambos
  // toggles visibles, uso directo de la página).
  var propertyType = new URLSearchParams(window.location.search).get('type');
  if (propertyType === 'hostel' || propertyType === 'apartment') {
    var hiddenUnitTab = propertyType === 'hostel' ? 'apartments' : 'hostel';
    var hiddenBtn = document.getElementById('tbtn-' + hiddenUnitTab);
    if (hiddenBtn) hiddenBtn.style.display = 'none';
    switchTab(propertyType === 'hostel' ? 'hostel' : 'apartments');
  }

  // ── Bot ───────────────────────────────────────────────────────────────────
  ['run-btn', 'run-btn-apt'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', runBot);
  });

  function runBot() {
    var resEl  = document.getElementById('run-result');
    var resApt = document.getElementById('run-result-apt');
    var btn    = document.getElementById('run-btn');
    var btnApt = document.getElementById('run-btn-apt');
    setText(resEl,  'Ejecutando...');
    setText(resApt, 'Ejecutando...');
    setDisabled(btn,    true);
    setDisabled(btnApt, true);
    apiFetch(DP + '/run', { method: 'POST' })
      .then(function (r) {
        var msg = (r.processed || 0) + ' precios calculados (' + (r.errors || 0) + ' errores)';
        setText(resEl,  msg);
        setText(resApt, msg);
        loadCalendar();
      })
      .catch(function (e) {
        setText(resEl,  'Error: ' + e.message);
        setText(resApt, 'Error: ' + e.message);
      })
      .finally(function () {
        setDisabled(btn,    false);
        setDisabled(btnApt, false);
      });
  }

  // ── Unidades ──────────────────────────────────────────────────────────────
  function loadUnits() {
    return apiFetch(DP + '/unit-configs')
      .then(function (units) {
        allUnits = units || [];
        renderUnits('hostel',    'hostel-units');
        renderUnits('apartment', 'apt-units');
        populateRoomFilter();
      })
      .catch(function (e) {
        setText(document.getElementById('hostel-units'), 'Error: ' + e.message);
        setText(document.getElementById('apt-units'),    'Error: ' + e.message);
      });
  }

  function renderUnits(type, containerId) {
    var units = allUnits.filter(function (u) { return u.property_type === type; });
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!units.length) { el.innerHTML = '<p style="color:var(--text-muted)">Sin unidades.</p>'; return; }
    var label = type === 'hostel' ? '/cama' : '/noche';
    el.innerHTML = units.map(function (u) {
      var id   = u.room_type_id;
      var minV = u.min_price_brl != null ? u.min_price_brl : '';
      var maxV = u.max_price_brl != null ? u.max_price_brl : '';
      return '<div class="unit-card" id="uc-' + id + '">' +
        '<div class="unit-name">' + esc(u.room_name) + '</div>' +
        '<div class="unit-base">Base: R$ ' + Number(u.base_price).toFixed(2) + label + '</div>' +
        '<label class="unit-toggle"><input type="checkbox" id="chk-' + id + '"' + (u.bot_enabled ? ' checked' : '') + '> Bot habilitado</label>' +
        '<div class="unit-fields">' +
          '<div><label>Minimo (BRL)</label><input type="number" id="min-' + id + '" value="' + minV + '" placeholder="Global"></div>' +
          '<div><label>Maximo (BRL)</label><input type="number" id="max-' + id + '" value="' + maxV + '" placeholder="Global"></div>' +
        '</div>' +
        '<div id="msg-' + id + '" style="font-size:12px;min-height:18px;"></div>' +
        '<button id="save-' + id + '">Guardar</button>' +
      '</div>';
    }).join('');

    // Vincular eventos despues de insertar en el DOM
    units.forEach(function (u) {
      var id = u.room_type_id;
      var saveBtn = document.getElementById('save-' + id);
      var chk     = document.getElementById('chk-'  + id);
      if (saveBtn) saveBtn.addEventListener('click', function () { saveUnit(id); });
      if (chk)     chk.addEventListener('change',   function () {
        var unit = allUnits.find(function (x) { return x.room_type_id === id; });
        if (unit) unit.bot_enabled = chk.checked;
        saveUnitData(id, false);
      });
    });
  }

  function saveUnit(id) {
    var btn   = document.getElementById('save-' + id);
    var msgEl = document.getElementById('msg-'  + id);
    setDisabled(btn, true);
    setText(btn, 'Guardando...');
    saveUnitData(id, true)
      .then(function () {
        if (msgEl) msgEl.innerHTML = '<span style="color:var(--accent)">Guardado</span>';
        setTimeout(function () {
          if (msgEl) msgEl.innerHTML = '';
          setText(btn, 'Guardar');
          setDisabled(btn, false);
        }, 2500);
      })
      .catch(function (e) {
        if (msgEl) msgEl.innerHTML = '<span style="color:var(--danger)">Error: ' + esc(e.message) + '</span>';
        setText(btn, 'Guardar');
        setDisabled(btn, false);
      });
  }

  function saveUnitData(id, reload) {
    var minEl   = document.getElementById('min-' + id);
    var maxEl   = document.getElementById('max-' + id);
    var chk     = document.getElementById('chk-' + id);
    var unit    = allUnits.find(function (u) { return u.room_type_id === id; });
    var minV    = minEl && minEl.value !== '' ? Number(minEl.value) : null;
    var maxV    = maxEl && maxEl.value !== '' ? Number(maxEl.value) : null;
    var enabled = chk ? chk.checked : (unit ? unit.bot_enabled : true);
    return apiFetch(DP + '/unit-configs/' + id, {
      method: 'PUT',
      body:   JSON.stringify({ min_price_brl: minV, max_price_brl: maxV, bot_enabled: enabled })
    }).then(function () {
      if (reload) return loadUnits();
    });
  }

  // ── Config global ─────────────────────────────────────────────────────────
  function loadConfig() {
    return apiFetch(DP + '/config')
      .then(function (data) {
        cfg = data || {};
        var sections = {
          'cfg-occ':    [['occ_tier_low_pct',  'Tier bajo (%)'],   ['occ_tier_mid_pct',  'Tier medio (%)'],
                         ['occ_tier_high_pct', 'Tier alto (%)'],   ['occ_tier_vhigh_pct','Tier muy alto (%)'],
                         ['occ_adj_low',       'Ajuste bajo (%)'], ['occ_adj_mid',       'Ajuste medio (%)'],
                         ['occ_adj_high',      'Ajuste alto (%)'], ['occ_adj_vhigh',     'Ajuste muy alto (%)'],
                         ['occ_adj_max',       'Ajuste max (%)']],
          'cfg-prox':   [['prox_tier_far',   'Anticipado (dias)'], ['prox_tier_mid',    'Medio (dias)'],
                         ['prox_tier_near',  'Proximo (dias)'],    ['prox_tier_close',  'Cercano (dias)'],
                         ['prox_adj_far',    'Ajuste anticipado (%)'], ['prox_adj_mid', 'Ajuste medio (%)'],
                         ['prox_adj_near',   'Ajuste proximo (%)'], ['prox_adj_close',  'Ajuste cercano (%)'],
                         ['prox_adj_lastmin','Last minute (%)']],
          'cfg-dow':    [['dow_adj_weekday', 'Lun-Jue (%)'], ['dow_adj_weekend', 'Vie-Dom (%)']],
          'cfg-limits': [['price_min_brl', 'Min global (BRL)'], ['price_max_brl', 'Max global (BRL)']],
          'cfg-horizon':[['horizon_days', 'Dias de horizonte']]
        };
        Object.keys(sections).forEach(function (containerId) {
          var el = document.getElementById(containerId);
          if (!el) return;
          el.innerHTML = '';
          sections[containerId].forEach(function (pair) {
            var d = document.createElement('div');
            d.innerHTML = '<label>' + pair[1] + '</label><input type="number" step="any" id="cfg-' + pair[0] + '" value="' + (cfg[pair[0]] != null ? cfg[pair[0]] : '') + '">';
            el.appendChild(d);
          });
        });
      })
      .catch(function (e) { showMsg('global-msg', 'Error: ' + e.message, 'error'); });
  }

  var saveGlobalBtn = document.getElementById('save-global-btn');
  if (saveGlobalBtn) saveGlobalBtn.addEventListener('click', function () {
    var data   = {};
    var inputs = document.querySelectorAll('[id^="cfg-"]');
    inputs.forEach(function (inp) { data[inp.id.replace('cfg-', '')] = Number(inp.value); });
    apiFetch(DP + '/config', { method: 'PUT', body: JSON.stringify(data) })
      .then(function () {
        showMsg('global-msg', 'Configuracion guardada', 'ok');
        setTimeout(function () { showMsg('global-msg', '', ''); }, 3000);
      })
      .catch(function (e) { showMsg('global-msg', 'Error: ' + e.message, 'error'); });
  });

  // ── Eventos ───────────────────────────────────────────────────────────────
  function loadEvents() {
    return apiFetch(DP + '/events')
      .then(function (events) {
        var list = document.getElementById('events-list');
        if (!list) return;
        events = events || [];
        if (!events.length) { list.innerHTML = '<p style="color:var(--text-muted)">Sin eventos.</p>'; return; }
        list.innerHTML = events.map(function (e) {
          var sign = e.adjustment_pct > 0 ? '+' : '';
          return '<div class="event-row" id="ev-' + e.id + '">' +
            '<div class="ev-name">'  + esc(e.name) + '</div>' +
            '<div class="ev-dates">' + e.date_from + ' — ' + e.date_to + '</div>' +
            '<div class="ev-adj">'   + sign + e.adjustment_pct + '%</div>' +
            '<span class="badge">'   + e.applies_to + '</span>' +
            (!e.is_active ? '<span class="badge" style="background:#f0f0f0;color:#999">inactivo</span>' : '') +
            '<button class="ev-toggle-btn" data-id="' + e.id + '" data-active="' + e.is_active + '">' + (e.is_active ? 'Desactivar' : 'Activar') + '</button>' +
            '<button class="ev-del-btn" data-id="' + e.id + '" style="color:var(--danger)">Eliminar</button>' +
          '</div>';
        }).join('');

        list.querySelectorAll('.ev-toggle-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id       = btn.dataset.id;
            var isActive = btn.dataset.active === 'true';
            apiFetch(DP + '/events/' + id, { method: 'PUT', body: JSON.stringify({ is_active: !isActive }) })
              .then(function () { return loadEvents(); })
              .catch(function (e) { alert('Error: ' + e.message); });
          });
        });
        list.querySelectorAll('.ev-del-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!confirm('Eliminar evento?')) return;
            apiFetch(DP + '/events/' + btn.dataset.id, { method: 'DELETE' })
              .then(function () { return loadEvents(); })
              .catch(function (e) { alert('Error: ' + e.message); });
          });
        });
      })
      .catch(function (e) { showMsg('events-msg', 'Error: ' + e.message, 'error'); });
  }

  var addEventBtn = document.getElementById('add-event-btn');
  if (addEventBtn) addEventBtn.addEventListener('click', function () {
    var name = val('ev-name').trim();
    var from = val('ev-from');
    var to   = val('ev-to');
    var adj  = val('ev-adj');
    var apl  = val('ev-applies');
    if (!name || !from || !to || !adj) { showMsg('events-msg', 'Completa todos los campos.', 'error'); return; }
    apiFetch(DP + '/events', { method: 'POST', body: JSON.stringify({ name: name, date_from: from, date_to: to, adjustment_pct: Number(adj), applies_to: apl }) })
      .then(function () {
        ['ev-name', 'ev-from', 'ev-to', 'ev-adj'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        showMsg('events-msg', 'Evento creado', 'ok');
        setTimeout(function () { showMsg('events-msg', '', ''); }, 2500);
        return loadEvents();
      })
      .catch(function (e) { showMsg('events-msg', 'Error: ' + e.message, 'error'); });
  });

  // ── Calendario ────────────────────────────────────────────────────────────
  function populateRoomFilter() {
    var sel = document.getElementById('cal-filter-room');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas las unidades</option>';
    allUnits.forEach(function (u) {
      var o = document.createElement('option');
      o.value       = u.room_type_id;
      o.textContent = u.room_name;
      sel.appendChild(o);
    });
  }

  function loadCalendar() {
    var days   = val('cal-days') || '60';
    var type   = val('cal-filter-type');
    var roomId = val('cal-filter-room');
    var params = 'days=' + encodeURIComponent(days);
    if (roomId) params += '&roomTypeId=' + encodeURIComponent(roomId);
    var tbody = document.getElementById('cal-body');
    return apiFetch(DP + '/calendar?' + params)
      .then(function (rows) {
        rows = rows || [];
        if (type) rows = rows.filter(function (r) { return r.property_type === type; });
        if (!tbody) return;
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);padding:20px">Sin datos. Ejecuta el bot primero.</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map(function (r) {
          var delta = r.base_price ? ((r.final_price - r.base_price) / r.base_price * 100).toFixed(1) : 0;
          var sign  = delta > 0 ? '+' : '';
          var cls   = delta > 0 ? 'price-up' : (delta < 0 ? 'price-dn' : '');
          var occ   = r.occupancy_pct != null ? r.occupancy_pct : 0;
          return '<tr><td>' + r.target_date + '</td><td>' + esc(r.room_name) + '</td><td>' + r.property_type + '</td>' +
            '<td>R$ ' + Number(r.base_price).toFixed(2) + '</td><td><strong>R$ ' + Number(r.final_price).toFixed(2) + '</strong></td>' +
            '<td class="' + cls + '">' + sign + delta + '%</td>' +
            '<td><span class="occ-bar"><span class="occ-fill" style="width:' + occ + '%"></span></span> ' + occ + '%</td>' +
            '<td>' + (r.event_name ? esc(r.event_name) : '&mdash;') + '</td></tr>';
        }).join('');
      })
      .catch(function (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="msg error">Error: ' + esc(e.message) + '</td></tr>';
      });
  }

  var calRefreshBtn = document.getElementById('cal-refresh-btn');
  if (calRefreshBtn) calRefreshBtn.addEventListener('click', loadCalendar);
  var calFilterType = document.getElementById('cal-filter-type');
  if (calFilterType) calFilterType.addEventListener('change', loadCalendar);
  var calFilterRoom = document.getElementById('cal-filter-room');
  if (calFilterRoom) calFilterRoom.addEventListener('change', loadCalendar);

  // ── Utilidades ────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]);
    });
  }
  function val(id)          { var el = document.getElementById(id); return el ? el.value : ''; }
  function setText(el, t)   { if (el) el.textContent = t; }
  function setDisabled(el, d) { if (el) el.disabled = d; }
  function showMsg(elId, text, type) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = text ? '<div class="msg ' + type + '">' + esc(text) + '</div>' : '';
  }

  // ── Arranque ──────────────────────────────────────────────────────────────
  Promise.all([loadConfig(), loadUnits(), loadEvents(), loadCalendar()]);

})();
