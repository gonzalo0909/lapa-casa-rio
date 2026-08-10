// lapa-casa-hostel/backend/src/admin/js/dashboard.js
// ventana4 (bloque 2)

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
  try {
    const data = await apiFetch('/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    setToken(data.token);
    initDashboard();
  } catch (err) {
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

    const tbody = document.querySelector('#upcoming-table tbody');
    tbody.innerHTML = data.upcomingCheckIns.map(b => `
      <tr>
        <td>${escapeHtml(b.reservation_number)}</td>
        <td>${escapeHtml(b.guest_name)}</td>
        <td>${fmtDate(b.check_in_date)}</td>
        <td>${fmtDate(b.check_out_date)}</td>
        <td>${b.beds_count}</td>
        <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="color:#888;">Sin check-ins próximos</td></tr>';
  } catch (err) {
    showMsg('dashboard-msg', err.message, 'error');
  }
}

async function loadTodayCheckIns() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const data = await apiFetch(`/admin/bookings?from=${today}&to=${today}&limit=50`);
    const tbody = document.querySelector('#today-checkins-table tbody');
    const rows = data.bookings ?? [];
    tbody.innerHTML = rows.map(b => `
      <tr>
        <td>${escapeHtml(b.reservation_number)}</td>
        <td>${escapeHtml(b.guest_name)}</td>
        <td style="font-size:12px;color:#888;">${escapeHtml(b.guest_email)}</td>
        <td>${b.beds_count}</td>
        <td>${fmtDate(b.check_out_date)}</td>
        <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="color:#888;">Sin check-ins hoy</td></tr>';
  } catch (err) {
    showMsg('today-checkins-msg', err.message, 'error');
  }
}

function initDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('nav-root').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  renderNav('dashboard');
  loadDashboard();
  loadTodayCheckIns();
}

if (getToken()) {
  initDashboard();
} else {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}
