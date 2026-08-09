// lapa-casa-hostel/backend/src/admin/js/nav.js
// ventana4 (bloque 2): barra de navegación compartida entre las 4 páginas del panel

function renderNav(activePage) {
  const root = document.getElementById('nav-root');
  if (!root) return;

  const links = [
    { href: '/admin/index.html', label: 'Dashboard', page: 'dashboard' },
    { href: '/admin/bookings.html', label: 'Reservas', page: 'bookings' },
    { href: '/admin/rooms.html', label: 'Habitaciones', page: 'rooms' },
    { href: '/admin/pricing.html', label: 'Precios', page: 'pricing' },
    { href: '/admin/conflicts.html', label: 'Conflictos', page: 'conflicts' },
    { href: '/admin/photos.html', label: 'Fotos', page: 'photos' },
    { href: '/admin/blocking.html', label: 'Bloqueos', page: 'blocking' }
  ];

  const linksHtml = links.map(l =>
    `<a href="${l.href}"${l.page === activePage ? ' class="active"' : ''}>${l.label}</a>`
  ).join('');

  root.innerHTML = `
    <header class="topbar">
      <span class="brand">LAPA CASA HOSTEL — Admin</span>
      <nav class="tabs">${linksHtml}</nav>
      <button id="logout-btn">Salir</button>
    </header>
  `;

  document.getElementById('logout-btn').addEventListener('click', logout);
}
