import { sessionAuthHeaders, withSessionToken } from './sessionToken';
export interface AdminStatus {
  isAdmin: boolean;
  isCreator: boolean;
}

/** null = transient failure — callers should keep the last known status. */
export async function fetchAdminStatus(email: string): Promise<AdminStatus | null> {
  try {
    const res = await fetch(`/api/admin/status?email=${encodeURIComponent(email)}`, {
      headers: sessionAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json() as AdminStatus;
  } catch {
    return null;
  }
}

export async function fetchAdminEmails(creatorEmail: string): Promise<string[]> {
  const res = await fetch(
    `/api/admin/emails?creatorEmail=${encodeURIComponent(creatorEmail)}`,
    { headers: sessionAuthHeaders() },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Could not load administrators.');
  }
  const data = await res.json() as { emails: string[] };
  return data.emails;
}

export async function addAdminEmail(creatorEmail: string, email: string): Promise<string[]> {
  const res = await fetch('/api/admin/emails/add', {
    method: 'POST',
    headers: sessionAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionToken({ creatorEmail, email } as Record<string, unknown>)),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Could not add administrator.');
  }
  const data = await res.json() as { emails: string[] };
  return data.emails;
}

export async function removeAdminEmail(creatorEmail: string, email: string): Promise<string[]> {
  const res = await fetch('/api/admin/emails/remove', {
    method: 'POST',
    headers: sessionAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionToken({ creatorEmail, email } as Record<string, unknown>)),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Could not remove administrator.');
  }
  const data = await res.json() as { emails: string[] };
  return data.emails;
}
