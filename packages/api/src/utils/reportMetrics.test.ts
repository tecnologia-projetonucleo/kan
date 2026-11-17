import { describe, expect, it } from "vitest";

import type { ReportCardInput } from "./reportMetrics";
import {
  bucketByWeek,
  computeReport,
  DAY_MS,
  getReportTone,
  median,
  percentile,
  weekStarts,
} from "./reportMetrics";

describe("getReportTone", () => {
  it.each([
    ["Backlog", "backlog"],
    ["Priorizada", "prioritized"],
    ["Em Andamento", "progress"],
    ["Bloqueado", "blocked"],
    ["Aguardando validação", "validation"],
    ["Concluído", "done"],
    ["Cancelado", "cancelled"],
    ["Ideias", "backlog"],
  ])("%s -> %s", (name, tone) => {
    expect(getReportTone(name)).toBe(tone);
  });
});

describe("median and percentile", () => {
  it("returns null for no values", () => {
    expect(median([])).toBeNull();
    expect(percentile([], 0.85)).toBeNull();
  });

  it("uses the lower middle value and nearest rank", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.85)).toBe(9);
    expect(percentile([7], 0.85)).toBe(7);
  });
});

describe("week bucketing", () => {
  // Wednesday 2026-11-18 12:00 UTC.
  const now = new Date("2026-11-18T12:00:00Z");

  it("starts weeks on Monday, oldest first", () => {
    const starts = weekStarts(now, 3);
    expect(starts.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
    ]);
  });

  it("counts dates per week and ignores dates outside", () => {
    const starts = weekStarts(now, 2);
    const counts = bucketByWeek(
      [
        new Date("2026-11-09T00:00:00Z"),
        new Date("2026-11-15T23:59:00Z"),
        new Date("2026-11-16T00:00:00Z"),
        new Date("2026-11-01T10:00:00Z"),
      ],
      starts,
    );
    expect(counts).toEqual([2, 1]);
  });
});

describe("computeReport", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const card = (
    patch: Partial<ReportCardInput<string>>,
  ): ReportCardInput<string> => ({
    publicId: "card00000000",
    title: "Card",
    cardNumber: 1,
    createdAt: ago(20),
    dueDate: null,
    priority: "normal",
    area: "dados",
    type: "improvement",
    listName: "Backlog",
    boardName: "Board",
    listEnteredAt: ago(20),
    progressEntries: [],
    owners: [],
    ...patch,
  });

  it("computes cycle time, aging and intake", () => {
    const report = computeReport(
      [
        card({
          listName: "Concluído",
          listEnteredAt: ago(2),
          progressEntries: [ago(6), ago(4)],
          createdAt: ago(10),
          type: "bug",
          priority: "high",
        }),
        card({ listName: "Bloqueado", listEnteredAt: ago(12), area: null }),
        card({
          listName: "Em andamento",
          listEnteredAt: ago(3),
          dueDate: ago(1),
        }),
      ],
      { now, days: 30 },
    );

    expect(report.cycle).toMatchObject({ median: 4, p85: 4, count: 1 });
    expect(report.kpis).toMatchObject({
      open: 2,
      progress: 1,
      blocked: 1,
      blockedAvgDays: 12,
      overdue: 1,
      doneLast7Days: 1,
    });
    expect(report.aging.map((a) => a.days)).toEqual([12, 3]);
    expect(report.blockArea).toEqual([{ area: null, count: 1 }]);
    expect(report.intake).toEqual([
      { area: "dados", opened: 2, done: 1, bugs: 1, high: 1 },
      { area: null, opened: 1, done: 0, bugs: 0, high: 0 },
    ]);
  });
});
