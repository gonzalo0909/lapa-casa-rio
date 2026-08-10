// lapa-casa-hostel/backend/src/admin/js/api.js
// M-02: JWT migrado de localStorage a httpOnly cookie.
// El servidor emite la cookie en el login (Set-Cookie: lch_admin=...; HttpOnly; SameSite=Strict)
// y todas las rutas de admin la leen automáticamente — el JS nunca
// puede acceder al token, lo que elimina el vector XSS de robo de JWT.

const API_BASE = '/api/v1';

// M-02: ya no usamos localStorage para el token.
// La presencia de sesión se detecta consultando un endpoint ligero.
let _sessionActive = null; // null = desconocido, true/false = verificado

async function checkSession() {
  if (_sessionActive !== null) return _sessionActive;
  try {
    const res = await fetch(`${API_BASE}/admin/me`, {
      credentials: 'include', // envía la cookie httpOnly
    });
    _sessionActive = res.ok;
  } catch {
    _sessionActive = false;
  }
  return _sessionActive;
}

/** Redirige a login si no hay sesión activa. Llamar al cargar cualquier página que no sea el login. */
async function requireAuth() {
  const active = await checkSession();
  if (!active) {
    window.location.href = '/admin/index.html';
  }
}

function isLoginPage() {
  return window.location.pathname.endsWith('/admin/') || window.location.pathname.endsWith('/admin/index.html');
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // M-02: la cookie httpOnly se envía automáticamente
  });

  if (res.status === 401) {
    _sessionActive = false;
    if (!isLoginPage()) window.location.href = '/admin/index.html';
    throw new Error('Sesión expirada');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Error ${res.status}`);
  }
  return body.data;
}

async function logout() {
  try {
    // M-03: revoca el token en el servidor antes de limpiar la sesión
    await fetch(`${API_BASE}/admin/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // continuar con el redirect aunque falle la revocación
  }
  _sessionActive = false;
  window.location.href = '/admin/index.html';
}

function fmtCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function fmtDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR');
}

function statusLabel(status) {
  const labels = {
    pending_payment: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada',
    no_show: 'No-show', completed: 'Completada'
  };
  return labels[status] || status;
}

/**
 * Escapa HTML antes de interpolar en innerHTML. Obligatorio para
 * cualquier campo que haya sido escrito por un huésped.
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function copyToClipboard(text, btn) {
  navigator.clipboard?.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {
    prompt('Copiá esta URL:', text);
  });
}
