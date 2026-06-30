/**
 * On-device semantic vectorization using tiny transformers.
 * Phase 0: Uses a simple character n-gram / TF-IDF fallback
 * until ONNX runtime is available. The architecture supports
 * swapping in all-MiniLM-L6-v2 via ONNX later.
 */

// --- Simple embedding (Phase 0) ---
// Character trigram frequency vector as a lightweight semantic proxy.
// For Phase 0, this avoids any external dependencies while still
// giving meaningful similarity for short snippets.

const NGRAM_SIZE = 3;
const VOCAB_SIZE = 26 * 26 * 26; // lowercase char trigrams

function buildVocab(text) {
  const lower = text.toLowerCase();
  const chars = lower.match(/[a-z]/g) || [];
  const ngrams = new Set();
  for (let i = 0; i <= chars.length - NGRAM_SIZE; i++) {
    ngrams.add(chars.slice(i, i + NGRAM_SIZE).join(''));
  }
  return ngrams;
}

function textToVector(text) {
  const ngrams = buildVocab(text);
  const vec = new Float32Array(VOCAB_SIZE);
  let idx = 0;
  for (const ng of ngrams) {
    const i = trigramIndex(ng);
    vec[i] = 1.0 / Math.sqrt(ngrams.size); // normalize by count
    idx++;
  }
  return vec;
}

function trigramIndex(s) {
  if (s.length !== 3) return -1;
  return (
    ((s.charCodeAt(0) - 97) * 26 * 26) +
    ((s.charCodeAt(1) - 97) * 26) +
    (s.charCodeAt(2) - 97)
  );
}

// Cosine similarity between two vectors
export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// --- ONNX path (future, when we add the model) ---
let session = null;

export async function loadMiniLM(onnxPath) {
  // Placeholder: will use @xenova/transformers or onnxruntime-web
  // to load all-MiniLM-L6-v2 at runtime.
  console.warn('[Coherence] ONNX path not yet implemented — using trigram fallback');
  return null;
}

export async function embedWithModel(text, session_) {
  if (session_) {
    // When ONNX is wired up: return Float32Array from model inference
    throw new Error('ONNX embedding not yet implemented');
  }
  return textToVector(text);
}

// --- Vector search / similarity scan ---
export function findSimilarQueries(targetVec, allVectors, threshold = 0.85) {
  const results = [];
  for (const entry of allVectors) {
    if (entry.nodeId === targetVec.nodeId) continue;
    const sim = cosineSimilarity(targetVec.vector, new Float32Array(entry.vector));
    if (sim >= threshold) {
      results.push({ nodeId: entry.nodeId, similarity: sim });
    }
  }
  return results.sort((a, b) => b.similarity - a.similarity);
}

// --- Stance detection (Phase 0 heuristic) ---
const CONTRASTIVE_PAIRS = [
  ['safe', 'dangerous'],
  ['true', 'false'],
  ['good', 'bad'],
  ['for', 'against'],
  ['proven', 'debunked'],
  ['real', 'fake'],
  ['won', 'lost'],
  ['grew', 'shrank'],
  ['increased', 'decreased'],
  ['positive', 'negative'],
  ['confirmed', 'disproved'],
];

export function detectStanceDifference(textA, textB) {
  const lowerA = textA.toLowerCase();
  const lowerB = textB.toLowerCase();
  const flags = [];

  for (const [pos, neg] of CONTRASTIVE_PAIRS) {
    const aHasPos = lowerA.includes(pos);
    const bHasNeg = lowerB.includes(neg);
    const aHasNeg = lowerA.includes(neg);
    const bHasPos = lowerB.includes(pos);

    if ((aHasPos && bHasNeg) || (aHasNeg && bHasPos)) {
      flags.push(`contrasting_stance: "${pos}" vs "${neg}"`);
    }
  }

  // Numeric value mismatch detection
  const numsA = extractNumbers(textA);
  const numsB = extractNumbers(textB);
  if (numsA.length > 0 && numsB.length > 0) {
    for (const na of numsA) {
      for (const nb of numsB) {
        const diff = Math.abs(na - nb);
        const pctDiff = diff / Math.max(na, nb);
        if (pctDiff > 0.15 && diff > 2) {
          flags.push(`numeric_conflict: ${na} vs ${nb} (${Math.round(pctDiff * 100)}% difference)`);
        }
      }
    }
  }

  // Entity/date mismatch within similar text
  const datesA = extractDates(textA);
  const datesB = extractDates(textB);
  if (datesA.length > 0 && datesB.length > 0) {
    for (const da of datesA) {
      for (const db of datesB) {
        if (da !== db) {
          flags.push(`date_conflict: "${da}" vs "${db}"`);
        }
      }
    }
  }

  return flags;
}

function extractNumbers(text) {
  const matches = text.match(/\b\d[\d,]*(?:\.\d+)?/g) || [];
  return matches.map(m => parseFloat(m.replace(/,/g, ''))).filter(n => !isNaN(n));
}

function extractDates(text) {
  return (text.match(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g) || [])
    .concat(text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi) || []);
}
