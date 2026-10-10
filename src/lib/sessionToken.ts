const SESSION_TOKEN_KEY = 'blox-upgrader/session-token';

export function loadSessionToken(): string | null {
  try {
    // Prefer localStorage so refresh/new tab keeps API auth with the UI session.
    const fromLocal = localStorage.getItem(SESSION_TOKEN_KEY);
    if (fromLocal?.trim()) return fromLocal.trim();
    const fromSession = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (fromSession?.trim()) {
      localStorage.setItem(SESSION_TOKEN_KEY, fromSession.trim());
      return fromSession.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionToken(token: string | null | undefined): void {
  try {
    if (!token?.trim()) {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      return;
    }
    const value = token.trim();
    localStorage.setItem(SESSION_TOKEN_KEY, value);
    sessionStorage.setItem(SESSION_TOKEN_KEY, value);
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
