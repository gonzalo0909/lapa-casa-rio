// lapa-casa-hostel/backend/src/admin/js/dashboard.js

function showMsg(elId, text, type) {
  const el = document.getElementById(elId);
  el.innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

/** Barras horizontales simples en HTML/CSS -- sin librería de gráficos (CSP scriptSrc 'self', nada de CDN). */
function renderBarChart(containerId, items, opts = {}) {
  const container = document.getElementById(containerId);
  const max = Math.max(1, ...items.map(i => i.value));
  const formatValue = opts.formatValue || (v => String(v));

  container.innerHTML = items.map(item => `
    <div class="bar-row">
      <span class="bar-label" title="${item.label}">${item.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.round((item.value / max) * 100)}%"></span></span>
      <span class="bar-value">${formatValue(item.value)}</span>
    </div>
  `).join('') || '<p style="color:#888;font-size:14px;">Sin datos para este período.</p>';
}

async function handleLogin(event) {
  event.preventDefault();
  const password = document.getElementById('password').value;
  const totpToken = document.getElementById('totp-token').value;
  try {
    // M-02: el servidor emite la cookie httpOnly en la respuesta — no hay
    // token en el body, la sesión queda activa automáticamente.
    await apiFetch('/admin/login', {
      method: 'POST',
      body: JSON.stringify(totpToken ? { password, totpToken } : { password }),
    });
    _sessionActive = true;
    initDashboard();
  } catch (err) {
    // TOTP_REQUIRED: contraseña correcta, falta el código -- se muestra el
    // campo sin decir "credenciales inválidas" (la contraseña SÍ era correcta).
    if (err.code === 'TOTP_REQUIRED') {
      document.getElementById('totp-field').classList.remove('hidden');
      document.getElementById('totp-token').focus();
      showMsg('login-msg', 'Ingresá el código de 6 dígitos de tu app autenticadora.', 'info');
      return;
    }
    showMsg('login-msg', err.message, 'error');
  }
}

async function loadDashboard() {
  try {
    const data = await apiFetch('/admin/dashboard');

    const kpis = [
      { label: 'Reservas confirmadas', value: data.bookings.confirmedBookings },
      { label: 'Pendientes de pago', value: data.bookings.pendingBookings },
      { label: 'Canceladas', value: data.bookings.cancelledBookings },
      { label: 'Ocupación promedio', value: `${data.occupancy.averagePercent}%` },
      { label: 'Ingreso bruto', value: fmtCurrency(data.revenue.totalGrossRevenue) },
      { label: 'Ingreso neto', value: fmtCurrency(data.revenue.totalNetRevenue) }
    ];
    document.getElementById('kpi-grid').innerHTML = kpis.map(k =>
      `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div></div>`
    ).join('');

    renderBarChart('occupancy-chart',
      data.occupancy.byRoom.map(r => ({ label: r.name, value: r.occupancyPercent })),
      { formatValue: v => `${v}%` }
    );

    renderBarChart('revenue-chart',
      data.revenue.byChannel.map(c => ({ label: c.channelName, value: c.grossRevenue })),
      { formatValue: v => fmtCurrency(v) }
    );
  } catch (err) {
    showMsg('dashboard-msg', err.message, 'error');
  }
}

/**
 * FIX (auditoría 2026-08-30): antes esta tarjeta solo mostraba check-ins
 * (vía /admin/bookings?from=hoy&to=hoy) y no mostraba check-outs del día
 * en absoluto. GET /admin/bookings/today ya existía en el backend --
 * pensado para el panel React que se eliminó -- con check-ins, check-outs
 * y ocupación de hoy en una sola llamada. Se conecta acá.
 */
async function loadTodayActivity() {
  try {
    const data = await apiFetch('/admin/bookings/today');

    document.getElementById('today-occupancy').textContent =
      `— Ocupación: ${data.occupancyToday}/${data.totalBeds} camas`;

    const checkInsBody = document.querySelector('#today-checkins-table tbody');
    checkInsBody.innerHTML = data.checkIns.map(b => `
      <tr>
        <td>${escapeHtml(b.confirmationNumber)}</td>
        <td>${escapeHtml(b.guestName)}</td>
        <td>${b.bedsCount}</td>
        <td>${fmtDate(b.checkOut)}</td>
        <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="color:#888;">Sin check-ins hoy</td></tr>';

    const checkOutsBody = document.querySelector('#today-checkouts-table tbody');
    checkOutsBody.innerHTML = data.checkOuts.map(b => `
      <tr>
        <td>${escapeHtml(b.confirmationNumber)}</td>
        <td>${escapeHtml(b.guestName)}</td>
        <td>${b.bedsCount}</td>
        <td>${fmtDate(b.checkIn)}</td>
        <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="color:#888;">Sin check-outs hoy</td></tr>';
  } catch (err) {
    showMsg('today-checkins-msg', err.message, 'error');
  }
}

/**
 * FIX (auditoría 2026-08-30): la tabla de próximos check-ins usaba
 * data.upcomingCheckIns de GET /admin/dashboard, cuya query nunca
 * seleccionaba check_out_date ni status -- las columnas correspondientes
 * salían vacías/rotas. GET /admin/bookings/upcoming ya existía (también
 * pensado para el panel React eliminado) con las columnas completas y
 * bien nombradas -- se conecta acá en su lugar.
 */
async function loadUpcoming() {
  try {
    const data = await apiFetch('/admin/bookings/upcoming?days=7');
    const tbody = document.querySelector('#upcoming-table tbody');
    tbody.innerHTML = data.bookings.map(b => `
      <tr>
        <td>${escapeHtml(b.confirmationNumber)}</td>
        <td>${escapeHtml(b.guestName)}</td>
        <td>${fmtDate(b.checkIn)}</td>
        <td>${fmtDate(b.checkOut)}</td>
        <td>${b.bedsCount}</td>
        <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="color:#888;">Sin check-ins próximos</td></tr>';
  } catch (err) {
    showMsg('upcoming-msg', err.message, 'error');
  }
}

function initDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('nav-root').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  renderNav('dashboard');
  loadDashboard();
  loadTodayActivity();
  loadUpcoming();
}

// M-02: ya no hay token en localStorage — verificamos la sesión consultando
// el endpoint /admin/me (la cookie httpOnly se envía automáticamente).
(async () => {
  const active = await checkSession();
  if (active) {
    initDashboard();
  } else {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
  }
})();
