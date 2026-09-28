//
// CRUD de administradores de apartamento.
//
// Asignación de apartamentos: modal con checkboxes múltiples (un owner puede
// tener más de un apartamento). Renombrar apartamentos también desde el modal.
// El "delete" real es un soft-deactivate (isActive=false).

requireAuth();
renderNav('owners');

const OW = '/admin/apartment-owners';
const RT = '/admin/room-types';

let allApartments = []; // {id, code, name, owner_id, ...}
let allOwners     = []; // owners con sus apartments[] ya adjuntos

const VERIF_LABELS = {
  pending:  { label: 'Pendiente',  cls: 'badge-verif-pending' },
  verified: { label: 'Verificado', cls: 'badge-verif-verified' },
  rejected: { label: 'Rechazado',  cls: 'badge-verif-rejected' },
};

const DOC_TYPE_LABELS = {
  cpf_cnpj: 'CPF / CNPJ',
  proof_ownership: 'Comprobante de propiedad',
  other: 'Otro documento',
};

// ── Mensajes ───────────────────────────────────────────────────────────────

function showMsg(elId, text, type) {
  document.getElementById(elId).innerHTML = text ? `<div class="msg ${type}">${text}</div>` : '';
}

// ── Carga de datos ─────────────────────────────────────────────────────────

async function loadApartments() {
  const data = await apiFetch(RT);
  allApartments = data.apartments; // incluye owner_id
}

async function loadOwners() {
  const owners = await apiFetch(OW);
  allOwners = owners;
  renderTable(owners);
}

// ── Tabla principal ────────────────────────────────────────────────────────

