/** Browser-side memory of chat ticket ids so Live Chats survives tab close / userId rematch. */

const STORAGE_KEY = 'blox-upgrader/live-chat-tickets';
const MAX_PER_EMAIL = 40;

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function loadMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const [email, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(ids)) continue;
      out[normalizeEmail(email)] = ids.map(String).filter(Boolean).slice(0, MAX_PER_EMAIL);
    }
    return out;
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage blocked */
  }
}

export function rememberLiveChatTicket(email: string, ticketId: string): void {
  const key = normalizeEmail(email);
  const id = String(ticketId || '').trim();
  if (!key || !id) return;
  const map = loadMap();
  const next = [id, ...(map[key] ?? []).filter(existing => existing !== id)].slice(0, MAX_PER_EMAIL);
  map[key] = next;
  saveMap(map);
}

export function rememberedLiveChatTicketIds(email: string): string[] {
  return loadMap()[normalizeEmail(email)] ?? [];
}
