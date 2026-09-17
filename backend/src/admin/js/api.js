// lapa-casa-hostel/backend/src/admin/js/api.js
// M-02: JWT migrado de localStorage a httpOnly cookie.
// El servidor emite la cookie en el login (Set-Cookie: lch_admin=...; HttpOnly; SameSite=Strict)
// y todas las rutas de admin la leen automáticamente — el JS nunca
// puede acceder al token, lo que elimina el vector XSS de robo de JWT.

const API_BASE = '/api/v1';

/** Lee el valor de una cookie no-httpOnly por nombre (para el token CSRF). */
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

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
  // 2fa-recovery.html también es pre-sesión: un 401 ahí (contraseña o
  // código de respaldo inválido) debe mostrar el error en la propia
  // página, no mandar a /admin/index.html como si la sesión hubiera
  // expirado.
  return window.location.pathname.endsWith('/admin/')
    || window.location.pathname.endsWith('/admin/index.html')
    || window.location.pathname.endsWith('/admin/2fa-recovery.html');
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  // CSRF (patrón doble cookie, ver backend/src/middleware/csrf.ts): en
  // requests que modifican datos hay que reenviar el token de la cookie
  // lch_admin_csrf (no-httpOnly, la emite el login) en este header. GET no
  // lo necesita -- el middleware solo lo exige en métodos que escriben.
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const csrfToken = getCookie('lch_admin_csrf');
    if (csrfToken) {headers['x-csrf-token'] = csrfToken;}
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // M-02: la cookie httpOnly se envía automáticamente
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    _sessionActive = false;
    // En la página de login un 401 significa contraseña incorrecta o 2FA
    // pendiente (ver body.code, TOTP_REQUIRED/TOTP_INVALID) — no redirigir.
    // En cualquier otra página significa sesión vencida — redirigir al login.
    if (!isLoginPage()) {
      window.location.href = '/admin/index.html';
      throw new Error('Sesión expirada');
    }
    const err = new Error(body.error || 'Credenciales inválidas');
    err.code = body.code;
    throw err;
  }

  if (!res.ok || body.success === false) {
    const err = new Error(body.error || `Error ${res.status}`);
    err.code = body.code;
    throw err;
  }
  return body.data;
}

async function logout() {
  try {
    // M-03: revoca el token en el servidor antes de limpiar la sesión.
    // OJO: adminAuthRouter se monta en /admin/login (ver routes/index.ts),
    // así que su sub-ruta /logout cuelga de /admin/login/logout, no de
    // /admin/auth/logout -- con la URL vieja este fetch caía en el 404
    // catch-all silenciosamente (el catch de abajo se comía el error), la
    // cookie httpOnly nunca se limpiaba del lado del servidor y el token
    // jamás se revocaba en Redis pese al comentario de la línea de abajo.
    const csrfToken = getCookie('lch_admin_csrf');
    await fetch(`${API_BASE}/admin/login/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
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