function renderTable(owners) {
  const tbody = document.getElementById('owners-body');

  if (owners.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin administradores creados todavía</td></tr>';
    return;
  }

  tbody.innerHTML = owners.map((o) => `
    <tr data-owner-id="${o.id}">
      <td>${escapeHtml(o.fullName)}</td>
      <td>
        ${escapeHtml(o.email)}
        ${o.phone ? `<br><small style="color:#888;">${escapeHtml(o.phone)}</small>` : ''}
      </td>
      <td>
        <span class="${o.isActive ? 'badge-active' : 'badge-inactive'}">
          ${o.isActive ? 'Activo' : 'Desactivado'}
        </span>
      </td>
      <td>
        <div style="margin-bottom:6px;">
          <span class="${(VERIF_LABELS[o.verificationStatus] || VERIF_LABELS.pending).cls}">
            ${(VERIF_LABELS[o.verificationStatus] || VERIF_LABELS.pending).label}
          </span>
        </div>
        <button data-action="view-docs" style="font-size:12px;padding:3px 9px;">
          📄 Ver documentos
        </button>
      </td>
      <td>
        <div style="margin-bottom:6px;">
          ${o.apartments.map((a) => `<span class="apt-chip">${escapeHtml(a.name)}</span>`).join('')
            || '<span style="color:#888;font-size:12px;">Ninguno</span>'}
        </div>
        <button data-action="manage-apts" style="font-size:12px;padding:3px 9px;">
          ✏ Gestionar
        </button>
      </td>
      <td>
        <div class="actions-cell">
          <button data-action="reset-password">Resetear contraseña</button>
          <button data-action="toggle-active" class="${o.isActive ? 'btn-danger' : ''}">
            ${o.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action="manage-apts"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ownerId = btn.closest('tr').dataset.ownerId;
      const owner = allOwners.find((o) => o.id === ownerId);
      if (owner) openAssignModal(owner);
    });
  });
  tbody.querySelectorAll('button[data-action="view-docs"]').forEach((btn) => {
    btn.addEventListener('click', () => openDocsModal(btn.closest('tr').dataset.ownerId));
  });
  tbody.querySelectorAll('button[data-action="reset-password"]').forEach((btn) => {
    btn.addEventListener('click', () => resetPassword(btn.closest('tr').dataset.ownerId));
  });
  tbody.querySelectorAll('button[data-action="toggle-active"]').forEach((btn) => {
    const ownerId = btn.closest('tr').dataset.ownerId;
    const activate = btn.textContent.trim() === 'Activar';
    btn.addEventListener('click', () => toggleActive(ownerId, activate));
  });
}

async function refresh() {
  await Promise.all([loadApartments(), loadOwners()]);
}

// ── Acciones de la tabla ──────────────────────────────────────────────────

async function resetPassword(ownerId) {
  try {
    const data = await apiFetch(`${OW}/${ownerId}/reset-password`, { method: 'POST' });
    showMsg(
      'temp-pass-msg',
      `Contraseña temporal para <strong>${escapeHtml(data.email)}</strong>: ` +
      `<strong>${escapeHtml(data.tempPassword)}</strong> — compartila por WhatsApp/email, no se vuelve a mostrar.`,
      'success',
    );
  } catch (err) {
    showMsg('page-msg', err.message, 'error');
  }
}

async function toggleActive(ownerId, activate) {
  try {
    if (activate) {
      await apiFetch(`${OW}/${ownerId}`, { method: 'PUT', body: JSON.stringify({ isActive: true }) });
    } else {
      await apiFetch(`${OW}/${ownerId}`, { method: 'DELETE' });
    }
    await loadOwners();
  } catch (err) {
    showMsg('page-msg', err.message, 'error');
  }
}

// ── Modal gestionar apartamentos ───────────────────────────────────────────

let currentOwnerId = null;
const assignModal  = document.getElementById('assign-modal');

function openAssignModal(owner) {
  currentOwnerId = owner.id;
  document.getElementById('assign-modal-title').textContent =
    `Apartamentos — ${owner.fullName}`;
  showMsg('assign-modal-msg', '', '');

  const assignedIds = new Set(owner.apartments.map((a) => a.id));

  const rows = allApartments.map((apt) => {
    const isAssigned = assignedIds.has(apt.id);
    const otherOwner =
      apt.owner_id && apt.owner_id !== owner.id
        ? allOwners.find((o) => o.id === apt.owner_id)
        : null;

    return `
      <div class="apt-check-row" data-apt-id="${apt.id}">
        <input type="checkbox" class="apt-checkbox" value="${apt.id}"
               ${isAssigned ? 'checked' : ''}>
        <div class="apt-check-body">
          <div class="apt-name-group">
            <span class="apt-name-text">${escapeHtml(apt.name)}</span>
            <button class="btn-rename" data-apt-id="${apt.id}" title="Renombrar">✏</button>
          </div>
          ${otherOwner
            ? `<div class="apt-other-note">Asignado a ${escapeHtml(otherOwner.fullName)}</div>`
            : ''}
          <div class="apt-rename-form" style="display:none">
            <input type="text" class="apt-rename-input" value="${escapeHtml(apt.name)}"
                   placeholder="Nuevo nombre">
            <button class="btn-rename-save">✓ Guardar</button>
            <button class="btn-rename-cancel">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('apt-checklist').innerHTML =
    rows || '<p style="padding:16px;color:var(--text-muted);text-align:center;">Sin apartamentos</p>';

  document.querySelectorAll('.btn-rename').forEach((btn) =>
    btn.addEventListener('click', () => startRename(btn.dataset.aptId)),
  );
  document.querySelectorAll('.btn-rename-save').forEach((btn) =>
    btn.addEventListener('click', () => saveRename(btn.closest('.apt-check-row').dataset.aptId)),
  );
  document.querySelectorAll('.btn-rename-cancel').forEach((btn) =>
    btn.addEventListener('click', () => cancelRename(btn.closest('.apt-check-row').dataset.aptId)),
  );
  // Guardar nombre con Enter
  document.querySelectorAll('.apt-rename-input').forEach((input) =>
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveRename(input.closest('.apt-check-row').dataset.aptId);
      if (e.key === 'Escape') cancelRename(input.closest('.apt-check-row').dataset.aptId);
    }),
  );

  assignModal.style.display = 'flex';
}

function startRename(aptId) {
  const row = document.querySelector(`.apt-check-row[data-apt-id="${aptId}"]`);
  row.querySelector('.apt-name-group').style.display = 'none';
  const form = row.querySelector('.apt-rename-form');
  form.style.display = 'flex';
  const input = form.querySelector('.apt-rename-input');
  input.focus();
  input.select();
}

