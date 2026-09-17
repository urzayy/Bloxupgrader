import { isValidGrantEmail, normalizeGrantEmail } from './inventoryGrants';
import { sessionAuthHeaders, withSessionToken } from './sessionToken';

export interface BalanceGrantRecord {
  id: string;
  targetEmail: string;
  grantedBy: string;
  amount: number;
  createdAt: number;
  status: 'pending' | 'applied';
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
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export { isValidGrantEmail, normalizeGrantEmail };

export async function createBalanceGrant(
  targetEmail: string,
  grantedBy: string,
  amount: number,
): Promise<BalanceGrantRecord> {
  const data = await api<{ grant: BalanceGrantRecord }>('/api/balance-grants', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      targetEmail: normalizeGrantEmail(targetEmail),
      grantedBy: normalizeGrantEmail(grantedBy),
      amount: Math.floor(amount),
    } as Record<string, unknown>)),
  });
  return data.grant;
}

export async function fetchPendingBalanceGrants(email: string): Promise<BalanceGrantRecord[]> {
  const normalized = normalizeGrantEmail(email);
  const data = await api<{ grants: BalanceGrantRecord[] }>(
    `/api/balance-grants?email=${encodeURIComponent(normalized)}`,
  );
  return data.grants;
}

export async function acknowledgeBalanceGrants(email: string, grantIds: string[]): Promise<void> {
  if (!grantIds.length) return;
  await api('/api/balance-grants/ack', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      email: normalizeGrantEmail(email),
      grantIds,
    } as Record<string, unknown>)),
  });
}
