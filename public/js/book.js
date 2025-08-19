"use strict";
/**
 * /public/js/book.js — Versión compatible con el flujo nuevo
 * - No duplica listeners si el script de /book/index.html ya gestiona la UI
 * - Crea HOLD antes de iniciar el pago
 * - Usa endpoints correctos:
 *    - /holds/start
 *    - /payments/stripe/session
 *    - /payments/mp/preference
 * - Evita reventar si faltan nodos (deploys que no cargan este JS en /book/)
 */

(function () {
  // Si la página /book/index.html ya define su lógica (continueBtn, payMP, payStripe), no dupliques.
  var hasNewFlow =
    document.getElementById("continueBtn") &&
    document.getElementById("payMP") &&
    document.getElementById("payStripe") &&
    document.getElementById("reserva-form");

  if (hasNewFlow) {
    // El front “nuevo” ya maneja todo. Salimos para no colisionar.
    return;
  }

  // ---- Modo compat: formulario simple con id bookingForm (versión anterior)
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bookingForm");
    const btnStripe = document.getElementById("payStripe");
    const btnMP = document.getElementById("payMP");

    if (!form) return; // esta página no usa el form antiguo

    async function apiPost(path, data = {}) {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      let j = null;
      try { j = await res.json(); } catch {}
      return { ok: res.ok, data: j };
    }

    // Crea un HOLD y devuelve { bookingId, total }
    async function createHoldFromForm() {
      const payload = {
        holdId: undefined,
        nombre: form.nombre?.value || "",
        email: form.email?.value || "",
        telefono: form.telefono?.value || "",
        entrada: form.entrada?.value || "",
        salida: form.salida?.value || "",
        hombres: Number(form.hombres?.value || 0),
        mujeres: Number(form.mujeres?.value || 0),
        camas: {}, // este form antiguo no trae selección por cama
        total: Number(form.total?.value || 0), // si no hay total, el backend puede recalcular más adelante
      };

      // Validaciones mínimas
      if (!payload.entrada || !payload.salida) throw new Error("Elegí fechas.");
      if (!payload.nombre || !payload.email) throw new Error("Completá nombre y email.");

      const r = await apiPost("/holds/start", payload);
      if (!r.ok || !r.data || r.data.ok !== true) {
        throw new Error("No se pudo crear HOLD");
      }
      return {
        bookingId: r.data.holdId,
        total: payload.total,
      };
    }

    async function startStripe() {
      const { bookingId, total } = await createHoldFromForm();
      const r = await apiPost("/payments/stripe/session", { order: { bookingId, total } });
      if (!r.ok || !r.data || !r.data.id) throw new Error(r.data?.error || "No se pudo crear sesión de Stripe");
      // si hay URL directa, úsala; si no, usa Stripe.js si está disponible
      if (r.data.url) {
        window.location.href = r.data.url;
        return;
      }
      // fallback con Stripe.js si está cargado
      if (window.Stripe) {
        const stripe = window.Stripe(window.STRIPE_PUBLISHABLE_KEY || "");
        const ret = await stripe.redirectToCheckout({ sessionId: r.data.id });
        if (ret && ret.error) throw ret.error;
      } else {
        throw new Error("Stripe no disponible en este momento.");
      }
    }

    async function startMP() {
      const { bookingId, total } = await createHoldFromForm();
      const r = await apiPost("/payments/mp/preference", { order: { bookingId, total } });
      if (!r.ok || !r.data || !r.data.init_point) throw new Error(r.data?.error || "No se pudo crear preferencia MP");
      window.location.href = r.data.init_point;
    }

    // Interacciones
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Elegí método de pago (Stripe o Mercado Pago).");
      });
    }
    if (btnStripe) {
      btnStripe.addEventListener("click", async () => {
        btnStripe.disabled = true;
        try {
          await startStripe();
        } catch (err) {
          alert("Error iniciando Stripe: " + (err?.message || err));
        } finally {
          btnStripe.disabled = false;
        }
      });
    }
    if (btnMP) {
      btnMP.addEventListener("click", async () => {
        btnMP.disabled = true;
        try {
          await startMP();
        } catch (err) {
          alert("Error iniciando Mercado Pago: " + (err?.message || err));
        } finally {
          btnMP.disabled = false;
        }
      });
    }
  });
})();
