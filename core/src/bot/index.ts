import { Grandmaster, Recruit, Veteran } from './policies.js';
import type { BotPolicy } from './policies.js';

export type { BotPolicy } from './policies.js';
export { Grandmaster, Recruit, Veteran, mulliganPolicy } from './policies.js';

/** Bot difficulty levels exposed by createBot (Phase 3 bot integration). */
export type BotLevel = 'recruit' | 'veteran' | 'grandmaster';

/** Level → policy mapping: Recruit (random legal), Veteran (greedy heuristic),
 *  Grandmaster (bounded depth-2 search). */
export function createBot(level: BotLevel): BotPolicy {
  switch (level) {
    case 'recruit':
      return Recruit;
    case 'veteran':
      return Veteran;
    case 'grandmaster':
      return Grandmaster;
  }
}
