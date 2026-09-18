function storageKey(userId: string): string {
  return `blox-upgrader/applied-level-grants/${userId}`;
}

export function loadAppliedLevelGrantIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function markAppliedLevelGrantIds(userId: string, grantIds: Iterable<string>): void {
  const ids = loadAppliedLevelGrantIds(userId);
  for (const id of grantIds) ids.add(id);
  localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
}
