/** Pure scoring helpers; use ONLY materialized monitorRankings documents. */
export type Period = 1 | 7 | 30;
export type CachedLive = {
  id: string; title: string; thumbnail: string; publishedAt: string;
  actualStartTime?: string; views: number; growth: number | null;
};
export type Opportunity = Omit<CachedLive, 'growth'> & {
  channelId: string; channelTitle: string;
  growth1: number | null; growth7: number | null; growth30: number | null;
  acceleration: number | null; score: number | null;
  label: 'Acelerando' | 'Em alta' | 'Crescimento moderado' | 'Aguardando histórico';
};

function asNonnegative(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}
function nonnegativeInt(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
function validLiveId(id: string) { return /^[\w-]{11}$/.test(id); }

export function deriveOpportunities(
  sources: Array<{id: string; title: string; results?: Record<string, {videos?: CachedLive[]}>}>
): Opportunity[] {
  const all: Opportunity[] = [];
  for (const source of sources) {
    const byId = new Map<string, Opportunity>();
    for (const period of [1, 7, 30] as const) {
      const key = `growth${period}` as 'growth1' | 'growth7' | 'growth30';
      const rows = source.results?.[String(period)]?.videos;
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!row || typeof row.id !== 'string' || !validLiveId(row.id)) continue;
        const current = byId.get(row.id) || {
          id: row.id,
          channelId: source.id,
          channelTitle: source.title,
          title: String(row.title || ''), thumbnail: String(row.thumbnail || ''),
          publishedAt: String(row.publishedAt || ''), actualStartTime: String(row.actualStartTime || ''),
          views: nonnegativeInt(row.views),
          growth1: null, growth7: null, growth30: null,
          acceleration: null, score: null, label: 'Aguardando histórico' as const,
        };
        current[key] = asNonnegative(row.growth);
        byId.set(row.id, current);
      }
    }
    for (const live of byId.values()) {
      const g1 = live.growth1, g7 = live.growth7;
      // Compare the most recent day with the preceding six days (not the 7-day average including today).
      // Only available when BOTH daily and weekly histories exist.
      if (g1 !== null && g7 !== null && g7 >= g1) {
        const previousDailyAverage = (g7 - g1) / 6;
        live.acceleration = previousDailyAverage > 0 ? g1 / previousDailyAverage : null;
      }
      if (g1 !== null) {
        // 0-100 heuristic: absolute measured growth dominates; acceleration is supportive.
        const volume = Math.min(1, Math.log1p(g1) / Math.log1p(100_000));
        const pace = live.acceleration === null ? 0 : Math.min(1, Math.log2(Math.max(1, live.acceleration)) / 4);
        live.score = Math.round(100 * (0.85 * volume + 0.15 * pace));
        live.label = live.acceleration !== null && live.acceleration >= 2 && g1 >= 30
          ? 'Acelerando' : g1 >= 1000 ? 'Em alta' : 'Crescimento moderado';
      } else if (g7 !== null) {
        // A 7-day observation alone is displayed, but not scored as a 1-day opportunity.
        live.label = 'Aguardando histórico';
      }
      all.push(live);
    }
  }
  return all.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.growth1 ?? -1) - (a.growth1 ?? -1));
}
