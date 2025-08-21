// asume que ya tienes buildOrderBase()

// Checkout Pro (puede mostrar Pix o no, según tu cuenta)
document.getElementById('payMP')?.addEventListener('click', async () => {
  const order = buildOrderBase();
  const r = await fetch('/api/payments/mp/preference', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  const j = await r.json();
  if (!r.ok || !j.init_point) { alert('Error MP'); return; }
  window.location.href = j.init_point;
});

// PIX directo (Checkout Transparente) — siempre muestra QR/copia y cola
document.getElementById('payPix')?.addEventListener('click', async () => {
  const order = buildOrderBase();
  const r = await fetch('/api/payments/mp/pix', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  const j = await r.json();
  if (!r.ok || !(j.qr_code_base64 || j.ticket_url)) {
    console.error(j); alert('Error PIX'); return;
  }
  const modal = document.getElementById('pixModal');
  const img   = document.getElementById('pixQr');
  const ta    = document.getElementById('pixCopiaCola');
  const tk    = document.getElementById('pixTicket');
  img.src = j.qr_code_base64 ? `data:image/png;base64,${j.qr_code_base64}` : '';
  ta.value = j.qr_code || '';
  if (j.ticket_url) { tk.style.display='inline-block'; tk.href = j.ticket_url; } else { tk.style.display='none'; }
  modal.style.display = 'flex';
});

document.getElementById('copyPix')?.addEventListener('click', async () => {
  try {
    const ta = document.getElementById('pixCopiaCola');
    ta.select(); ta.setSelectionRange(0, 99999);
    await navigator.clipboard.writeText(ta.value);
    alert('Código Pix copiado');
  } catch { alert('No se pudo copiar'); }
});

document.getElementById('closePix')?.addEventListener('click', () => {
  document.getElementById('pixModal').style.display = 'none';
});

// Stripe
document.getElementById('payStripe')?.addEventListener('click', async () => {
  const order = buildOrderBase();
  const r = await fetch('/api/payments/stripe/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  const j = await r.json();
  if (!r.ok || !j.id) { alert('Error Stripe'); return; }
  const stripe = window.Stripe?.(window.STRIPE_PUBLISHABLE_KEY);
  if (!stripe) { alert('Stripe no disponible'); return; }
  const { error } = await stripe.redirectToCheckout({ sessionId: j.id });
  if (error) alert(error.message || 'Error Stripe');
});
