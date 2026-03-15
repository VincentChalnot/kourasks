// ui.js — UI rendering for Kouraks

// ── DOM References ──────────────────────────────────────────────────────────

function el(id) {
  return document.getElementById(id);
}

// ── Status Helpers ──────────────────────────────────────────────────────────

function statusIcon(status) {
  if (status === 'green') return '🟢';
  if (status === 'degraded') return '🟡';
  if (status === 'crashed') return '🔴';
  return '❓';
}

function serviceTypeLabel(type) {
  return GAME_CONFIG.serviceTypeLabels[type] || type;
}

// ── Main Render ─────────────────────────────────────────────────────────────

function renderUI() {
  renderHeader();
  renderProjects();
  renderServices();
  renderLog();
}

// ── Header ──────────────────────────────────────────────────────────────────

function renderHeader() {
  const rate = computeTotalRate();
  el('kouraks-count').textContent = formatKouraks(gameState.kouraks) + ' K';
  el('kouraks-rate').textContent = '(+' + formatKouraks(rate) + ' K/s)';

  const hwConfig = getHardwareConfig();
  el('hardware-name').textContent = hwConfig.name;
  el('hardware-mult').textContent = '×' + hwConfig.multiplier;

  const next = getNextHardware();
  const btn = el('hardware-upgrade-btn');
  if (next) {
    btn.textContent = 'Upgrader → ' + next.name + ' (' + formatKouraks(next.cost) + ' K)';
    btn.disabled = gameState.kouraks < next.cost;
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

// ── Projects Panel ──────────────────────────────────────────────────────────

function renderProjects() {
  const container = el('projects-list');
  let html = '';

  for (const leaf of GAME_CONFIG.leaves) {
    const unlocked = gameState.totalEarned >= leaf.unlockAt;
    if (!unlocked) {
      html += `<div class="project-card locked">
        <div class="project-header">
          <span class="project-name">🔒 ???</span>
          <span class="project-yield">Débloqué à ${formatKouraks(leaf.unlockAt)} K</span>
        </div>
      </div>`;
      continue;
    }

    const rate = computeLeafYield(leaf);
    const assigned = gameState.ownedServices.filter(s => s.assignedTo === leaf.id);

    // Status indicators per required service type
    let reqHtml = '';
    for (const reqType of leaf.requires) {
      const matchingService = assigned.find(s => s.serviceType === reqType);
      let icon, label;
      if (!matchingService) {
        icon = '❓';
        label = 'manque';
      } else {
        icon = statusIcon(matchingService.status);
        label = matchingService.name;
      }
      reqHtml += `<span class="req-badge" title="${serviceTypeLabel(reqType)}: ${label}">
        ${icon} ${serviceTypeLabel(reqType)}
      </span> `;
    }

    html += `<div class="project-card" data-leaf-id="${leaf.id}">
      <div class="project-header" onclick="toggleProjectDetail('${leaf.id}')">
        <span class="project-name">${leaf.name}</span>
        <span class="project-yield">${formatKouraks(rate)} K/s</span>
      </div>
      <div class="project-reqs">${reqHtml}</div>
      <div class="project-desc">${leaf.description}</div>
      <div class="project-detail" id="detail-${leaf.id}" style="display:none;">
        <div class="detail-title">Services assignés :</div>
        ${renderAssignedServices(leaf, assigned)}
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

function renderAssignedServices(leaf, assigned) {
  if (assigned.length === 0) {
    return '<div class="detail-empty">Aucun service assigné.</div>';
  }
  let html = '';
  for (const svc of assigned) {
    html += `<div class="assigned-service">
      ${statusIcon(svc.status)} ${svc.name}
      <span class="service-type-badge">${serviceTypeLabel(svc.serviceType)}</span>
    </div>`;
  }
  return html;
}

function toggleProjectDetail(leafId) {
  const detail = el('detail-' + leafId);
  if (detail) {
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
  }
}

// ── Services Panel ──────────────────────────────────────────────────────────

function renderServices() {
  const container = el('services-list');
  let html = '';

  if (gameState.ownedServices.length === 0) {
    html = '<div class="empty-message">Aucun service. Achetez-en dans la boutique.</div>';
  } else {
    for (const svc of gameState.ownedServices) {
      const assignedLeaf = svc.assignedTo ? getLeafConfig(svc.assignedTo) : null;
      const assignedName = assignedLeaf ? assignedLeaf.name : 'Non assigné';

      let actionHtml = '';
      if (svc.status === 'crashed') {
        actionHtml = `<button class="btn btn-restart" onclick="restartService(${svc.uid}); renderUI();">Redémarrer</button>`;
      } else if (svc.status === 'degraded') {
        actionHtml = `<span class="restart-timer">Redémarrage… ${svc.restartTimer}s</span>`;
      }

      // Build assignment dropdown
      const unlockedLeaves = GAME_CONFIG.leaves.filter(l => gameState.totalEarned >= l.unlockAt);
      let assignOptions = `<option value="">— Non assigné —</option>`;
      for (const leaf of unlockedLeaves) {
        const selected = svc.assignedTo === leaf.id ? 'selected' : '';
        assignOptions += `<option value="${leaf.id}" ${selected}>${leaf.name}</option>`;
      }

      html += `<div class="service-card status-${svc.status}">
        <div class="service-header">
          ${statusIcon(svc.status)}
          <span class="service-name">${svc.name}</span>
          <span class="service-type-badge">${serviceTypeLabel(svc.serviceType)}</span>
        </div>
        <div class="service-assignment">
          <label>Assigner à :
            <select onchange="assignService(${svc.uid}, this.value || null); renderUI();">
              ${assignOptions}
            </select>
          </label>
        </div>
        <div class="service-info">
          <span class="assigned-to">${assignedName}</span>
          ${actionHtml}
        </div>
      </div>`;
    }
  }

  container.innerHTML = html;
}

// ── Shop Modal ──────────────────────────────────────────────────────────────

function openShop() {
  el('shop-modal').style.display = 'flex';
  renderShop();
}

function closeShop() {
  el('shop-modal').style.display = 'none';
}

function renderShop() {
  const container = el('shop-content');
  let html = '';

  // Group services by type
  const typeGroups = {};
  for (const svc of GAME_CONFIG.services) {
    if (!typeGroups[svc.serviceType]) {
      typeGroups[svc.serviceType] = [];
    }
    typeGroups[svc.serviceType].push(svc);
  }

  for (const [type, services] of Object.entries(typeGroups)) {
    html += `<div class="shop-group">
      <h3 class="shop-group-title">${serviceTypeLabel(type)}</h3>`;

    for (const svc of services) {
      const unlocked = gameState.totalEarned >= svc.unlockAt;
      const canAfford = gameState.kouraks >= svc.buyCost;

      if (!unlocked) {
        html += `<div class="shop-item locked">
          <div class="shop-item-name">🔒 ${svc.name}</div>
          <div class="shop-item-info">Débloqué à ${formatKouraks(svc.unlockAt)} K total</div>
        </div>`;
      } else {
        html += `<div class="shop-item ${canAfford ? '' : 'too-expensive'}">
          <div class="shop-item-name">${svc.name}</div>
          <div class="shop-item-desc">${svc.description}</div>
          <div class="shop-item-info">
            <span class="shop-cost">${formatKouraks(svc.buyCost)} K</span>
            <button class="btn btn-buy" ${canAfford ? '' : 'disabled'}
              onclick="buyService('${svc.id}'); renderShop(); renderUI();">
              Acheter
            </button>
          </div>
        </div>`;
      }
    }

    html += '</div>';
  }

  container.innerHTML = html;
}

// ── Event Log ───────────────────────────────────────────────────────────────

function renderLog() {
  const container = el('log-list');
  let html = '';
  const maxDisplay = 20;
  const entries = gameState.eventLog.slice(0, maxDisplay);
  for (const entry of entries) {
    html += `<div class="log-entry">[${entry.time}] ${entry.message}</div>`;
  }
  container.innerHTML = html;
}

// ── Milestone Popup ─────────────────────────────────────────────────────────

function renderMilestonePopup(message) {
  const popup = document.createElement('div');
  popup.className = 'milestone-popup';
  popup.textContent = message;
  document.body.appendChild(popup);

  // Trigger animation
  requestAnimationFrame(() => {
    popup.classList.add('show');
  });

  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => popup.remove(), 500);
  }, 4000);
}

// ── Reset Confirmation ──────────────────────────────────────────────────────

function confirmReset() {
  if (confirm('Réinitialiser la partie ? Toute la progression sera perdue.')) {
    resetGame();
    renderUI();
  }
}
