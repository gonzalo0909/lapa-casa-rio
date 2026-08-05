// lapa-casa-hostel/backend/src/admin/js/conflicts.js
// ventana5

requireAuth();
renderNav('conflicts');

function showMsg(text, type) {
  document.getElementById('conflicts-msg').innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

function conflictStatusLabel(status) {
  const labels = { open: 'Abierto', resolved_auto: 'Resuelto (auto)', resolved_manual: 'Resuelto (manual)' };
  return labels[status] || status;
}

async function loadConflicts() {
  const status = document.getElementById('status-filter').value;
  try {
    const data = await apiFetch(`/admin/conflicts${status ? `?status=${status}` : ''}`);
    renderConflicts(data.conflicts);
  } catch (err) {
    showMsg(err.message, 'error');
  }
}

function renderConflicts(conflicts) {
  const list = document.getElementById('conflict-list');
  if (!conflicts.length) {
    list.innerHTML = '<p style="color:#888;font-size:14px;">Sin conflictos para este filtro.</p>';
    return;
  }

  list.innerHTML = conflicts.map((c) => `
    <div class="conflict-row" data-id="${c.id}">
      <div>
        <span class="badge ${c.status}">${conflictStatusLabel(c.status)}</span>
        <strong style="margin-left:8px;">${c.channel_a}</strong>
        vs
        <strong>${c.channel_b || '(intento rechazado)'}</strong>
      </div>
      <div class="conflict-meta">
        Reserva A: ${c.reservation_id_a} · Reserva B: ${c.reservation_id_b || '—'}<br>
        Detectado: ${fmtDate(c.detected_at)} ${c.resolution_notes ? `· ${c.resolution_notes}` : ''}
      </div>
      ${c.status === 'open' ? `
        <div class="conflict-actions">
          <select class="action-select">
            <option value="keep_direct">Mantener directo</option>
            <option value="keep_ota">Mantener OTA</option>
            <option value="keep_oldest">Mantener la más antigua</option>
          </select>
          <input type="text" class="reason-input" placeholder="Motivo de la resolución" value="Resuelto manualmente desde el panel admin">
          <button data-action="resolve">Resolver</button>
        </div>
      ` : ''}
    </div>
  `).join('');

  list.querySelectorAll('button[data-action="resolve"]').forEach((btn) => {
    btn.addEventListener('click', () => resolveConflict(btn.closest('.conflict-row')));
  });
}

async function resolveConflict(row) {
  const id = row.dataset.id;
  const action = row.querySelector('.action-select').value;
  const reason = row.querySelector('.reason-input').value.trim();
  if (!reason) {
    showMsg('El motivo es obligatorio.', 'error');
    return;
  }

  try {
    await apiFetch(`/admin/conflicts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, reason })
    });
    showMsg('Conflicto resuelto.', 'success');
    loadConflicts();
  } catch (err) {
    showMsg(err.message, 'error');
  }
}

document.getElementById('status-filter').addEventListener('change', loadConflicts);
document.getElementById('refresh-btn').addEventListener('click', loadConflicts);

loadConflicts();
