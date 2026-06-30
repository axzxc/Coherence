/**
 * Cross-check engine: the "diff" core of Coherence.
 * When a new node is saved, finds similar past nodes and generates
 * coherence/contradiction scores.
 */

import { getAllNodes, saveNode, saveVector, deleteNode } from '../services/indexeddb.js';
import { textToVector, cosineSimilarity, findSimilarQueries, detectStanceDifference } from '../utils/vectorizer.js';

const DEFAULT_THRESHOLD = 0.85;

export async function crossCheck(newNode) {
  const allNodes = await getAllNodes();
  if (allNodes.length === 0) {
    return { matches: [], decoherenceScore: null };
  }

  // Get vectors for existing nodes
  const targetVec = textToVector(newNode.text);
  
  // Build a quick similarity scan against all node texts
  const candidates = [];
  for (const existing of allNodes) {
    if (existing.id === newNode.id) continue;
    const sim = cosineSimilarity(
      targetVec,
      textToVector(existing.text)
    );
    candidates.push({ node: existing, similarity: sim });
  }

  // High-similarity matches
  const matches = candidates
    .filter(c => c.similarity >= DEFAULT_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);

  // Deep comparison on top matches (up to 5)
  const analyzed = [];
  for (const { node: existing, similarity } of matches.slice(0, 5)) {
    const stanceFlags = detectStanceDifference(newNode.text, existing.text);
    
    // Decoherence score: how "far apart" the statements are on a logical spectrum.
    // Inverse of similarity — but modulated by stance differences.
    let decoherenceScore = 1 - similarity;
    if (stanceFlags.length > 0) {
      // Stance conflicts amplify the decoherence
      decoherenceScore = Math.min(1, decoherenceScore + stanceFlags.length * 0.05);
    }

    analyzed.push({
      node: existing,
      similarity,
      stanceFlags,
      decoherenceScore: Math.round(decoherenceScore * 100) / 100,
      // Show key overlapping phrases for quick review
      overlapPhrases: findOverlap(newNode.text, existing.text)
    });
  }

  return { matches: analyzed, decoherenceScore: analyzed[0]?.decoherenceScore ?? null };
}

/**
 * Finds common contiguous word sequences between two texts.
 */
function findOverlap(textA, textB) {
  const wordsA = textA.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const wordsB = textB.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  
  const common = [];
  for (let len = Math.min(wordsA.length, wordsB.length); len >= 3; len--) {
    for (let i = 0; i <= wordsA.length - len; i++) {
      const window = wordsA.slice(i, i + len).join(' ');
      if (wordsB.join(' ').includes(window) && !common.includes(window)) {
        common.push(window);
      }
    }
    if (common.length > 0) break; // Found some overlap at this length
  }
  
  return common.slice(0, 5).map(p => ({ phrase: p, length: p.split(' ').length }));
}

/**
 * Groups nodes into threads based on similarity chains.
 */
export async function buildThreads() {
  const allNodes = await getAllNodes();
  if (allNodes.length === 0) return [];

  const visited = new Set();
  const threads = [];

  for (const node of allNodes) {
    if (visited.has(node.id)) continue;

    const thread = [node];
    visited.add(node.id);

    // BFS: find connected nodes above threshold
    const queue = [node];
    while (queue.length > 0) {
      const current = queue.shift();
      const vec = textToVector(current.text);

      for (const other of allNodes) {
        if (visited.has(other.id)) continue;
        const sim = cosineSimilarity(vec, textToVector(other.text));
        if (sim >= 0.75) { // Lower threshold for thread-building
          visited.add(other.id);
          thread.push(other);
          queue.push(other);
        }
      }
    }

    if (thread.length > 1) {
      threads.push({
        id: `thread_${thread[0].id.slice(0, 8)}`,
        nodes: thread.sort((a, b) => a.timestamp - b.timestamp),
        createdAt: Date.now()
      });
    }
  }

  return threads.sort((a, b) => b.nodes.length - a.nodes.length);
}
