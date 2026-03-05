// Utility helpers for producing stable JSON + hashes.
// We use this for comparing localStorage state vs the exported/remote JSON file.
//
// Note: This is NOT for security. It's only used to detect changes reliably.
export function stableStringify(value) {
  const seen = new WeakSet();

  function sorter(key, val) {
    if (val && typeof val === 'object') {
      if (seen.has(val)) {
        // Drop circular references (should never happen in our persisted state)
        return undefined;
      }
      seen.add(val);

      if (Array.isArray(val)) {
        return val.map((item) => sorter('', item));
      }

      // Sort object keys for stable output.
      return Object.keys(val)
        .sort()
        .reduce((acc, k) => {
          acc[k] = sorter(k, val[k]);
          return acc;
        }, {});
    }
    return val;
  }

  return JSON.stringify(sorter('', value));
}

// Tiny, fast, non-crypto hash (FNV-1a 32-bit) to track changes.
export function fnv1aHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    // 32-bit multiply by FNV prime
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function hashObject(value) {
  return fnv1aHash(stableStringify(value));
}
