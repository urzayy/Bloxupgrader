import type { Skin } from '../data/skins';
import type { Session } from './auth';
import { getDisplayName } from './auth';
import { formatUSD } from './wheelMath';
import { getAdminLastReadMap } from './adminChatRead';
import { calcRobuxDepositCredit } from './robuxDeposit';
import { clearSessionToken, sessionAuthHeaders, withSessionToken } from './sessionToken';

export type SupportTicketType = 'withdraw' | 'deposit' | 'help';
export type WithdrawTicketStatus = 'open' | 'completed' | 'cancelled';

export interface WithdrawSkinSummary {
  id: string;
  name: string;
  price: number;
  weapon: string;
  image: string;
  wear: string;
}

export interface WithdrawTicket {
  id: string;
  userId: string;
  userEmail: string;
  userLabel: string;
  type?: SupportTicketType;
  skins: WithdrawSkinSummary[];
  total: number;
  creditTotal?: number;
  bonusCode?: string;
  bonusPercent?: number;
  robuxAmount?: number;
  status: WithdrawTicketStatus;
  createdAt: number;
  updatedAt: number;
}

export function getTicketType(ticket: WithdrawTicket): SupportTicketType {
  return ticket.type ?? 'withdraw';
}

export function isRobuxDeposit(ticket: WithdrawTicket): boolean {
  return getTicketType(ticket) === 'deposit' && (ticket.robuxAmount ?? 0) > 0;
}

/** Exact SALDO credit for a completed deposit ticket. */
export function getDepositCreditAmount(ticket: WithdrawTicket): number {
  if (ticket.creditTotal != null && ticket.creditTotal > 0) return ticket.creditTotal;
  if (isRobuxDeposit(ticket)) {
    return calcRobuxDepositCredit(ticket.robuxAmount!, ticket.bonusPercent ?? 0);
  }
  const fromSkins = ticket.skins.reduce((sum, s) => sum + s.price, 0);
  return fromSkins > 0 ? fromSkins : ticket.total;
}

export function getPendingWithdrawSkinIds(tickets: WithdrawTicket[]): string[] {
  const ids: string[] = [];
  for (const ticket of tickets) {
    if (getTicketType(ticket) !== 'withdraw') continue;
    if (ticket.status !== 'open') continue;
    for (const skin of ticket.skins) {
      ids.push(skin.id);
    }
  }
  return ids;
}

export type ChatSenderRole = 'user' | 'admin' | 'system';

export interface ChatMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderEmail: string;
  senderRole: ChatSenderRole;
  senderLabel: string;
  text: string;
  createdAt: number;
}

export interface WithdrawTicketBundle {
  ticket: WithdrawTicket;
  messages: ChatMessage[];
}

export interface AdminInboxItem {
  ticket: WithdrawTicket;
  bundle?: WithdrawTicketBundle;
  unreadCount: number;
  lastUserMessageAt: number;
  lastUserMessageText?: string | null;
  isUnseen?: boolean;
}

export class WithdrawTicketNotFoundError extends Error {
  readonly ticketId: string;

  constructor(ticketId: string) {
    super(`Ticket not found: ${ticketId}`);
    this.name = 'WithdrawTicketNotFoundError';
    this.ticketId = ticketId;
  }
}

export function isWithdrawTicketNotFoundError(error: unknown): error is WithdrawTicketNotFoundError {
  return error instanceof WithdrawTicketNotFoundError;
}

function summarizeSkin(skin: Skin): WithdrawSkinSummary {
  return {
    id: skin.id,
    name: skin.name,
    price: skin.price,
    weapon: skin.weapon,
    image: skin.image,
    wear: skin.wear,
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: sessionAuthHeaders({
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      clearSessionToken();
      throw new Error('Sign in again to continue.');
    }
    if (res.status === 429) {
      throw new Error('Too many requests. Wait a moment and try again.');
    }
    if (res.status === 404) {
      const ticketMatch = path.match(/\/api\/withdraw\/tickets\/([^/?]+)/);
      throw new WithdrawTicketNotFoundError(ticketMatch?.[1] ?? 'unknown');
    }
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      if (parsed.message) throw new Error(parsed.message);
      if (parsed.error === 'invalid deposit') {
        throw new Error('Deposit does not meet the minimum. Add more skins and try again.');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== text) throw error;
    }
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function createWithdrawTicket(
  session: Session,
  skins: Skin[],
  userLabel: string,
): Promise<WithdrawTicketBundle> {
  return api<WithdrawTicketBundle>('/api/withdraw/tickets', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      type: 'withdraw',
      userId: session.userId,
      userEmail: session.email,
      userLabel,
      skins: skins.map(summarizeSkin),
    })),
  });
}

export async function createDepositTicket(
  session: Session,
  userLabel: string,
  items: { skin: Skin; quantity: number }[],
  bonus?: { code: string; percent: number },
): Promise<WithdrawTicketBundle> {
  const skins = items.map(item => ({
    ...summarizeSkin(item.skin),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
  }));
  const total = items.reduce((sum, item) => sum + item.skin.price * item.quantity, 0);

  return api<WithdrawTicketBundle>('/api/withdraw/tickets', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      type: 'deposit',
      userId: session.userId,
      userEmail: session.email,
      userLabel,
      skins,
      total,
      bonusCode: bonus?.code,
      bonusPercent: bonus?.percent,
    })),
  });
}

