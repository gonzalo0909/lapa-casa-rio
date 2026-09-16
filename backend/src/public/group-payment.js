// group-payment.js — lógica de la página de pago grupal (CSP-safe: sin inline JS)

const API_BASE = '/api/v1';
const token = location.pathname.split('/').filter(Boolean).pop();
let sessionData = null;
let selectedMethod = 'pix';
let countdownInterval = null;
let pollInterval = null;
let docPhotoBase64 = null; // foto del documento (base64 JPEG)

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Redimensiona la imagen a max maxW px de ancho, calidad JPEG 0..1
function resizeImage(file, maxW, quality) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var scale  = Math.min(1, maxW / img.width);
        var canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function init() {
  await loadSession();
  pollInterval = setInterval(loadSession, 10000);
}

async function loadSession() {
  try {
    const r = await fetch(`${API_BASE}/payments/group/${token}`);
    const data = await r.json();
    if (!data.success || !data.data.found) {
      showState('not-found');
      return;
    }
    sessionData = data.data;
    render();
  } catch {
    document.getElementById('loading').textContent = 'Error al cargar. Intentá de nuevo.';
  }
}

function render() {
  document.getElementById('loading').style.display = 'none';

  if (sessionData.expired)   { showState('expired');    return; }
  if (sessionData.completed) { showState('confirmed');  return; }

  document.getElementById('banner').style.display = 'block';

  document.getElementById('status-card').style.display = 'block';
  document.getElementById('paid-beds').textContent  = sessionData.paidBeds;
  document.getElementById('total-beds').textContent = sessionData.totalBeds;
  const pct = sessionData.totalBeds > 0
    ? Math.round((sessionData.paidBeds / sessionData.totalBeds) * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';

  startCountdown(sessionData.expiresAt);

  if (sessionData.members && sessionData.members.length > 0) {
    document.getElementById('members-section').style.display = 'block';
    document.getElementById('members-list').innerHTML = sessionData.members.map(m =>
      '<div class="member-item">' +
        '<div>' +
          '<div class="member-name">' + esc(m.guestName) + '</div>' +
          '<div class="member-method">' + (m.paymentMethod === 'card' ? 'Tarjeta' : 'PIX') + '</div>' +
        '</div>' +
        '<div class="member-paid">Pagado</div>' +
      '</div>'
    ).join('');
  }

  if (sessionData.paidBeds < sessionData.totalBeds) {
    document.getElementById('pay-card').style.display = 'block';
    updatePriceDisplay();
  }
}

function startCountdown(expiresAt) {
  if (countdownInterval) clearInterval(countdownInterval);
  const update = () => {
    const ms = new Date(expiresAt) - new Date();
    if (ms <= 0) { clearInterval(countdownInterval); loadSession(); return; }
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    document.getElementById('countdown-box').classList.toggle('urgent', ms < 5 * 60 * 1000);
    document.getElementById('countdown-text').textContent =
      String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  };
  update();
  countdownInterval = setInterval(update, 1000);
}

function selectMethod(m) {
  selectedMethod = m;
  document.getElementById('btn-pix').classList.toggle('selected', m === 'pix');
  document.getElementById('btn-card').classList.toggle('selected', m === 'card');
  updatePriceDisplay();
}

function updatePriceDisplay() {
  if (!sessionData) return;
  const base     = sessionData.amountPerBed || 0;
  const surcharge = selectedMethod === 'card' ? Math.round(base * 0.10 * 100) / 100 : 0;
  const total    = base + surcharge;
  document.getElementById('price-base').textContent     = 'R$ ' + base.toFixed(2);
  document.getElementById('price-surcharge').textContent = 'R$ ' + surcharge.toFixed(2);
  document.getElementById('price-total').textContent    = 'R$ ' + total.toFixed(2);
  document.getElementById('surcharge-row').style.display = selectedMethod === 'card' ? 'flex' : 'none';
}

function showPixBlock(pixData) {
  document.getElementById('pix-block').style.display = 'block';
  document.getElementById('pix-qr').src = 'data:image/png;base64,' + pixData.qrCodeBase64;
  document.getElementById('pix-code').textContent = pixData.qrCode;
  document.getElementById('pay-form').querySelector('button[type=submit]').style.display = 'none';
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadSession, 5000);
}

function copyPix() {
  navigator.clipboard.writeText(document.getElementById('pix-code').textContent);
  const btn = document.getElementById('btn-copy-pix');
  btn.textContent = 'Copiado';
  setTimeout(() => { btn.textContent = 'Copiar código PIX'; }, 2000);
}

function showState(state) {
  document.getElementById('loading').style.display      = 'none';
  document.getElementById('status-card').style.display  = 'none';
  document.getElementById('pay-card').style.display     = 'none';
  document.getElementById('banner').style.display       = 'none';
  if (state === 'expired')   {
    document.getElementById('expired-state').style.display = 'block';
    clearInterval(pollInterval);
    clearInterval(countdownInterval);
  }
  if (state === 'confirmed') {
    document.getElementById('confirmed-state').style.display = 'block';
    clearInterval(pollInterval);
    clearInterval(countdownInterval);
  }
  if (state === 'not-found') {
    const el = document.getElementById('loading');
    el.style.display = 'block';
    el.textContent = 'Sesión no encontrada.';
  }
}

// ── Event listeners (sin onclick= inline) ────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-pix').addEventListener('click', () => selectMethod('pix'));
  document.getElementById('btn-card').addEventListener('click', () => selectMethod('card'));
  document.getElementById('btn-copy-pix').addEventListener('click', copyPix);

  // ── Foto del documento ──────────────────────────────────────
  const docInput  = document.getElementById('f-doc-photo');
  const docBtn    = document.getElementById('doc-upload-btn');
  const docPrev   = document.getElementById('doc-preview');
  const docImg    = document.getElementById('doc-img');
  const changeBtn = document.getElementById('btn-change-doc');

  docInput.addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;
    const docText = document.getElementById('doc-upload-text');
    try {
      docPhotoBase64 = await resizeImage(file, 900, 0.82);
      docImg.src = docPhotoBase64;
      docText.textContent = file.name;
      docBtn.classList.add('has-file');
      docPrev.style.display = 'block';
    } catch {
      docText.textContent = 'Error al procesar la imagen';
    }
  });

  changeBtn.addEventListener('click', function() {
    docInput.click();
  });

  document.getElementById('pay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('btn-pay');
    const errEl = document.getElementById('pay-error');
    errEl.style.display = 'none';

    if (!docPhotoBase64) {
      errEl.textContent = 'La foto del documento es obligatoria.';
      errEl.style.display = 'block';
      return;
    }
    if (!document.getElementById('restriction-check').checked) {
      errEl.textContent = 'Debés confirmar que leíste y aceptás las restricciones antes de pagar.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
      const r = await fetch(`${API_BASE}/payments/group/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: {
            full_name: document.getElementById('f-name').value.trim(),
            email:     document.getElementById('f-email').value.trim(),
            phone:     document.getElementById('f-phone').value.trim()   || undefined,
            country:   document.getElementById('f-country').value.trim() || undefined,
          },
          paymentMethod: selectedMethod,
          documentPhotoBase64: docPhotoBase64,
        }),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Error al procesar el pago');

      const result = data.data;
      if (selectedMethod === 'card' && result.checkoutUrl) {
        location.href = result.checkoutUrl;
      } else if (selectedMethod === 'pix' && result.pixData) {
        showPixBlock(result.pixData);
        btn.disabled = false;
        btn.textContent = 'Continuar con el pago';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Continuar con el pago';
    }
  });

  init();
});
