/**
 * jsdom storage bridge.
 *
 * Node 25+ enables Web Storage by default and puts a non-functional
 * `localStorage` stub on globalThis (getItem/setItem missing unless
 * `--localstorage-file` is given). Vitest 2.x's jsdom environment skips any
 * window key that already exists on the Node globalThis (its populateGlobal
 * allowlist does not include localStorage/sessionStorage), so jsdom's real
 * Storage never reaches the test global and `localStorage` is `undefined` in
 * tests. See vitest-dev/vitest#8757.
 *
 * When the global stub is broken, bridge jsdom's real Storage back onto
 * globalThis. On Node versions where vitest copies jsdom's Storage natively,
 * this file is a no-op. Falls back to a spec-compliant in-memory Storage if
 * the jsdom window is unreachable (non-default pool, future vitest).
 */

function installInMemoryStorage(name: 'localStorage' | 'sessionStorage'): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const current = (globalThis as Record<string, unknown>)[name];
  if (current && typeof (current as Storage).getItem === 'function') continue; // native copy works — no-op

  const jsdomWindow = (globalThis as unknown as { jsdom?: { window: Window } }).jsdom?.window;
  const real = jsdomWindow ? (jsdomWindow as unknown as Record<string, unknown>)[name] : undefined;
  if (real && typeof (real as Storage).getItem === 'function') {
    Object.defineProperty(globalThis, name, { value: real, configurable: true, writable: true });
  } else {
    installInMemoryStorage(name);
  }
}
