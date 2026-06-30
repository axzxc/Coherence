/**
 * Content script — injects the floating overlay button into pages.
 * Gives users a quick "save highlighted text" via a floating button.
 */

let overlay = null;

function createOverlay() {
  if (overlay) return overlay;

  // Shadow DOM to avoid style conflicts with the page
  const shadow = document.createElement('div');
  shadow.style.all = 'all';
  document.body.appendChild(shadow);
  
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      #coherence-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6c5ce7, #a29bfe);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(108, 92, 231, 0.4);
        z-index: 2147483647;
        transition: all 0.2s ease;
        opacity: 0;
        transform: scale(0.5) translateY(20px);
      }
      #coherence-fab:hover {
        transform: scale(1.1) translateY(0) !important;
        box-shadow: 0 6px 30px rgba(108, 92, 231, 0.6);
      }
      #coherence-fab.visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      #coherence-fab .icon {
        font-size: 24px;
        color: white;
        pointer-events: none;
      }
      #coherence-tooltip {
        position: absolute;
        bottom: calc(100% + 8px);
        right: 0;
        background: var(--bg, #1a1d27);
        color: var(--text, #e2e4ea);
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      }
      #coherence-fab:hover #coherence-tooltip {
        opacity: 1;
      }
    </style>
    <button id="coherence-fab" aria-label="Save to Coherence">
      <span class="icon">◈</span>
      <span id="coherence-tooltip">Save highlighted text</span>
    </button>
  `;

  overlay = shadow.querySelector('#coherence-fab');
  
  // Show/hide based on selection
  document.addEventListener('mouseup', handleSelection);
  overlay.addEventListener('click', saveSelection);

  return overlay;
}

function handleSelection(e) {
  const sel = window.getSelection();
  const fab = createOverlay()?.querySelector('#coherence-fab');
  
  if (sel.toString().trim().length > 0) {
    fab?.classList.add('visible');
  } else {
    fab?.classList.remove('visible');
  }
}

async function saveSelection(e) {
  e.preventDefault();
  const sel = window.getSelection();
  const text = sel.toString().trim();
  
  if (text.length < 3) return; // Minimum snippet length

  // Build context from surrounding paragraph
  let excerptBefore = '';
  let excerptAfter = '';
  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const parent = container.nodeType === 1 ? container : container.parentElement;
  
  if (parent) {
    const paragraph = parent.closest('p, blockquote, div, article') || parent.parentElement;
    if (paragraph?.textContent) {
      const fullText = paragraph.textContent.trim();
      const startIdx = Math.max(0, range.startOffset - 200);
      excerptBefore = fullText.slice(Math.max(0, startIdx), range.startOffset).slice(-100);
      excerptAfter = fullText.slice(range.endOffset, Math.min(fullText.length, range.endOffset + 200)).slice(0, 100);
    }
  }

  // Send to background via port or chrome.runtime
  chrome.runtime.sendMessage({
    action: 'saveNode',
    selection: text,
    context: {
      url: window.location.href,
      title: document.title,
      excerptBefore,
      excerptAfter,
      author: extractAuthor()
    }
  }, (response) => {
    if (response?.ok) {
      // Brief visual feedback
      const fab = createOverlay();
      if (fab) {
        fab.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
        setTimeout(() => {
          fab.style.background = '';
        }, 1000);
      }
    } else if (response?.matches > 0) {
      // Contradiction found — badge already set by background
      console.log('[Coherence] Found', response.matches, 'contradiction(s)');
    }
  });

  // Clear selection
  sel.removeAllRanges();
}

function extractAuthor() {
  const selectors = [
    '[name="author"]',
    '[property="article:author"]',
    '.author-name',
    '.byline'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return null;
}

// Inject overlay after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createOverlay);
} else {
  createOverlay();
}

console.log('[Coherence] Content script injected');
