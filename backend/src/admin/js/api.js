// lapa-casa-hostel/backend/src/admin/js/api.js
// ventana4 (bloque 2)

const API_BASE = '/api/v1';
const TOKEN_KEY = 'lch_admin_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function isLoginPage() {
  return window.location.pathname.endsWith('/admin/') || window.location.pathname.endsWith('/admin/index.html');
}

/** Redirige a login si no hay token. Llamar al cargar cualquier página que no sea el login. */
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/admin/index.html';
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (!isLoginPage()) window.location.href = '/admin/index.html';
    throw new Error('Sesión expirada');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Error ${res.status}`);
  }
  return body.data;
}

function logout() {
  clearToken();
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
 * cualquier campo que haya sido escrito por un huesped (guest_name,
 * guest_email, etc. vienen de POST /api/v1/bookings, publico y sin
 * autenticacion) -- sin esto, un nombre de huesped como
 * "<img src=x onerror=...>" ejecuta en la sesion del admin (que tiene el
 * JWT en localStorage) la primera vez que alguien abre esta pantalla.
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
