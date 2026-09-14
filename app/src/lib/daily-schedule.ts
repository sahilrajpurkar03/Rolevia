export function dailyBatch<T>(profiles: T[], date: string) {
  const capacity = 4;
  if (profiles.length <= capacity) return { selected: profiles, deferred: 0 };
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const offset = (day * capacity) % profiles.length;
  return {
    selected: Array.from(
      { length: capacity },
      (_, index) => profiles[(offset + index) % profiles.length],
    ),
    deferred: profiles.length - capacity,
  };
}
