import { defineConfig } from 'vite';

// LAN play needs the dev server reachable from a second device: Vite 5 binds
// to localhost by default, so a guest loading http://<host-ip>:5173 gets
// nothing and ends up running a stale cached bundle (or no app at all).
// `host: true` binds every interface, matching the LAN WebSocket server, which
// already listens on all of them (server/src/index.ts). The client derives its
// socket URL from location.hostname (app/src/game/lanClient.ts connectLan), so
// both halves must be reachable at the same address for a guest to join.
//
// Tests do NOT read this file — app/vitest.config.ts takes precedence for
// `vitest run`, so the jsdom setup there is unaffected.
export default defineConfig({
  server: { host: true },
});
