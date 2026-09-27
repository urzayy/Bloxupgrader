import fs from 'node:fs';
import path from 'node:path';
import { createTimedSupabase } from './supabaseEnv.mjs';
import { preferLocalFileStore } from './localFilePrefer.mjs';

function countUnreadUserMessages(messages, lastReadAt) {
  return messages.filter(message => message.senderRole === 'user' && message.createdAt > lastReadAt).length;
}

function buildInboxItems(tickets, loadBundle, lastReadByTicket = {}, { includeBundle = false } = {}) {
  return tickets.map(ticket => {
    const bundle = loadBundle(ticket.id);
    const messages = bundle?.messages ?? [];
    const userMessages = messages.filter(message => message.senderRole === 'user');
    const lastUserMessage = userMessages.length
      ? userMessages.reduce((latest, message) => (
        message.createdAt > latest.createdAt ? message : latest
      ))
      : null;
    const lastUserMessageAt = lastUserMessage?.createdAt ?? 0;
    const storedRead = lastReadByTicket[ticket.id];
    const unreadCount = storedRead === undefined
      ? Math.max(1, userMessages.length)
      : countUnreadUserMessages(messages, storedRead);
    return {
      ticket: bundle?.ticket ?? ticket,
      ...(includeBundle && bundle ? { bundle } : {}),
      unreadCount,
      lastUserMessageAt,
      lastUserMessageText: lastUserMessage?.text?.slice(0, 160) ?? null,
      isUnseen: storedRead === undefined,
    };
  });
}

async function mergeTicketLists(remoteStore, fileStore, filter) {
  const ticketMap = new Map();
  const addTickets = (tickets) => {
    for (const ticket of tickets) {
      if (!ticket?.id) continue;
      const existing = ticketMap.get(ticket.id);
      if (!existing || ticket.updatedAt > existing.updatedAt) {
        ticketMap.set(ticket.id, ticket);
      }
    }
  };

  // Merge full lists first so a cancelled copy on one side wins over a stale "open" on the other.
  const baseFilter = { userId: filter?.userId };
  try {
    addTickets(await remoteStore.listTickets(baseFilter));
  } catch (error) {
    console.error('[withdraw-chat] remote list failed, merging file tickets:', supabaseErrorMessage(error));
  }

  try {
    addTickets(await fileStore.listTickets(baseFilter));
  } catch (error) {
    console.error('[withdraw-chat] file list failed:', supabaseErrorMessage(error));
  }

  let tickets = Array.from(ticketMap.values());
  if (filter?.openOnly) {
    tickets = tickets.filter(ticket => ticket.status === 'open');
  }
  return tickets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createFileWithdrawChatStore(chatsDir) {
  if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });
  let ticketIndex = null;

  function ticketPath(id) {
    return path.join(chatsDir, `${id}.json`);
  }

  function loadBundleSync(id) {
    const file = ticketPath(id);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  return {
    type: 'file',
    async loadBundle(id) {
      return loadBundleSync(id);
    },
    async saveBundle(bundle) {
      fs.writeFileSync(ticketPath(bundle.ticket.id), JSON.stringify(bundle, null, 2), 'utf8');
      ticketIndex = null;
      return bundle;
    },
    async deleteBundle(id) {
      const file = ticketPath(id);
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch { /* ignore */ }
      }
      ticketIndex = null;
      return { ok: true };
    },
    async listTickets(filter) {
      let files = ticketIndex;
      if (!files) {
        files = [];
        for (const file of fs.readdirSync(chatsDir).filter(name => name.endsWith('.json'))) {
          try {
            const bundle = JSON.parse(fs.readFileSync(path.join(chatsDir, file), 'utf8'));
            if (bundle?.ticket) files.push(bundle.ticket);
          } catch {
            /* skip corrupt file */
          }
        }
        ticketIndex = files;
      }
      let tickets = files;
      if (filter?.userId) tickets = tickets.filter(ticket => ticket.userId === filter.userId);
      if (filter?.openOnly) tickets = tickets.filter(ticket => ticket.status === 'open');
      return tickets.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async buildAdminInbox(lastReadByTicket = {}) {
      const tickets = (await this.listTickets({ openOnly: true })).slice(0, 60);
      return buildInboxItems(tickets, loadBundleSync, lastReadByTicket, { includeBundle: false });
    },
  };
}

