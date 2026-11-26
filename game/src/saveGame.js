// Career persistence in the browser's local storage. The save is versioned JSON; a
// corrupt or older save falls back to a fresh career rather than stranding the pilot.

import { freshCareer } from './career.js';

const KEY = 'skypost-career-v1';

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshCareer();
    const parsed = JSON.parse(raw);
    const career = freshCareer();
    return { ...career, ...parsed, stats: { ...career.stats, ...(parsed.stats ?? {}) } };
  } catch {
    return freshCareer();
  }
}

export function saveCareer(career) {
  try { localStorage.setItem(KEY, JSON.stringify(career)); } catch { /* storage full/blocked */ }
}

export function wipeCareer() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to wipe */ }
}
