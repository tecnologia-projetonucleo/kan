// Pure metric helpers for the workspace report (routers/report.ts). Lists
// have no status field, so each list's role comes from its name, like the
// board colours its columns (apps/web views/board/utils/listStatus.ts) with
// one extra tone for "waiting for validation" lists.

export type ReportTone =
  | "backlog"
  | "prioritized"
  | "progress"
  | "blocked"
  | "validation"
  | "done"
  | "cancelled";

const TONE_PATTERNS: [ReportTone, RegExp][] = [
  ["cancelled", /cancel/],
  ["done", /conclu|done|complete|finaliz|entregue/],
  ["blocked", /bloque|blocked|impedid|travad/],
  ["validation", /valida|aguardando|homolog|review/],
  ["progress", /andamento|progress|doing|fazendo|desenvolv/],
  ["prioritized", /prioriz|priorit|a fazer|to ?do|ready|pronto para/],
];

const normalize = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function getReportTone(listName: string): ReportTone {
  const normalized = normalize(listName);
  return (
    TONE_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] ??
    "backlog"
  );
}

export const DAY_MS = 24 * 60 * 60 * 1000;

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);

/** Lower median: the middle value, or the lower of the two middle values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return sorted(values)[Math.floor((values.length - 1) / 2)] ?? null;
}

/** Nearest-rank percentile, `p` between 0 and 1. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const list = sorted(values);
  const rank = Math.min(
    list.length - 1,
    Math.max(0, Math.ceil(p * list.length) - 1),
  );
  return list[rank] ?? null;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

/** Whole days elapsed between `from` and `now`. */
export const daysSince = (from: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));

/**
 * Start (Monday 00:00 UTC) of the last `count` weeks, oldest first; the last
 * one is the current week.
 */
export function weekStarts(now: Date, count: number): Date[] {
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from(
    { length: count },
    (_, i) => new Date(monday.getTime() - (count - 1 - i) * 7 * DAY_MS),
  );
}

/** How many dates fall in each week that starts at `starts[i]`. */
export function bucketByWeek(dates: Date[], starts: Date[]): number[] {
  return starts.map((start) => {
    const end = start.getTime() + 7 * DAY_MS;
    return dates.filter(
      (date) => date.getTime() >= start.getTime() && date.getTime() < end,
    ).length;
  });
}

export interface ReportCardInput<Area extends string> {
  publicId: string;
  title: string;
  cardNumber: number | null;
  createdAt: Date;
  dueDate: Date | null;
  priority: string;
  area: Area | null;
  type: string | null;
  listName: string;
  boardName: string;
  /** Time of the last move into the current list (creation if never moved). */
  listEnteredAt: Date;
  /** Times the card was moved into an in-progress list. */
  progressEntries: Date[];
  owners: string[];
}

const OPEN_WORK: ReportTone[] = ["progress", "blocked", "validation"];

