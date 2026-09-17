const SESSION_TOKEN_KEY = 'blox-upgrader/session-token';

export function loadSessionToken(): string | null {
  try {
    const value = sessionStorage.getItem(SESSION_TOKEN_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function saveSessionToken(token: string | null | undefined): void {
  try {
    if (!token?.trim()) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_TOKEN_KEY, token.trim());
  } catch {
    /* storage blocked */
  }
}

export function clearSessionToken(): void {
  saveSessionToken(null);
}

export function sessionAuthHeaders(extra?: HeadersInit): HeadersInit {
  const token = loadSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { 'X-Session-Token': token } : {}),
  };
}

export function withSessionToken<T extends Record<string, unknown>>(body: T): T & { sessionToken?: string } {
  const token = loadSessionToken();
  if (!token) return body;
  return { ...body, sessionToken: token };
}