function cancelRename(aptId) {
  const row = document.querySelector(`.apt-check-row[data-apt-id="${aptId}"]`);
  row.querySelector('.apt-name-group').style.display = '';
  row.querySelector('.apt-rename-form').style.display = 'none';
}

async function saveRename(aptId) {
  const row = document.querySelector(`.apt-check-row[data-apt-id="${aptId}"]`);
  const newName = row.querySelector('.apt-rename-input').value.trim();
  if (!newName) {
    showMsg('assign-modal-msg', 'El nombre no puede estar vacío', 'error');
    return;
  }

  const btn = row.querySelector('.btn-rename-save');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    await apiFetch(`${RT}/${aptId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName }),
    });

    // Actualizar nombre en el modal y en el array local
    row.querySelector('.apt-name-text').textContent = newName;
    row.querySelector('.apt-rename-input').value = newName;
    const apt = allApartments.find((a) => a.id === aptId);
    if (apt) apt.name = newName;

    cancelRename(aptId);
    showMsg('assign-modal-msg', `✓ Nombre actualizado a "${newName}"`, 'success');
  } catch (err) {
    showMsg('assign-modal-msg', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Guardar';
  }
}

// Guardar asignaciones
document.getElementById('assign-modal-save').addEventListener('click', async () => {
  if (!currentOwnerId) return;

  const checkboxes = document.querySelectorAll('#apt-checklist .apt-checkbox');
  const wantedIds  = new Set(
    Array.from(checkboxes).filter((cb) => cb.checked).map((cb) => cb.value),
  );

  // Estado actual según allApartments (owner_id en cada apartment)
  const currentlyAssigned = new Set(
    allApartments.filter((a) => a.owner_id === currentOwnerId).map((a) => a.id),
  );

  const toAssign   = [...wantedIds].filter((id) => !currentlyAssigned.has(id));
  const toUnassign = [...currentlyAssigned].filter((id) => !wantedIds.has(id));

  if (toAssign.length === 0 && toUnassign.length === 0) {
    assignModal.style.display = 'none';
    return;
  }

  const saveBtn = document.getElementById('assign-modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    await Promise.all([
      ...toAssign.map((id) =>
        apiFetch(`${OW}/${currentOwnerId}/assign-room/${id}`, { method: 'PUT' }),
      ),
      ...toUnassign.map((id) =>
        apiFetch(`${OW}/${currentOwnerId}/assign-room/${id}`, { method: 'DELETE' }),
      ),
    ]);
    assignModal.style.display = 'none';
    await refresh();
  } catch (err) {
    showMsg('assign-modal-msg', err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar asignaciones';
  }
});

document.getElementById('assign-modal-cancel').addEventListener('click', () => {
  assignModal.style.display = 'none';
});

// Cerrar al hacer click fuera del modal box
assignModal.addEventListener('click', (e) => {
  if (e.target === assignModal) assignModal.style.display = 'none';
});

// ── Modal documentos de verificación (KYC) ─────────────────────────────────

let currentDocsOwnerId = null;
const docsModal = document.getElementById('docs-modal');

async function openDocsModal(ownerId) {
  currentDocsOwnerId = ownerId;
  showMsg('docs-modal-msg', '', '');
  document.getElementById('docs-list').innerHTML = '<p class="empty">Cargando...</p>';
  document.getElementById('docs-reject-notes').style.display = 'none';
  document.getElementById('docs-reject-notes').value = '';
  docsModal.style.display = 'flex';

  try {
    const data = await apiFetch(`${OW}/${ownerId}/documents`);
    renderDocsModal(data);
  } catch (err) {
    showMsg('docs-modal-msg', err.message, 'error');
    document.getElementById('docs-list').innerHTML = '';
  }
}

function renderDocsModal(data) {
  const { owner, documents } = data;
  document.getElementById('docs-modal-title').textContent = `Documentos — ${owner.fullName}`;

  const verifInfo = VERIF_LABELS[owner.verificationStatus] || VERIF_LABELS.pending;
  const statusBadge = `<span class="${verifInfo.cls}">${verifInfo.label}</span>`;

  if (documents.length === 0) {
    document.getElementById('docs-list').innerHTML =
      `<p style="margin-bottom:12px;">${statusBadge}</p>` +
      '<p class="empty">Todavía no subió ningún documento</p>';
    return;
  }

  const rows = documents.map((doc) => `
    <div class="doc-row">
      <div class="doc-row-head">
        <div>
          <div class="doc-type-label">${escapeHtml(DOC_TYPE_LABELS[doc.docType] || doc.docType)}</div>
          <div class="doc-meta">
            ${escapeHtml(doc.originalName || 'documento')} · subido ${fmtDate(doc.uploadedAt)}
          </div>
        </div>
        ${doc.signedUrl
          ? `<a href="${doc.signedUrl}" target="_blank" rel="noopener noreferrer">
               <button style="font-size:12px;padding:4px 10px;">Ver</button>
             </a>`
          : ''}
      </div>
      ${doc.reviewNotes
        ? `<div class="doc-review-note">Nota de revisión: ${escapeHtml(doc.reviewNotes)}</div>`
        : ''}
    </div>
  `).join('');

  document.getElementById('docs-list').innerHTML =
    `<p style="margin-bottom:12px;">${statusBadge}</p>${rows}`;
}

document.getElementById('docs-modal-close').addEventListener('click', () => {
  docsModal.style.display = 'none';
});

docsModal.addEventListener('click', (e) => {
  if (e.target === docsModal) docsModal.style.display = 'none';
});

document.getElementById('docs-approve-btn').addEventListener('click', async () => {
  if (!currentDocsOwnerId) return;
  await submitVerification('verified');
});

document.getElementById('docs-reject-btn').addEventListener('click', async () => {
  const notesBox = document.getElementById('docs-reject-notes');
  if (notesBox.style.display === 'none') {
    // Primer click: mostrar el textarea para que cargue el motivo
    notesBox.style.display = 'block';
    notesBox.focus();
    return;
  }
  const notes = notesBox.value.trim();
  if (!notes) {
    showMsg('docs-modal-msg', 'Escribí el motivo del rechazo', 'error');
    return;
  }
  await submitVerification('rejected', notes);
});

async function submitVerification(status, notes) {
  const approveBtn = document.getElementById('docs-approve-btn');
  const rejectBtn = document.getElementById('docs-reject-btn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;

  try {
    await apiFetch(`${OW}/${currentDocsOwnerId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify(notes ? { status, notes } : { status }),
    });
    docsModal.style.display = 'none';
    await loadOwners();
  } catch (err) {
    showMsg('docs-modal-msg', err.message, 'error');
  } finally {
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
  }
}

