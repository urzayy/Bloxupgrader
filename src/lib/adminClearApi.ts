import { sessionAuthHeaders, withSessionToken } from './sessionToken';
export interface ClearAccountResult {
  ok: boolean;
  email: string;
  userId: string | null;
  clearedAccount: boolean;
  chatsRemoved: number;
}

export async function clearAccountByEmail(
  adminEmail: string,
  targetEmail: string,
): Promise<ClearAccountResult> {
  const res = await fetch('/api/admin/clear-account', {
    method: 'POST',
    headers: sessionAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionToken({
      adminEmail,
      email: targetEmail.trim().toLowerCase(),
    } as Record<string, unknown>)),
  });

  const data = await res.json().catch(() => ({})) as ClearAccountResult & { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? 'Could not clear account');
  }
  return data;
}
