export async function runDailyBatch<T>(
  profiles: T[],
  attempt: (profile: T) => Promise<boolean>,
) {
  let cursor = 0;
  let processed = 0;
  let skipped = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, profiles.length) }, async () => {
      while (cursor < profiles.length) {
        const profile = profiles[cursor++];
        if (await attempt(profile)) {
          processed++;
          return;
        }
        skipped++;
      }
    }),
  );
  return {
    processed,
    skipped,
    deferred: profiles.length - processed - skipped,
  };
}