export async function createRobuxDepositTicket(
  session: Session,
  userLabel: string,
  robuxAmount: number,
  bonus?: { code: string; percent: number },
): Promise<WithdrawTicketBundle> {
  return api<WithdrawTicketBundle>('/api/withdraw/tickets', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      type: 'deposit',
      depositMethod: 'robux',
      userId: session.userId,
      userEmail: session.email,
      userLabel,
      robuxAmount,
      skins: [],
      total: 0,
      bonusCode: bonus?.code,
      bonusPercent: bonus?.percent,
    })),
  });
}

export async function fetchWithdrawTicket(ticketId: string): Promise<WithdrawTicketBundle> {
  return api<WithdrawTicketBundle>(`/api/withdraw/tickets/${encodeURIComponent(ticketId)}`);
}

export async function fetchUserWithdrawTickets(userId: string): Promise<WithdrawTicket[]> {
  const data = await api<{ tickets: WithdrawTicket[] }>(
    `/api/withdraw/tickets?userId=${encodeURIComponent(userId)}`,
  );
  return data.tickets;
}

export async function fetchAdminWithdrawTickets(openOnly = true): Promise<WithdrawTicket[]> {
  const data = await api<{ tickets: WithdrawTicket[] }>(
    `/api/withdraw/tickets?admin=1${openOnly ? '' : '&all=1'}`,
  );
  return data.tickets;
}

export async function fetchAdminInbox(
  lastReadByTicket: Record<string, number> = {},
): Promise<AdminInboxItem[]> {
  const data = await api<{ items: AdminInboxItem[] }>('/api/withdraw/admin-inbox', {
    method: 'POST',
    body: JSON.stringify({ lastReadByTicket }),
  });
  return data.items;
}

export async function loadAdminInbox(): Promise<AdminInboxItem[]> {
  return fetchAdminInbox(getAdminLastReadMap());
}

export function getTicketAttentionCount(item: AdminInboxItem): number {
  return item.unreadCount;
}

export function getAdminInboxAttentionCount(items: AdminInboxItem[]): number {
  return items.reduce((sum, item) => sum + getTicketAttentionCount(item), 0);
}

export async function sendWithdrawChatMessage(
  ticketId: string,
  session: Session,
  isAdmin: boolean,
  text: string,
): Promise<WithdrawTicketBundle> {
  return api<WithdrawTicketBundle>(`/api/withdraw/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      senderId: session.userId,
      senderEmail: session.email,
      senderRole: isAdmin ? 'admin' : 'user',
      senderLabel: isAdmin ? 'Admin' : getDisplayName(session),
      text: text.trim(),
    })),
  });
}

export async function updateWithdrawTicketStatus(
  ticketId: string,
  status: WithdrawTicketStatus,
): Promise<WithdrawTicketBundle> {
  return api<WithdrawTicketBundle>(`/api/withdraw/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify(withSessionToken({ status })),
  });
}

export async function createHelpTicket(
  session: Session,
  userLabel: string,
): Promise<WithdrawTicketBundle> {
  return api<WithdrawTicketBundle>('/api/withdraw/tickets', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      type: 'help',
      userId: session.userId,
      userEmail: session.email,
      userLabel,
      skins: [],
      total: 0,
    })),
  });
}

export async function openOrCreateHelpTicket(
  session: Session,
  userLabel: string,
): Promise<WithdrawTicketBundle> {
  const tickets = await fetchUserWithdrawTickets(session.userId);
  const existing = tickets.find(ticket => getTicketType(ticket) === 'help' && ticket.status === 'open');
  if (existing) {
    try {
      return await fetchWithdrawTicket(existing.id);
    } catch (error) {
      if (!isWithdrawTicketNotFoundError(error)) throw error;
    }
  }
  return createHelpTicket(session, userLabel);
}

export function formatWithdrawSummary(ticket: WithdrawTicket): string {
  if (getTicketType(ticket) === 'help') {
    return 'Live help chat';
  }
  if (getTicketType(ticket) === 'deposit') {
    if (isRobuxDeposit(ticket)) {
      const credit = getDepositCreditAmount(ticket);
      return `Robux deposit · ${ticket.robuxAmount!.toLocaleString('en-US')} R$ → ${formatUSD(credit)} balance`;
    }
    const count = ticket.skins.length;
    const names = ticket.skins.map(s => s.name).slice(0, 2).join(' · ');
    const suffix = count > 2 ? '…' : '';
    return count
      ? `Deposit · ${count} skins · ${formatUSD(ticket.total)} — ${names}${suffix}`
      : `Deposit · ${formatUSD(ticket.total)}`;
  }
  const names = ticket.skins.map(s => s.name).join(' · ');
  return `${ticket.skins.length} skins · ${formatUSD(ticket.total)} — ${names}`;
}

export function formatTicketTypeLabel(ticket: WithdrawTicket): string {
  const type = getTicketType(ticket);
  if (type === 'deposit') return 'Deposit';
  if (type === 'help') return 'Help';
  return 'Withdraw';
}
