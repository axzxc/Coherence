/**
 * Popup logic — renders nodes, handles settings, shows comparisons.
 */

import { getAllNodes, clearAll, getStorageUsage } from '../services/indexeddb.js';
import { findSimilarQueries } from '../utils/vectorizer.js';
import { crossCheck } from '../services/crossCheck.js';

const THRESHOLD_KEY = 'coherence_threshold';
let nodes = [];
let vectors = [];

// DOM refs
const resultsEl = document.getElementById('results');
const emptyState = document.getElementById('empty-state');
const nodeCountEl = document.getElementById('node-count');
const storageUsedEl = document.getElementById('storage-used');
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdValue = document.getElementById('threshold-value');
const btnClear = document.getElementById('btn-clear');
const modal = document.getElementById('comparison-modal');
const backdrop = modal.querySelector('.modal-backdrop');

// Load saved threshold
let threshold = parseFloat(localStorage.getItem(THRESHOLD_KEY)) || 0.85;
thresholdSlider.value = Math.round(threshold * 100);
thresholdValue.textContent = `${Math.round(threshold * 100)}%`;

thresholdSlider.addEventListener('input', () => {
  const val = parseInt(thresholdSlider.value) / 100;
  localStorage.setItem(THRESHOLD_KEY, val);
  thresholdValue.textContent = `${parseInt(thresholdSlider.value)}%`;
  threshold = val;
});

// Clear all data
btnClear.addEventListener('click', async () => {
  if (!confirm('Clear all Coherence data? This cannot be undone.')) return;
  await clearAll();
  await refreshData();
  resultsEl.innerHTML = '';
  emptyState.style.display = 'block';
});

// Close modal on backdrop click
backdrop.addEventListener('click', () => {
  modal.classList.add('hidden');
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
  modal.classList.add('hidden');
});

// Format date nicely
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.slice(0, 40)}`;
  } catch { return url; }
}

// Render a result card
function renderCard(match) {
  const { node: old, similarity, decoherenceScore, stanceFlags } = match;
  
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="meta">
      <a class="source" href="${old.sourceUrl}" target="_blank">${shortenUrl(old.sourceUrl)}</a>
      <span class="date">${formatDate(old.timestamp)} ${formatTime(old.timestamp)}</span>
    </div>
    <p class="snippet">${escapeHtml(old.text.slice(0, 200))}${old.text.length > 200 ? '…' : ''}</p>
    <span class="confidence">↕ ${Math.round(similarity * 100)}% similar · decoherence: ${decoherenceScore}</span>
    ${stanceFlags.length > 0 ? `<span style="color: var(--warning); font-size: 11px; margin-left: 8px;">⚠ ${stanceFlags.length} conflict${stanceFlags.length > 1 ? 's' : ''}</span>` : ''}
  `;

  card.addEventListener('click', () => showComparison(old, match));
  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Show comparison modal
async function showComparison(oldNode, matchData) {
  const allNodes = await getAllNodes();
  
  // Find or create matching pair (the new node being compared against)
  let newNode;
  if (matchData.node?.id === oldNode.id) {
    // This is the crossCheck result — we need to find what triggered it
    // For popup display, show the match directly
    newNode = matchData.node;
  } else {
    newNode = allNodes[allNodes.length - 1] || oldNode;
  }

  document.getElementById('modal-title').textContent = matchData.decoherenceScore > 0.3
    ? 'Contradiction Detected'
    : 'Related Snippets';

  // Old pane
  document.getElementById('old-date').textContent = `${formatDate(oldNode.timestamp)} ${formatTime(oldNode.timestamp)}`;
  document.getElementById('old-text').textContent = oldNode.text;
  document.getElementById('old-url').href = oldNode.sourceUrl;
  document.getElementById('old-url').textContent = shortenUrl(oldNode.sourceUrl);

  // New pane
  document.getElementById('new-date').textContent = `${formatDate(newNode.timestamp)} ${formatTime(newNode.timestamp)}`;
  document.getElementById('new-text').textContent = newNode.text;
  document.getElementById('new-url').href = newNode.sourceUrl;
  document.getElementById('new-url').textContent = shortenUrl(newNode.sourceUrl);

  // Decoherence score styling
  const decohereEl = document.getElementById('decoherence-score');
  const score = matchData.decoherenceScore ?? 0;
  decohereEl.textContent = `${score}`;
  if (score > 0.5) {
    decohereEl.style.color = 'var(--danger)';
    decohereEl.style.background = 'rgba(231, 76, 60, 0.15)';
  } else if (score > 0.2) {
    decohereEl.style.color = 'var(--warning)';
    decohereEl.style.background = 'rgba(230, 126, 34, 0.15)';
  } else {
    decohereEl.style.color = 'var(--success)';
    decohereEl.style.background = 'rgba(39, 174, 96, 0.15)';
  }

  // Conflicts list
  const conflictsList = document.getElementById('conflicts-list');
  conflictsList.innerHTML = '';
  if (matchData.stanceFlags?.length > 0) {
    for (const flag of matchData.stanceFlags) {
      const li = document.createElement('li');
      li.textContent = flag;
      conflictsList.appendChild(li);
    }
    document.getElementById('conflicts-section').style.display = 'block';
  } else {
    document.getElementById('conflicts-section').style.display = 'none';
  }

  // Overlap list
  const overlapList = document.getElementById('overlap-list');
  overlapList.innerHTML = '';
  if (matchData.overlapPhrases?.length > 0) {
    for (const p of matchData.overlapPhrases) {
      const span = document.createElement('span');
      span.className = 'overlap-tag';
      span.textContent = `"${p.phrase}"`;
      overlapList.appendChild(span);
    }
    document.getElementById('overlap-section').style.display = 'block';
  } else {
    document.getElementById('overlap-section').style.display = 'none';
  }

  modal.classList.remove('hidden');
}

// Refresh all data and render
async function refreshData() {
  [nodes, vectors] = await Promise.all([
    getAllNodes(),
    (async () => {
      try { return chrome.storage.local.get(['vectors']); } catch { return []; }
    })()
  ]);

  nodeCountEl.textContent = `${nodes.length} nodes`;
  
  const bytes = await getStorageUsage();
  const kb = (bytes / 1024).toFixed(1);
  storageUsedEl.textContent = kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;

  if (nodes.length === 0) {
    resultsEl.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Show most recent snippets
  const displayNodes = nodes.slice(-20).reverse();
  
  // For each, run quick cross-check
  resultsEl.innerHTML = '';
  for (const node of displayNodes) {
    const vec = new Float32Array(
      Array.from(Uint8Array.from(node.text.split('').map(c => c.charCodeAt(0))))
    );
    
    // Just show the latest node's matches as a preview
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="meta">
        <a class="source" href="${node.sourceUrl}" target="_blank">${shortenUrl(node.sourceUrl)}</a>
        <span class="date">${formatDate(node.timestamp)}</span>
      </div>
      <p class="snippet">${escapeHtml(node.text.slice(0, 150))}${node.text.length > 150 ? '…' : ''}</p>
    `;
    resultsEl.appendChild(card);
  }
}

// Initialize
refreshData();
