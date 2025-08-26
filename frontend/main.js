/**
 * main.js
 * Lógica del frontend para reservas en Lapa Casa Hostel
 * Gestiona disponibilidad, selección de camas, holds y pagos
 */

(function () {
  "use strict";

  // === Configuración base ===
  const metaApi = document.querySelector('meta[name="backend-base-url"]');
  const metaKey = document.querySelector('meta[name="stripe-publishable-key"]');
  
  const API_BASE = (window.API_BASE || (metaApi ? metaApi.getAttribute("content") : "")).replace(/\/$/, "");
  const STRIPE_PK = metaKey ? metaKey.getAttribute("content") || "" : window.STRIPE_PUBLISHABLE_KEY || "";

  const $ = (s) => document.querySelector(s);

  // === Endpoints API ===
  const EP = {
    PING: () => `${API_BASE}/ping`,
    AVAIL: () => `${API_BASE}/availability`,
    HOLDS_START: () => `${API_BASE}/holds/start`,
    HOLDS_CONFIRM: () => `${API_BASE}/holds/confirm`,
    HOLDS_RELEASE: () => `${API_BASE}/holds/release`,
    PAY_STRIPE: () => `${API_BASE}/payments/stripe/session`,
    PAY_STATUS: () => `${API_BASE}/bookings/status`
  };

  // === Fetch robusto con fallback ===
  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, Object.assign({ headers: { Accept: "application/json" } }, opts));
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const data = ct.includes("application/json") ? await r.json() : await tryParseJSON(await r.text());
    if (!r.ok && !(data && data.ok)) throw new Error(`HTTP ${r.status}`);
    return data;
  }

  async function tryParseJSON(txt) {
    try {
      return JSON.parse(txt);
    } catch (e) {
      throw new Error(`bad_json: ${txt.slice(0, 200)}`);
    }
  }

  // === Router (book / admin) ===
  function route() {
    const hash = location.hash || "#/book";
    $("#book") && ($("#book").style.display = hash === "#/book" ? "block" : "none");
    $("#admin") && ($("#admin").style.display = hash === "#/admin" ? "block" : "none");
  }
  window.addEventListener("hashchange", route);
  route();

  // === Ping inicial ===
  (async () => {
    try {
      await fetchJSON(EP.PING());
    } catch (e) {
      console.warn("⚠️ API no disponible:", e.message);
    }
  })();

  // === Datos de habitaciones ===
  const ROOMS = {
    1: { name: "Cuarto 1 (12 mixto)", cap: 12, basePrice: 55, femaleOnly: false },
    3: { name: "Cuarto 3 (12 mixto)", cap: 12, basePrice: 55, femaleOnly: false },
    5: { name: "Cuarto 5 (7 mixto)", cap: 7, basePrice: 65, femaleOnly: false },
    6: { name: "Cuarto 6 (7 femenino)", cap: 7, basePrice: 60, femaleOnly: true }
  };

  let selection = {}, currentHoldId = null, paidFinal = false, internalTotal = 0;

  // === Funciones auxiliares ===
  const toISO = (d) => new Date(d + "T00:00:00");
  const diffNights = (a, b) => Math.max(0, Math.round((toISO(b) - toISO(a)) / 86400000));
  const fmtBRL = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const priceModifiers = (start, end) => {
    let weekend = false, high = false;
    const n = diffNights(start, end);
    for (let i = 0; i < n; i++) {
      const d = new Date(toISO(start));
      d.setDate(d.getDate() + i);
      if ([5, 6, 0].includes(d.getDay())) weekend = true;
      if ([11, 0, 1].includes(d.getMonth())) high = true;
    }
    return (weekend ? 1.10 : 1) * (high ? 1.20 : 1);
  };

  const pricePerBed = (roomId, start, end) => Math.round(ROOMS[roomId].basePrice * priceModifiers(start, end));

  // === Inicializar fechas ===
  (function initDates() {
    const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const di = $("#dateIn"), doo = $("#dateOut");
    if (di) { di.min = toYMD(now); di.value = di.value || toYMD(now); }
    if (doo) { doo.min = toYMD(tomorrow); doo.value = doo.value || toYMD(tomorrow); }
  })();

  // === Manejo de conteo de huéspedes ===
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function step(input, delta) {
    const min = Number(input.min || 0), max = Number(input.max || 38), cur = Number(input.value || 0);
    const other = input.id === "men" ? Number($("#women").value || 0) : Number($("#men").value || 0);
    input.value = clamp(cur + delta, min, max - other);
    handleCountsChange();
  }

  document.getElementById("menMinus")?.addEventListener("click", () => step($("#men"), -1));
  document.getElementById("menPlus")?.addEventListener("click", () => step($("#men"), 1));
  document.getElementById("womenMinus")?.addEventListener("click", () => step($("#women"), -1));
  document.getElementById("womenPlus")?.addEventListener("click", () => step($("#women"), 1));
  $("#men")?.addEventListener("input", handleCountsChange);
  $("#women")?.addEventListener("input", handleCountsChange);

  function handleCountsChange() {
    const men = Number($("#men").value || 0), women = Number($("#women").value || 0), qty = men + women;
    if (women === 0 && selection[6]?.size) {
      selection[6] = new Set();
      Array.from(document.querySelectorAll("#beds-6 .bed.selected")).forEach(el => el.classList.remove("selected"));
    }
    if (qty === 0) {
      selection = {};
      $("#rooms").innerHTML = "";
      $("#roomsCard").style.display = "none";
      $("#formCard").style.display = "none";
      $("#selCount").textContent = "0";
      $("#needed").textContent = "0";
      $("#totalPrice").textContent = "0";
      $("#continueBtn").disabled = true;
      $("#checkMsg").textContent = "Seleccioná al menos 1 huésped.";
      return;
    }
    if ($("#roomsCard").style.display !== "none") {
      $("#checkAvail")?.click();
    }
  }

  // === Consultar disponibilidad ===
  document.getElementById("checkAvail")?.addEventListener("click", async () => {
    const dIn = $("#dateIn").value, dOut = $("#dateOut").value;
    const men = Number($("#men").value || 0), women = Number($("#women").value || 0), qty = men + women;
    const msg = $("#checkMsg");

    if (!dIn || !dOut) return msg.innerHTML = '<span class="err">Elegí check-in y check-out.</span>';
    if (dOut <= dIn) return msg.innerHTML = '<span class="err">El check-out debe ser posterior.</span>';
    if (qty < 1) return msg.innerHTML = '<span class="err">Indicá al menos 1 huésped.</span>';

    msg.textContent = "Consultando disponibilidad...";
    let occupied = {};

    try {
      const url = `${EP.AVAIL()}?from=${encodeURIComponent(dIn)}&to=${encodeURIComponent(dOut)}`;
      const j = await fetchJSON(url);
      occupied = j.occupied || {};
    } catch (err) {
      console.error("AVAIL error", err);
      occupied = {};
      msg.innerHTML = '<span class="err">Error de conexión. Asumiendo disponibilidad.</span>';
    }

    renderAvailability(dIn, dOut, men, women, occupied);
    msg.textContent = "Disponibilidad actualizada";
  });

  // === Renderizar habitaciones disponibles ===
  function renderAvailability(dateIn, dateOut, men, women, occupied) {
    selection = {};
    $("#rooms").innerHTML = "";
    const qty = men + women;
    if (qty === 0) {
      $("#roomsCard").style.display = "none";
      $("#formCard").style.display = "none";
      return;
    }

    $("#roomsCard").style.display = "block";
    $("#formCard").style.display = "none";

    const nights = diffNights(dateIn, dateOut);
    $("#needed").textContent = qty;
    $("#selCount").textContent = 0;
    internalTotal = 0;
    $("#totalPrice").textContent = 0;
    $("#continueBtn").disabled = true;
    $("#suggestBox").style.display = "none";

    const freeByRoom = {};
    [1, 3, 5, 6].forEach(id => {
      const occ = new Set((occupied && occupied[id]) || []);
      const free = [];
      for (let b = 1; b <= ROOMS[id].cap; b++) if (!occ.has(b)) free.push(b);
      freeByRoom[id] = free;
    });

    const paxTotal = qty;
    const overrideRoom6 = (paxTotal >= 32);
    const toShow = new Set();

    if (men > 0 && women === 0) { toShow.add(1); if (men > 12) toShow.add(3); toShow.add(5); if (overrideRoom6) toShow.add(6); }
    else if (men > 0 && women > 0) { toShow.add(1); if (men > 12) toShow.add(3); toShow.add(5); toShow.add(6); }
    else if (men === 0 && women > 0) { toShow.add(1); toShow.add(5); toShow.add(6); }

    const finalShow = Array.from(toShow).filter(id => (freeByRoom[id]?.length || 0) > 0)
      .sort((a, b) => [1, 3, 5, 6].indexOf(a) - [1, 3, 5, 6].indexOf(b));

    if (!finalShow.length) {
      $("#rooms").innerHTML = '<p>No hay camas disponibles.</p>';
      return;
    }

    const totalLibres = finalShow.reduce((sum, id) => sum + (freeByRoom[id]?.length || 0), 0);
    if (totalLibres < paxTotal) {
      const sb = $("#suggestBox");
      sb.style.display = "block";
      sb.textContent = "No hay suficientes camas disponibles. Probá cambiar fechas o reducir pax.";
    }

    finalShow.forEach(id => {
      const r = ROOMS[id], libres = freeByRoom[id], pBed = pricePerBed(id, dateIn, dateOut);
      const nightsText = nights || 1;
      const isFemaleOnlyHere = (id === 6) ? (ROOMS[6].femaleOnly && !overrideRoom6) : false;
      const extra = (id === 6 && isFemaleOnlyHere) ? ' · Exclusivo para mujeres' : '';
      let roomTitle = r.name;
      if (id === 6 && overrideRoom6) roomTitle = 'Cuarto 6 (7 mixto)';

      const roomDiv = document.createElement("div");
      roomDiv.className = "room";
      roomDiv.innerHTML = `<h3>${roomTitle}</h3><div><span class="muted">Disponibles: ${libres.length}/${r.cap} · Precio por cama: R$ ${pBed} · Noches: ${nightsText}${extra}</span></div><div class="beds" id="beds-${id}"></div>`;
      $("#rooms").appendChild(roomDiv);

      selection[id] = new Set();
      const grid = roomDiv.querySelector(`#beds-${id}`);
      const occ = new Set((occupied && occupied[id]) || []);
      const disableFemale = (id === 6 && isFemaleOnlyHere && Number($("#women").value || 0) < 1);

      for (let b = 1; b <= r.cap; b++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `bed ${occ.has(b) ? "occupied" : ""} ${disableFemale ? "disabled" : ""}`;
        btn.textContent = b;
        if (occ.has(b) || disableFemale) btn.disabled = true;
        if (disableFemale) btn.title = "Exclusivo para mujeres.";
        else btn.addEventListener("click", () => toggleBed(id, b, dateIn, dateOut, btn, isFemaleOnlyHere));
        grid.appendChild(btn);
      }
    });

    refreshTotals(men, women, dateIn, dateOut, overrideRoom6);
  }

  function toggleBed(roomId, bedId, dateIn, dateOut, btn, isFemaleOnlyHere) {
    const women = Number($("#women").value || 0);
    if (roomId === 6 && isFemaleOnlyHere && women < 1) {
      alert('El cuarto femenino requiere al menos 1 mujer.');
      return;
    }
    const set = selection[roomId] || new Set();
    set.has(bedId) ? set.delete(bedId) : set.add(bedId);
    selection[roomId] = set;
    btn.classList.toggle("selected", set.has(bedId));
    const men = Number($("#men").value || 0);
    refreshTotals(men, women, dateIn, dateOut, !isFemaleOnlyHere);
  }

  function refreshTotals(men, women, start, end, room6Override = false) {
    const needed = men + women;
    const nights = diffNights(start, end) || 1;
    let selectedCount = 0, total = 0, femaleSelected = 0;

    Object.entries(selection).forEach(([id, set]) => {
      const size = set.size;
      selectedCount += size;
      const pBed = pricePerBed(Number(id), start, end);
      total += size * pBed * nights;
      if (Number(id) === 6 && !room6Override) femaleSelected += size;
    });

    $("#selCount").textContent = selectedCount;
    internalTotal = total;
    $("#totalPrice").textContent = fmtBRL(total);
    const ok = (selectedCount === needed && needed > 0) && (!room6Override || femaleSelected <= women);
    $("#continueBtn").disabled = !ok;

    const sb = $("#suggestBox");
    sb.style.display = ok ? "none" : "block";
    sb.textContent = !ok ? (femaleSelected > women ? 'El cuarto femenino requiere al menos 1 mujer.' : `Seleccioná exactamente ${needed} camas.`) : "";
  }

  // === Crear HOLD ===
  function buildOrderBase() {
    const a = $("#dateIn").value, b = $("#dateOut").value;
    const nights = Math.max(1, Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000));
    return {
      bookingId: currentHoldId || `BKG-${Date.now()}`,
      nombre: $('#reserva-form [name="nombre"]')?.value || '',
      email: $('#reserva-form [name="email"]')?.value || '',
      telefono: $('#reserva-form [name="telefono"]')?.value || '',
      entrada: a, salida: b, hombres: Number($("#men").value || 0), mujeres: Number($("#women").value || 0),
      camas: (() => { const o = {}; for (const [id, set] of Object.entries(selection)) o[id] = Array.from(set || []); return o; })(),
      total: internalTotal, nights
    };
  }

  document.getElementById("continueBtn")?.addEventListener("click", async () => {
    const order = buildOrderBase();
    if (!order.total) return alert("Seleccioná camas primero.");
    try {
      const j = await fetchJSON(EP.HOLDS_START(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: order.bookingId, ...order })
      });
      currentHoldId = j.holdId || order.bookingId;
      $("#formCard").style.display = "block";
      $('#reserva-form [name="entrada"]').value = $("#dateIn").value;
      $('#reserva-form [name="salida"]').value = $("#dateOut").value;
      window.scrollTo({ top: $("#formCard").offsetTop - 10, behavior: "smooth" });
      alert("Camas reservadas por 10 min (HOLD)");
    } catch (e) {
      alert("Error creando HOLD: " + (e.message || e));
    }
  });

  // === Pagos ===
  document.getElementById("payMP")?.addEventListener("click", async () => {
    alert("Integración con Mercado Pago en desarrollo");
  });

  document.getElementById("payPix")?.addEventListener("click", async () => {
    alert("Pix: Integración en desarrollo");
  });

  document.getElementById("payStripe")?.addEventListener("click", async () => {
    try {
      const order = buildOrderBase();
      const j = await fetchJSON(EP.PAY_STRIPE(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order })
      });
      if (!j.id) throw new Error("session id vacío");
      const stripe = window.Stripe?.(STRIPE_PK);
      if (!stripe) return alert("Stripe no disponible");
      const { error } = await stripe.redirectToCheckout({ sessionId: j.id });
      if (error) alert(error.message || "Error Stripe");
    } catch (e) {
      alert("Error Stripe: " + (e.message || e));
    }
  });

  // === Confirmar reserva ===
  document.getElementById('reserva-form')?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    try {
      if (!document.getElementById('consentChk').checked) {
        alert("Aceptá la política.");
        btn.disabled = false;
        return;
      }
      const order = buildOrderBase();
      try {
        const js = await fetchJSON(`${EP.PAY_STATUS()}?bookingId=${encodeURIComponent(order.bookingId)}`);
        if (js && (js.paid === true || js.status === 'approved' || js.status === 'paid')) {
          document.getElementById("payState").textContent = "aprobado";
        }
      } catch { }
      const paidTxt = (document.getElementById("payState").textContent || '').toLowerCase();
      const paidOk = paidTxt.includes('apro') || paidTxt === 'approved' || paidTxt === 'paid';
      if (!paidOk) {
        alert("Necesitás completar el pago.");
        btn.disabled = false;
        return;
      }
      await fetchJSON(EP.HOLDS_CONFIRM(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: currentHoldId || order.bookingId, status: "paid" })
      });
      paidFinal = true;
      alert("✅ Reserva registrada");
    } catch (e) {
      alert("Error confirmando: " + (e.message || e));
      btn.disabled = false;
    }
  });

  // === Liberar HOLD al salir ===
  window.addEventListener("beforeunload", () => {
    if (currentHoldId && !paidFinal) {
      navigator.sendBeacon(EP.HOLDS_RELEASE(), new Blob([JSON.stringify({ holdId: currentHoldId })], { type: "application/json" }));
    }
  });

  // === Admin ===
  async function authFetch(url, opts = {}) {
    const token = document.getElementById("admToken")?.value || "";
    const headers = { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    return fetch(url, { ...opts, headers });
  }

  document.getElementById('btnHealth')?.addEventListener("click", async () => {
    try {
      const r = await authFetch(EP.PING().replace("/ping", "/health"));
      const j = await r.json();
      document.getElementById('healthOut').textContent = JSON.stringify(j, null, 2);
    } catch (e) {
      document.getElementById('healthOut').textContent = String(e);
    }
  });

  document.getElementById('btnHolds')?.addEventListener("click", async () => {
    try {
      const j = await fetchJSON(`${API_BASE}/holds/list`);
      const div = document.getElementById('holdsOut');
      const rows = (j.holds || []).map(h => `
        <tr>
          <td>${h.holdId}</td>
          <td>${h.entrada}→${h.salida}</td>
          <td>${h.status}</td>
          <td>${Object.entries(h.camas || {}).map(([rid, bs]) => `${rid}:${bs.join('-')}`).join(', ')}</td>
          <td>
            <button data-act="confirm" data-id="${h.holdId}">confirm</button>
            <button data-act="release" data-id="${h.holdId}">release</button>
          </td>
        </tr>
      `).join('');
      div.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>Fechas</th><th>Status</th><th>Camas</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      div.querySelectorAll('button[data-act]').forEach(b => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
          const ep = act === 'confirm' ? EP.HOLDS_CONFIRM() : EP.HOLDS_RELEASE();
          await fetchJSON(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holdId: id })
          });
          document.getElementById('btnHolds').click();
        });
      });
    } catch (e) {
      document.getElementById('holdsOut').textContent = String(e);
    }
  });

  document.getElementById('btnBookings')?.addEventListener("click", async () => {
    try {
      const qs = new URLSearchParams();
      if (document.getElementById('bkFrom')?.value) qs.set('from', document.getElementById('bkFrom').value);
      if (document.getElementById('bkTo')?.value) qs.set('to', document.getElementById('bkTo').value);
      if (document.getElementById('bkQ')?.value) qs.set('q', document.getElementById('bkQ').value);
      const j = await fetchJSON(`${API_BASE}/bookings?${qs.toString()}`);
      const div = document.getElementById('bookingsOut');
      const rows = (j.rows || []).slice(0, 100).map(b => `
        <tr>
          <td>${b.booking_id || ''}</td>
          <td>${b.entrada || ''}</td>
          <td>${b.salida || ''}</td>
          <td>${b.hombres || 0}+${b.mujeres || 0}</td>
          <td>${b.pay_status || ''}</td>
        </tr>
      `).join('');
      div.innerHTML = `
        <table>
          <thead><tr><th>Booking</th><th>In</th><th>Out</th><th>PAX</th><th>Pay</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (e) {
      document.getElementById('bookingsOut').textContent = String(e);
    }
  });
})();
