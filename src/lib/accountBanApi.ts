export interface AccountBanStatus {
  banned: boolean;
  bannedAt?: number;
  bannedUntil?: number | null;
  reason?: string | null;
  permanent?: boolean;
  days?: number | null;
}

export async function fetchAccountBanStatus(email: string): Promise<AccountBanStatus> {
  try {
    const res = await fetch(
      `/api/account-ban-status?email=${encodeURIComponent(email.trim().toLowerCase())}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return { banned: false };
    return await res.json() as AccountBanStatus;
  } catch {
    return { banned: false };
  }
}
