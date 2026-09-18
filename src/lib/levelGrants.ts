import { isValidGrantEmail, normalizeGrantEmail } from './inventoryGrants';
import { sessionAuthHeaders, withSessionToken } from './sessionToken';
import { MAX_LEVEL } from './playerLevel';

export interface LevelGrantRecord {
  id: string;
  targetEmail: string;
  grantedBy: string;
  level: number;
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

export { isValidGrantEmail, normalizeGrantEmail, MAX_LEVEL };

export async function createLevelGrant(
  targetEmail: string,
  grantedBy: string,
  level: number,
): Promise<LevelGrantRecord> {
  const data = await api<{ grant: LevelGrantRecord }>('/api/level-grants', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      targetEmail: normalizeGrantEmail(targetEmail),
      grantedBy: normalizeGrantEmail(grantedBy),
      level: Math.floor(level),
    } as Record<string, unknown>)),
  });
  return data.grant;
}

export async function fetchPendingLevelGrants(email: string): Promise<LevelGrantRecord[]> {
  const normalized = normalizeGrantEmail(email);
  const data = await api<{ grants: LevelGrantRecord[] }>(
    `/api/level-grants?email=${encodeURIComponent(normalized)}`,
  );
  return data.grants;
}

export async function acknowledgeLevelGrants(email: string, grantIds: string[]): Promise<void> {
  if (!grantIds.length) return;
  await api('/api/level-grants/ack', {
    method: 'POST',
    body: JSON.stringify(withSessionToken({
      email: normalizeGrantEmail(email),
      grantIds,
    } as Record<string, unknown>)),
  });
}
