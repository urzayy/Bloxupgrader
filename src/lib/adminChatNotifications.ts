import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminInbox,
  getAdminInboxAttentionCount,
  getTicketType,
  type AdminInboxItem,
  type SupportTicketType,
} from './withdrawChat';
import { getAdminLastReadMap } from './adminChatRead';
import { sfx, unlockAdminAlertAudio } from './audio';

export type AdminChatToastKind = 'new_chat' | 'new_message';

export interface AdminChatToast {
  id: string;
  ticketId: string;
  kind: AdminChatToastKind;
  ticketType: SupportTicketType;
  userLabel: string;
  userEmail: string;
  preview: string;
  createdAt: number;
}

interface TicketSnapshot {
  updatedAt: number;
  lastUserMessageAt: number;
}

interface Options {
  enabled: boolean;
  activeTicketId: string | null;
  pollMs?: number;
}

function buildNewChatPreview(item: AdminInboxItem): string {
  const skinCount = item.ticket.skins.length;
  const type = getTicketType(item.ticket);
  if (type === 'help') return 'New help chat';
  if (type === 'deposit') {
    return skinCount > 0
      ? `New deposit chat · ${skinCount} skins`
      : 'New deposit chat';
  }
  return skinCount > 0
    ? `New withdrawal chat · ${skinCount} skins`
    : 'New withdrawal chat';
}

/** Fast enough that admins hear new chats within a few seconds. */
const DEFAULT_POLL_MS = 4_000;
type Listener = (state: { attentionCount: number; toasts: AdminChatToast[] }) => void;

const shared = {
  listeners: new Set<Listener>(),
  attentionCount: 0,
  toasts: [] as AdminChatToast[],
  snapshot: new Map<string, TicketSnapshot>(),
  initialized: false,
  timer: 0 as number,
  inFlight: false,
  activeTicketId: null as string | null,
  enabledCount: 0,
  originalTitle: typeof document !== 'undefined' ? document.title : 'BloxUpgrader',
};

function alertAdminsNewChat(count: number) {
  if (count <= 0) return;
  try {
    unlockAdminAlertAudio();
    sfx.adminChatBell();
  } catch { /* noop */ }

  try {
    if (typeof document !== 'undefined' && document.hidden) {
      document.title = `(${count}) New chat — BloxUpgrader`;
      window.setTimeout(() => {
        if (document.title.startsWith('(')) document.title = shared.originalTitle;
      }, 12_000);
    }
  } catch { /* noop */ }

  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification('New live chat', {
        body: 'Someone opened a deposit / withdraw / help chat.',
        tag: 'blox-admin-new-chat',
        silent: false,
      });
      window.setTimeout(() => n.close(), 8_000);
    }
  } catch { /* noop */ }
}

function emit() {
  const state = { attentionCount: shared.attentionCount, toasts: shared.toasts };
  for (const listener of shared.listeners) listener(state);
}

async function sharedPoll() {
  if (shared.inFlight || shared.enabledCount <= 0) return;
  shared.inFlight = true;
  try {
    const items = await fetchAdminInbox(getAdminLastReadMap());
    shared.attentionCount = getAdminInboxAttentionCount(items);

    const nextSnapshot = new Map<string, TicketSnapshot>();
    for (const item of items) {
      nextSnapshot.set(item.ticket.id, {
        updatedAt: item.ticket.updatedAt,
        lastUserMessageAt: item.lastUserMessageAt,
      });
    }

    if (!shared.initialized) {
      shared.snapshot = nextSnapshot;
      shared.initialized = true;
      emit();
      return;
    }

    const previous = shared.snapshot;
    const nextToasts = [...shared.toasts];
    let newChatCount = 0;
    for (const item of items) {
      const ticketId = item.ticket.id;
      if (ticketId === shared.activeTicketId) continue;

      const current = nextSnapshot.get(ticketId);
      const prior = previous.get(ticketId);
      if (!current) continue;

      if (!prior) {
        newChatCount += 1;
        nextToasts.push({
          id: `toast_${Date.now()}_${ticketId}_new`,
          ticketId,
          kind: 'new_chat',
          ticketType: getTicketType(item.ticket),
          userLabel: item.ticket.userLabel,
          userEmail: item.ticket.userEmail,
          preview: buildNewChatPreview(item),
          createdAt: Date.now(),
        });
        continue;
      }

      if (item.lastUserMessageAt > prior.lastUserMessageAt) {
        nextToasts.push({
          id: `toast_${Date.now()}_${ticketId}_msg`,
          ticketId,
          kind: 'new_message',
          ticketType: getTicketType(item.ticket),
          userLabel: item.ticket.userLabel,
          userEmail: item.ticket.userEmail,
          preview: item.lastUserMessageText?.trim() || 'New message in chat',
          createdAt: Date.now(),
        });
      }
    }

    if (newChatCount > 0) alertAdminsNewChat(newChatCount);

    shared.toasts = nextToasts.slice(-4);
    shared.snapshot = nextSnapshot;
    emit();
  } catch {
    shared.attentionCount = 0;
    emit();
  } finally {
    shared.inFlight = false;
  }
}

function ensureSharedTimer(pollMs: number) {
  if (shared.timer) return;
  void sharedPoll();
  shared.timer = window.setInterval(() => { void sharedPoll(); }, pollMs);
}

function stopSharedTimerIfIdle() {
  if (shared.enabledCount > 0) return;
  if (shared.timer) {
    window.clearInterval(shared.timer);
    shared.timer = 0;
  }
  shared.initialized = false;
  shared.snapshot = new Map();
  shared.attentionCount = 0;
  shared.toasts = [];
  emit();
}

export function useAdminChatNotifications({
  enabled,
  activeTicketId,
  pollMs = DEFAULT_POLL_MS,
}: Options) {
  const [toasts, setToasts] = useState<AdminChatToast[]>(shared.toasts);
  const [attentionCount, setAttentionCount] = useState(shared.attentionCount);

  useEffect(() => {
    shared.activeTicketId = activeTicketId;
  }, [activeTicketId]);

  useEffect(() => {
    const listener: Listener = state => {
      setAttentionCount(state.attentionCount);
      setToasts(state.toasts);
    };
    shared.listeners.add(listener);
    listener({ attentionCount: shared.attentionCount, toasts: shared.toasts });

    if (enabled) {
      shared.enabledCount += 1;
      unlockAdminAlertAudio();
      ensureSharedTimer(pollMs);
      // Unlock audio after the next user gesture so the bell can play later.
      const unlock = () => unlockAdminAlertAudio();
      window.addEventListener('pointerdown', unlock, { once: true, capture: true });
      window.addEventListener('keydown', unlock, { once: true, capture: true });
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => {});
      }
    }

    return () => {
      shared.listeners.delete(listener);
      if (enabled) {
        shared.enabledCount = Math.max(0, shared.enabledCount - 1);
        stopSharedTimerIfIdle();
      }
    };
  }, [enabled, pollMs]);

  const dismissToast = useCallback((toastId: string) => {
    shared.toasts = shared.toasts.filter(toast => toast.id !== toastId);
    emit();
  }, []);

  return {
    toasts,
    attentionCount,
    dismissToast,
  };
}
