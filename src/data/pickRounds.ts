/** Picks up to n distinct items from the pool, in random order. */
export function pickRounds<T>(pool: T[], n: number, random: () => number = Math.random): T[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}
