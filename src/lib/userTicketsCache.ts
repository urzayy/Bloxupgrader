import type { WithdrawTicket } from './withdrawChat';

const cache = new Map<string, { at: number; tickets: WithdrawTicket[] }>();
const TTL_MS = 30_000;

function key(userId: string): string {
  return String(userId || '').trim();
}

export function peekUserTicketsCache(userId: string): WithdrawTicket[] | null {
  const entry = cache.get(key(userId));
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) return entry.tickets; // stale still useful for instant paint
  return entry.tickets;
}

export function setUserTicketsCache(userId: string, tickets: WithdrawTicket[]): void {
  const id = key(userId);
  if (!id) return;
  cache.set(id, { at: Date.now(), tickets: [...tickets] });
}