/** Every figure of the report, from cards already filtered by board/area. */
export function computeReport<Area extends string>(
  input: ReportCardInput<Area>[],
  options: { now: Date; days: number; agingLimit?: number; weeks?: number },
) {
  const { now, days } = options;
  const cards = input.map((card) => ({
    ...card,
    tone: getReportTone(card.listName),
    daysInList: daysSince(card.listEnteredAt, now),
  }));
  const byTone = (tone: ReportTone) => cards.filter((c) => c.tone === tone);
  const ageMs = (date: Date) => now.getTime() - date.getTime();

  const open = cards.filter((c) => c.tone !== "done" && c.tone !== "cancelled");
  const today = now.toISOString().slice(0, 10);
  const overdue = open.filter(
    (c) => c.dueDate && c.dueDate.toISOString().slice(0, 10) < today,
  );

  // Done cards are dated by when they entered the done list.
  const done = byTone("done");
  const doneLastWeek = done.filter((c) => ageMs(c.listEnteredAt) < 7 * DAY_MS);
  const donePreviousWeek = done.filter((c) => {
    const age = ageMs(c.listEnteredAt);
    return age >= 7 * DAY_MS && age < 14 * DAY_MS;
  });

  // Cycle time: first move into an in-progress list until entering done.
  const cycles: { area: Area | null; days: number }[] = [];
  for (const card of done) {
    if (card.progressEntries.length === 0) continue;
    const start = Math.min(...card.progressEntries.map((d) => d.getTime()));
    const end = card.listEnteredAt.getTime();
    if (end <= start) continue;
    cycles.push({
      area: card.area,
      days: Math.max(1, Math.round((end - start) / DAY_MS)),
    });
  }
  const cycleDays = cycles.map((c) => c.days);
  const cycleGroups = new Map<Area | null, number[]>();
  for (const cycle of cycles) {
    const group = cycleGroups.get(cycle.area) ?? [];
    group.push(cycle.days);
    cycleGroups.set(cycle.area, group);
  }
  const cycleByArea = [...cycleGroups.entries()]
    .map(([area, values]) => ({
      area,
      median: median(values) ?? 0,
      p85: percentile(values, 0.85) ?? 0,
      count: values.length,
    }))
    .sort((a, b) => b.count - a.count);

  const summary = (c: (typeof cards)[number]) => ({
    publicId: c.publicId,
    cardNumber: c.cardNumber,
    title: c.title,
    area: c.area,
    boardName: c.boardName,
    listName: c.listName,
    tone: c.tone,
    owners: c.owners,
    days: c.daysInList,
  });

  const aging = cards
    .filter((c) => OPEN_WORK.includes(c.tone))
    .sort((a, b) => b.daysInList - a.daysInList)
    .slice(0, options.agingLimit ?? 10)
    .map(summary);

  const blocked = byTone("blocked");
  const blockCounts = new Map<Area | null, number>();
  for (const card of blocked)
    blockCounts.set(card.area, (blockCounts.get(card.area) ?? 0) + 1);
  const blockArea = [...blockCounts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);

  const validation = byTone("validation")
    .sort((a, b) => b.daysInList - a.daysInList)
    .map(summary);

  const starts = weekStarts(now, options.weeks ?? 6);
  const weekCounts = bucketByWeek(
    done.map((c) => c.listEnteredAt),
    starts,
  );
  const weeks = starts.map((start, i) => ({
    start: start.toISOString().slice(0, 10),
    count: weekCounts[i] ?? 0,
  }));

  const inPeriod = (date: Date) => ageMs(date) < days * DAY_MS;
  const areas = [...new Set(cards.map((c) => c.area))];
  const intake = areas
    .map((area) => {
      const ofArea = cards.filter((c) => c.area === area);
      const opened = ofArea.filter((c) => inPeriod(c.createdAt));
      return {
        area,
        opened: opened.length,
        done: ofArea.filter(
          (c) => c.tone === "done" && inPeriod(c.listEnteredAt),
        ).length,
        bugs: opened.filter((c) => c.type === "bug").length,
        high: opened.filter(
          (c) => c.priority === "high" || c.priority === "urgent",
        ).length,
      };
    })
    .filter((row) => row.opened > 0 || row.done > 0)
    .sort((a, b) => b.opened + b.done - (a.opened + a.done));

  // Cards behind each summary tile, longest in their column first.
  const listOf = (list: typeof cards) =>
    [...list].sort((a, b) => b.daysInList - a.daysInList).map(summary);

  return {
    kpiCards: {
      progress: listOf(byTone("progress")),
      blocked: listOf(blocked),
      validation,
      overdue: listOf(overdue),
      doneLast7Days: listOf(doneLastWeek),
    },
    kpis: {
      open: open.length,
      progress: byTone("progress").length,
      blocked: blocked.length,
      blockedAvgDays: average(blocked.map((c) => c.daysInList)),
      validation: validation.length,
      validationAvgDays: average(validation.map((c) => c.days)),
      overdue: overdue.length,
      doneLast7Days: doneLastWeek.length,
      donePrevious7Days: donePreviousWeek.length,
    },
    cycle: {
      median: median(cycleDays),
      p85: percentile(cycleDays, 0.85),
      count: cycleDays.length,
      byArea: cycleByArea,
    },
    aging,
    blockArea,
    validation,
    weeks,
    intake,
  };
}
