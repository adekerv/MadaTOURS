const historyKey = 'madatours:recent-searches:v1';
export function recentSearches(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string' && item.length <= 100)
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}
export function rememberSearch(query: string): string[] {
  const value = query.trim().slice(0, 100);
  const next = value
    ? [
        value,
        ...recentSearches().filter(
          (item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase(),
        ),
      ].slice(0, 5)
    : recentSearches();
  try {
    localStorage.setItem(historyKey, JSON.stringify(next));
  } catch {
    /* Discovery works without storage. */
  }
  return next;
}
export function clearSearches(): void {
  try {
    localStorage.removeItem(historyKey);
  } catch {
    /* Storage may be disabled. */
  }
}