export function createSupabaseWithdrawChatStore(url, secretKey) {
  const supabase = createTimedSupabase(url, secretKey);

  async function listBundles(filter) {
    let query = supabase.from('blox_withdraw_chats').select('bundle');
    if (filter?.userId) query = query.eq('user_id', filter.userId);
    else query = query.order('updated_at', { ascending: false }).limit(filter?.openOnly ? 60 : 120);
    const { data, error } = await query;
    if (error) throw error;
    let bundles = (data ?? []).map(row => row.bundle).filter(Boolean);
    if (filter?.openOnly) {
      bundles = bundles.filter(bundle => bundle.ticket?.status === 'open');
    }
    return bundles;
  }

  return {
    type: 'supabase',
    async loadBundle(id) {
      const { data, error } = await supabase
        .from('blox_withdraw_chats')
        .select('bundle')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data?.bundle ?? null;
    },
    async saveBundle(bundle) {
      const ticket = bundle.ticket;
      const { error } = await supabase
        .from('blox_withdraw_chats')
        .upsert({
          id: ticket.id,
          user_id: ticket.userId,
          bundle,
          updated_at: ticket.updatedAt || Date.now(),
        }, { onConflict: 'id' });
      if (error) throw error;
      return bundle;
    },
    async deleteBundle(id) {
      const { error } = await supabase
        .from('blox_withdraw_chats')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { ok: true };
    },
    async listTickets(filter) {
      const bundles = await listBundles(filter);
      return bundles
        .map(bundle => bundle.ticket)
        .filter(Boolean)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async buildAdminInbox(lastReadByTicket = {}) {
      const bundles = await listBundles({ openOnly: true });
      const bundleById = new Map(
        bundles
          .filter(bundle => bundle?.ticket?.id)
          .map(bundle => [bundle.ticket.id, bundle]),
      );
      const tickets = bundles.map(bundle => bundle.ticket).filter(Boolean);
      return buildInboxItems(
        tickets.slice(0, 60),
        (id) => bundleById.get(id) ?? null,
        lastReadByTicket,
        { includeBundle: false },
      );
    },
  };
}

function supabaseErrorMessage(error) {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error.message === 'string') return error.message;
  return 'database error';
}

export function createHybridWithdrawChatStore(fileStore, remoteStore) {
  async function loadMergedBundle(id) {
    let remote = null;
    let file = null;
    try {
      remote = await remoteStore.loadBundle(id);
    } catch (error) {
      console.error('[withdraw-chat] remote read failed, trying file:', supabaseErrorMessage(error));
    }
    try {
      file = await fileStore.loadBundle(id);
    } catch (error) {
      console.error('[withdraw-chat] file read failed:', supabaseErrorMessage(error));
    }
    if (remote && file) {
      const remoteUpdated = remote.ticket?.updatedAt ?? 0;
      const fileUpdated = file.ticket?.updatedAt ?? 0;
      return remoteUpdated >= fileUpdated ? remote : file;
    }
    return remote ?? file;
  }

  return {
    type: remoteStore.type === 'supabase' ? 'hybrid-supabase' : remoteStore.type,
    loadBundle: loadMergedBundle,
    async saveBundle(bundle) {
      await fileStore.saveBundle(bundle);
      try {
        await remoteStore.saveBundle(bundle);
      } catch (error) {
        console.error('[withdraw-chat] remote save failed, kept file copy:', supabaseErrorMessage(error));
      }
      return bundle;
    },
    async deleteBundle(id) {
      try {
        await fileStore.deleteBundle?.(id);
      } catch (error) {
        console.error('[withdraw-chat] file delete failed:', supabaseErrorMessage(error));
      }
      try {
        await remoteStore.deleteBundle?.(id);
      } catch (error) {
        console.error('[withdraw-chat] remote delete failed:', supabaseErrorMessage(error));
      }
      return { ok: true };
    },
    async listTickets(filter) {
      return mergeTicketLists(remoteStore, fileStore, filter);
    },
    async buildAdminInbox(lastReadByTicket = {}) {
      const tickets = (await this.listTickets({ openOnly: true })).slice(0, 60);
      return tickets.map((ticket) => {
        const storedRead = lastReadByTicket[ticket.id];
        return {
          ticket,
          unreadCount: storedRead === undefined ? 1 : 0,
          lastUserMessageAt: ticket.updatedAt ?? 0,
          lastUserMessageText: null,
          isUnseen: storedRead === undefined,
        };
      });
    },
  };
}

export function createWithdrawChatStore({ chatsDir }) {
  const fileStore = createFileWithdrawChatStore(chatsDir);
  const url = process.env.SUPABASE_URL?.trim();
  const secret = (
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  ).trim();

  if (preferLocalFileStore()) {
    if (url && secret) {
      console.log('[withdraw-chat] local file-only (skip Supabase in this environment)');
    }
    return fileStore;
  }

  if (url && secret) {
    return createHybridWithdrawChatStore(
      fileStore,
      createSupabaseWithdrawChatStore(url, secret),
    );
  }

  return fileStore;
}
