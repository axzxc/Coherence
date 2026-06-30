/**
 * Options page logic.
 */

import { getAllNodes, clearAll, getStorageUsage } from '../services/indexeddb.js';

const thresholdSlider = document.getElementById('threshold');
const thresholdVal = document.getElementById('threshold-val');
const showOverlayCheckbox = document.getElementById('show-overlay');
const minLengthInput = document.getElementById('min-length');
const vectorModeSelect = document.getElementById('vector-mode');
const totalNodesEl = document.getElementById('total-nodes');
const storageUsageEl = document.getElementById('storage-usage');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const btnClear = document.getElementById('btn-clear');
const importFile = document.getElementById('import-file');

// Threshold slider
thresholdSlider.addEventListener('input', () => {
  thresholdVal.textContent = `${thresholdSlider.value}%`;
});

// Load saved settings
chrome.storage.sync.get([
  'threshold', 'showOverlay', 'minLength', 'vectorMode'
], (items) => {
  if (items.threshold !== undefined) {
    thresholdSlider.value = items.threshold;
    thresholdVal.textContent = `${items.threshold}%`;
  }
  if (items.showOverlay !== undefined) {
    showOverlayCheckbox.checked = items.showOverlay;
  }
  if (items.minLength !== undefined) {
    minLengthInput.value = items.minLength;
  }
  if (items.vectorMode !== undefined) {
    vectorModeSelect.value = items.vectorMode;
  }
});

// Save settings on change
function saveSettings() {
  chrome.storage.sync.set({
    threshold: parseInt(thresholdSlider.value),
    showOverlay: showOverlayCheckbox.checked,
    minLength: parseInt(minLengthInput.value),
    vectorMode: vectorModeSelect.value
  });
}

thresholdSlider.addEventListener('change', saveSettings);
showOverlayCheckbox.addEventListener('change', saveSettings);
minLengthInput.addEventListener('change', saveSettings);
vectorModeSelect.addEventListener('change', saveSettings);

// Load node count and storage
async function updateStats() {
  const nodes = await getAllNodes();
  totalNodesEl.textContent = nodes.length;
  const bytes = await getStorageUsage();
  const kb = (bytes / 1024).toFixed(1);
  storageUsageEl.textContent = kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

updateStats();

// Export all data as JSON
btnExport.addEventListener('click', async () => {
  const nodes = await getAllNodes();
  const data = JSON.stringify({
    version: 'coherence-0.1',
    exportedAt: new Date().toISOString(),
    nodes
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coherence-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Import data from JSON file
btnImport.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert('Invalid Coherence export file.');
    return;
  }

  if (!parsed?.nodes || !Array.isArray(parsed.nodes)) {
    alert('No valid nodes found in this file.');
    return;
  }

  const count = confirm(`Import ${parsed.nodes.length} nodes? This will add to your existing data.`);
  if (!count) return;

  // Save each node
  for (const node of parsed.nodes) {
    // Add a unique suffix to avoid key collisions
    node.id = `${node.id}_${Date.now()}`;
    const { saveNode } = await import('../services/indexeddb.js');
    await saveNode(node);
  }

  updateStats();
});

// Clear all data
btnClear.addEventListener('click', async () => {
  if (!confirm('Delete ALL Coherence data? This cannot be undone.')) return;
  await clearAll();
  updateStats();
});
