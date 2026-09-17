// lapa-casa-hostel/backend/src/admin/js/nav.js
// Barra de navegación compartida entre las páginas del panel.
//
// Bloqueos, Ofertas y Precios dinámicos dejaron de ser pestañas propias
// acá -- ahora viven embebidos (vía iframe) dentro de Hostel y de
// Apartamentos, cada uno filtrado a su tipo de propiedad. Precios
// (temporadas, descuento por grupo, guardavolumes, tarjeta, PIX) también
// se movió adentro de Hostel completo -- son todos conceptos por cama,
// no aplican a apartamentos. Sus páginas siguen existiendo
// (blocking.html, offers.html, dynamic-pricing.html, pricing.html) para
// poder embeberse, pero no aparecen en esta barra.
//
// ?embed=1 en la URL oculta esta barra por completo -- es la señal que
// usan esas páginas cuando se cargan dentro de un <iframe>, para no
// mostrar una segunda barra de navegación dentro de otra.

function renderNav(activePage) {
  const root = document.getElementById('nav-root');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') === '1') {
    root.remove();
    return;
  }

  const links = [
    { href: '/admin/index.html', label: 'Dashboard', page: 'dashboard' },
    { href: '/admin/bookings.html', label: 'Reservas', page: 'bookings' },
    { href: '/admin/rooms.html', label: 'Hostel', page: 'rooms' },
    { href: '/admin/apartments.html', label: 'Apartamentos', page: 'apartments' },
    { href: '/admin/owners.html', label: 'Administradores', page: 'owners' },
    { href: '/admin/conflicts.html', label: 'Conflictos', page: 'conflicts' },
    { href: '/admin/photos.html', label: 'Fotos huésp.', page: 'photos' },
    { href: '/admin/gallery.html', label: 'Galería', page: 'gallery' },
    { href: '/admin/ical.html', label: 'iCal / OTAs', page: 'ical' },
    { href: '/admin/blacklist.html', label: 'Lista negra', page: 'blacklist' },
    { href: '/admin/security.html', label: 'Seguridad', page: 'security' }
  ];

  const linksHtml = links.map(l =>
    `<a href="${l.href}"${l.page === activePage ? ' class="active"' : ''}>${l.label}</a>`
  ).join('');

  root.innerHTML = `
    <header class="topbar">
      <span class="brand">LAPA CASA — Admin</span>
      <nav class="tabs">${linksHtml}</nav>
      <button id="logout-btn">Salir</button>
    </header>
  `;

  document.getElementById('logout-btn').addEventListener('click', logout);
}
