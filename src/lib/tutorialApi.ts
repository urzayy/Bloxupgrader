const LOCAL_KEY = 'blox-upgrader/tutorial-seen-v1';

export function hasLocalTutorialSeen(): boolean {
  try {
    return localStorage.getItem(LOCAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLocalTutorialSeen(): void {
  try {
    localStorage.setItem(LOCAL_KEY, '1');
  } catch {
    /* ignore */
  }
}

export async function fetchTutorialStatus(): Promise<{ seen: boolean }> {
  try {
    const res = await fetch('/api/tutorial/status', { credentials: 'same-origin' });
    if (!res.ok) return { seen: hasLocalTutorialSeen() };
    const data = await res.json() as { seen?: boolean };
    return { seen: Boolean(data.seen) || hasLocalTutorialSeen() };
  } catch {
    return { seen: hasLocalTutorialSeen() };
  }
}

export async function completeTutorial(): Promise<void> {
  markLocalTutorialSeen();
  try {
    await fetch('/api/tutorial/complete', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* local mark is enough offline */
  }
}
