/**
 * Background service worker — handles context menus, node indexing,
 and notifications.
 */

import { saveNode as saveNodeToDB, saveVector } from './services/indexeddb.js';
import { textToVector } from './utils/vectorizer.js';
import { createNode } from './utils/nodeFactory.js';
import { crossCheck } from './services/crossCheck.js';

// Register "Save to Coherence" context menu
chrome.contextMenus.create({
  id: 'save-to-coherence',
  title: chrome.i18n.getMessage('saveNode'),
  contexts: ['selection']
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-coherence') return;
  if (!info.selectionText) return;

  const node = createNode(info.selectionText, {
    url: tab?.url || '',
    title: tab?.title || document?.title || '',
    author: null,
    excerptBefore: info.selectionContext || '',
    excerptAfter: ''
  });

  // Save to DB
  await saveNodeToDB(node);

  // Generate and store vector
  const vec = textToVector(node.text);
  await saveVector(node.id, Array.from(vec));

  // Cross-check against existing nodes
  const result = await crossCheck(node);

  if (result.matches.length > 0) {
    // Show badge/nudge on the extension icon
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#e67e22' });
    
    // Pop up the comparison popup
    chrome.action.openPopup();
  }
});

// Clear badge when user opens popup
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

console.log('[Coherence] Service worker loaded');
