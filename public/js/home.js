// Año en footer
const y = document.getElementById("y");
if (y) y.textContent = new Date().getFullYear();

// Cargar eventos desde backend
fetch("/api/events")
  .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP "+r.status)))
  .then(j => {
    const list = Array.isArray(j.events) ? j.events : [];
    const listEl = document.getElementById("evtList");
    const msgEl  = document.getElementById("evtMsg");
    if (!listEl || !msgEl) return;

    if (!list.length){
      msgEl.textContent = "Pronto publicaremos la agenda actualizada.";
      return;
    }
    msgEl.textContent = "";
    for (const ev of list.slice(0,6)) {
      const d = document.createElement("div");
      d.className = "card";
      const when = new Date(ev.start);
      d.innerHTML =
        `<div class="pill">${when.toLocaleDateString()}</div>
         <h4 style="margin:6px 0">${esc(ev.title||"Evento")}</h4>
         <div class="muted">${esc(ev.location||ev.venue||"")}</div>`;
      listEl.appendChild(d);
    }
  })
  .catch(() => {
    const msgEl  = document.getElementById("evtMsg");
    if (msgEl) msgEl.textContent = "No pudimos cargar la agenda ahora.";
  });

function esc(s){
  return String(s||"").replace(/[&<>"]/g, m => (
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;"
  ));
}
