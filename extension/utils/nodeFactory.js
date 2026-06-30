/**
 * Node factory: builds the canonical node object from selection data.
 */

export function createNode(selection, pageContext) {
  return {
    id: crypto.randomUUID(),
    text: selection.trim(),
    excerptBefore: pageContext?.excerptBefore || '',
    excerptAfter: pageContext?.excerptAfter || '',
    sourceUrl: pageContext?.url || window.location.href,
    pageTitle: pageContext?.title || document.title,
    author: pageContext?.author || extractAuthor(document),
    timestamp: Date.now(),
    tags: [],
    context: {
      scrollY: window.scrollY,
      wordCount: selection.split(/\s+/).filter(Boolean).length
    },
    // Populated later by the indexer
    status: 'pending' // pending -> indexed
  };
}

function extractAuthor(doc) {
  // Try common author meta tags
  const selectors = [
    '[name="author"]',
    '[property="article:author"]',
    '.author-name',
    '.byline',
    'meta[name="twitter:creator"]'
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && el.textContent?.trim()) return el.textContent.trim();
  }
  return null;
}
