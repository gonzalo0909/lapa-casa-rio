// Fix ± botones Hombres/Mujeres (robusto y sin dependencias)
(function () {
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n|0));
  const byId = (id) => document.getElementById(id);

  function bump(inputId, delta) {
    const el = byId(inputId);
    if (!el) return;
    const min = +(el.getAttribute("min") || 0);
    const max = +(el.getAttribute("max") || 38);
    const v = clamp((parseInt(el.value, 10) || 0) + delta, min, max);
    el.value = v;
    // dispara eventos por si otros cálculos dependen del cambio
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Delegación de clics: menos código y soporta HTML re-render
  document.addEventListener("click", (e) => {
    const id = (e.target && e.target.id) || "";
    if (id === "menMinus")  { e.preventDefault(); bump("men",   -1); }
    if (id === "menPlus")   { e.preventDefault(); bump("men",    1); }
    if (id === "womenMinus"){ e.preventDefault(); bump("women", -1); }
    if (id === "womenPlus") { e.preventDefault(); bump("women",  1); }
  }, true);
})();
