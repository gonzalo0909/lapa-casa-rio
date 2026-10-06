// Chat del admin con los administradores de apartamentos.
// Archivo externo — cumple CSP (scriptSrc: self, sin unsafe-inline).
// Sin websockets: se consulta cada 8 s mientras la pestaña está abierta.

(function () {
  if (typeof requireAuth === 'function') requireAuth();
  if (typeof renderNav === 'function') renderNav('messages');

  var BASE = '/admin/owner-messages';
  var currentOwner = null;
  var currentName = '';
  var timer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(d) {
    return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function loadConversations() {
    return apiFetch(BASE).then(function (data) {
      var list = document.getElementById('conv-list');
      var convs = (data && data.conversations) || [];
      if (!convs.length) { list.innerHTML = '<p class="empty">Sin administradores.</p>'; return; }
      list.innerHTML = convs.map(function (c) {
        return '<button class="conv-item' + (c.ownerId === currentOwner ? ' active' : '') + '" data-id="' + esc(c.ownerId) + '" data-name="' + esc(c.fullName) + '">' +
          '<div class="conv-name"><span>' + esc(c.fullName) + '</span>' +
          (c.unread ? '<span class="unread-badge">' + c.unread + '</span>' : '') + '</div>' +
          '<div class="conv-last">' + (c.lastBody ? esc((c.lastSender === 'admin' ? 'Tú: ' : '') + c.lastBody) : 'Sin mensajes') + '</div>' +
          '</button>';
      }).join('');
      list.querySelectorAll('.conv-item').forEach(function (b) {
        b.addEventListener('click', function () { openConversation(b.dataset.id, b.dataset.name); });
      });
    }).catch(function (e) { showMsg('Error: ' + e.message); });
  }

  function loadThread(scroll) {
    if (!currentOwner) return Promise.resolve();
    return apiFetch(BASE + '/' + currentOwner).then(function (data) {
      var box = document.getElementById('thread');
      var msgs = (data && data.messages) || [];
      var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.innerHTML = msgs.length ? msgs.map(function (m) {
        return '<div class="bubble ' + esc(m.sender) + '">' + esc(m.body) + '<small>' + fmt(m.created_at) + '</small></div>';
      }).join('') : '<p class="empty">Todavía no hay mensajes. Escribe el primero.</p>';
      if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
    }).catch(function (e) { showMsg('Error: ' + e.message); });
  }

  function openConversation(id, name) {
    currentOwner = id;
    currentName = name;
    document.getElementById('chat-title').textContent = name;
    document.getElementById('composer').style.display = '';
    loadThread(true).then(loadConversations);
  }

  function showMsg(text) {
    var el = document.getElementById('page-msg');
    el.textContent = text;
    el.className = 'msg error';
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  document.getElementById('composer').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('msg-input');
    var body = input.value.trim();
    if (!body || !currentOwner) return;
    var btn = document.getElementById('send-btn');
    btn.disabled = true;
    apiFetch(BASE + '/' + currentOwner, { method: 'POST', body: JSON.stringify({ body: body }) })
      .then(function () { input.value = ''; return loadThread(true); })
      .then(loadConversations)
      .catch(function (err) { showMsg('Error: ' + err.message); })
      .finally(function () { btn.disabled = false; input.focus(); });
  });

  // Enter envía, Shift+Enter hace salto de línea
  document.getElementById('msg-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('composer').requestSubmit();
    }
  });

  function tick() {
    if (document.hidden) return;
    loadConversations();
    loadThread(false);
  }

  loadConversations().then(function () {
    var wanted = new URLSearchParams(window.location.search).get('owner');
    if (wanted) {
      var btn = document.querySelector('.conv-item[data-id="' + wanted + '"]');
      if (btn) openConversation(btn.dataset.id, btn.dataset.name);
    }
  });
  timer = setInterval(tick, 8000);
  window.addEventListener('beforeunload', function () { clearInterval(timer); });
})();