// ── Modal: nuevo administrador ─────────────────────────────────────────────

const newOwnerModal = document.getElementById('new-owner-modal');

document.getElementById('new-owner-btn').addEventListener('click', () => {
  document.getElementById('new-owner-name').value  = '';
  document.getElementById('new-owner-email').value = '';
  document.getElementById('new-owner-phone').value = '';
  showMsg('modal-msg', '', '');
  newOwnerModal.style.display = 'flex';
});

document.getElementById('new-owner-cancel').addEventListener('click', () => {
  newOwnerModal.style.display = 'none';
});

document.getElementById('new-owner-confirm').addEventListener('click', async () => {
  const fullName = document.getElementById('new-owner-name').value.trim();
  const email    = document.getElementById('new-owner-email').value.trim();
  const phone    = document.getElementById('new-owner-phone').value.trim();

  if (!fullName || !email) {
    showMsg('modal-msg', 'Nombre y email son obligatorios', 'error');
    return;
  }

  const confirmBtn = document.getElementById('new-owner-confirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Creando...';

  try {
    const data = await apiFetch(OW, {
      method: 'POST',
      body: JSON.stringify({ fullName, email, phone: phone || undefined }),
    });
    newOwnerModal.style.display = 'none';
    showMsg(
      'temp-pass-msg',
      `Administrador creado. Contraseña temporal para <strong>${escapeHtml(data.email)}</strong>: ` +
      `<strong>${escapeHtml(data.tempPassword)}</strong> — compartila por WhatsApp/email junto con ` +
      `<strong>/owner/login</strong> en el sitio. No se vuelve a mostrar.`,
      'success',
    );
    await loadOwners();
  } catch (err) {
    showMsg('modal-msg', err.message, 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Crear';
  }
});

// ── Inicio ─────────────────────────────────────────────────────────────────

refresh();
