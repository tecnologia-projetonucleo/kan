import type { ReactNode } from "react";
import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

import type { CardArea } from "~/components/CardArea";
import type { RouterOutputs } from "~/utils/api";
import { AreaDot, CARD_AREAS, getArea } from "~/components/CardArea";
import { PageHead } from "~/components/PageHead";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

type Report = RouterOutputs["report"]["workspace"];
type ReportCard = Report["aging"][number];
type Period = 7 | 30 | 90;
type AreaFilter = CardArea | "none" | "";

const PERIODS: Period[] = [7, 30, 90];

// Accent colours from the report design; they read on both themes.
const BLUE = "#6ea8fe";
const RED = "#f07070";
const AMBER = "#e5b84a";
const GREEN = "#5ec8b0";
const PURPLE = "#a78bfa";
const ORANGE = "#e5a35a";
const P85 = "#3a4f73";
const GREY = "#8a8a93";

const SECTION =
  "rounded-xl border border-light-300 bg-white p-5 dark:border-dark-300 dark:bg-dark-100";
const TITLE = "text-[17px] font-semibold text-neutral-900 dark:text-dark-1000";
const SUBTITLE = "mt-1 text-[13px] text-light-900 dark:text-dark-900";
const MUTED = "text-light-900 dark:text-dark-900";
const SOFT = "text-light-950 dark:text-dark-950";
const TRACK = "overflow-hidden bg-light-300 dark:bg-[#2a2a30]";
const TILE =
  "flex-1 basis-[120px] rounded-lg bg-light-100 p-3 dark:bg-dark-200";
const TH =
  "border-b border-light-300 px-2.5 py-2 font-medium dark:border-dark-300";
const TD = "border-b border-light-200 p-2.5 dark:border-dark-200";
const SELECT =
  "rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-[13px] text-neutral-900 ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 disabled:opacity-60 dark:bg-dark-100 dark:text-dark-1000 dark:ring-dark-500";

const TONE_CHIP: Record<string, string> = {
  blocked: "bg-red-100 text-red-800 dark:bg-[#3a1d1f] dark:text-[#f3a7a7]",
  progress: "bg-blue-100 text-blue-800 dark:bg-[#1d2a3a] dark:text-[#a9c8ff]",
  validation:
    "bg-amber-100 text-amber-800 dark:bg-[#3a311d] dark:text-[#f0cd7a]",
};

const pct = (value: number, max: number) =>
  `${Math.min(100, Math.round((value / Math.max(1, max)) * 100))}%`;

const ageColour = (days: number) =>
  days >= 10 ? RED : days >= 5 ? AMBER : BLUE;

const ageText = (days: number) =>
  days >= 10
    ? "text-red-600 dark:text-[#f07070]"
    : days >= 5
      ? "text-amber-600 dark:text-[#e5b84a]"
      : "text-blue-600 dark:text-[#6ea8fe]";

function Dot({ colour }: { colour: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colour }}
    />
  );
}

function Bar({
  width,
  colour,
  className,
}: {
  width: string;
  colour: string;
  className?: string;
}) {
  return (
    <div
      className={twMerge("h-full rounded-[3px]", className)}
      style={{ width, backgroundColor: colour }}
    />
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-light-100 p-3.5 text-[13px] text-light-900 dark:bg-dark-200 dark:text-dark-900">
      {children}
    </p>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge(
        "animate-pulse rounded-md bg-light-200 dark:bg-dark-200",
        className,
      )}
    />
  );
}

export default function ReportsView() {
  const { i18n } = useLingui();
  // App locale ids drop the separator ("ptbr"); Intl needs a real tag.
  const dateTag = i18n.locale === "ptbr" ? "pt-BR" : i18n.locale;
  const { workspace } = useWorkspace();
  const [boardPublicId, setBoardPublicId] = useState("");
  const [area, setArea] = useState<AreaFilter>("");
  const [days, setDays] = useState<Period>(30);

  const { data, isLoading, isError } = api.report.workspace.useQuery(
    {
      workspacePublicId: workspace.publicId,
      boardPublicId: boardPublicId || undefined,
      area: area || undefined,
      days,
    },
    {
      enabled: workspace.publicId.length >= 12,
      placeholderData: keepPreviousData,
    },
  );

  const formatDays = (count: number | null | undefined) =>
    // Not Lingui's plural(): the app's pt-BR locale code ("ptbr") is not a
    // valid Intl language tag, so plural rules throw at runtime.
    count == null ? "—" : count === 1 ? t`1 day` : t`${count} days`;

  const areaName = (key: string | null) =>
    key ? (getArea(key as CardArea)?.name ?? key) : t`No area`;
  const areaColour = (key: string | null) =>
    key ? (getArea(key as CardArea)?.colour ?? GREY) : GREY;

  const ticket = (card: ReportCard) =>
    card.cardNumber == null
      ? null
      : workspace.cardPrefix
        ? `${workspace.cardPrefix}-${card.cardNumber}`
        : `#${card.cardNumber}`;

  const owners = (card: ReportCard) =>
    card.owners.length ? card.owners.join(", ") : t`No assignee`;

  const workspaceName = workspace.name;
  const dataDate = data
    ? new Date(data.generatedAt).toLocaleDateString(dateTag)
    : "";

  return (
    <>
      <PageHead title={`${t`Reports`} | ${workspace.name || t`Workspace`}`} />
      <div className="m-auto h-full max-w-[1280px] px-4 py-8 md:px-8 md:py-10">
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className={twMerge("text-[13px]", MUTED)}>
                {t`Kanban · ${workspaceName}`}
              </p>
              <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900 dark:text-dark-1000">
                {t`Reports`}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dataDate && (
                <span className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 dark:border-[#2f6b5e] dark:text-[#5ec8b0]">
                  {t`Live data from ${dataDate}`}
                </span>
              )}
              <select
                aria-label={t`Board`}
                className={SELECT}
                value={boardPublicId}
                disabled={!data}
                onChange={(e) => setBoardPublicId(e.target.value)}
              >
                <option value="">{t`All boards`}</option>
                {data?.boards.map((board) => (
                  <option key={board.publicId} value={board.publicId}>
                    {board.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={t`Area`}
                className={SELECT}
                value={area}
                onChange={(e) => setArea(e.target.value as AreaFilter)}
              >
                <option value="">{t`All areas`}</option>
                {CARD_AREAS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
                <option value="none">{t`No area`}</option>
              </select>
              <div
                role="group"
                aria-label={t`Period`}
                className="flex rounded-lg p-0.5 ring-1 ring-inset ring-light-600 dark:ring-dark-500"
              >
                {PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={days === period}
                    onClick={() => setDays(period)}
                    className={twMerge(
                      "rounded-md px-2.5 py-1.5 text-[13px]",
                      days === period
                        ? "bg-light-200 font-medium text-neutral-900 dark:bg-dark-300 dark:text-dark-1000"
                        : "text-light-900 hover:text-neutral-900 dark:text-dark-900 dark:hover:text-dark-1000",
                    )}
                  >
                    {formatDays(period)}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {isError && !data ? (
            <Empty>{t`Could not load the report.`}</Empty>
          ) : isLoading || !data ? (
            <ReportSkeleton />
          ) : (
            <ReportBody
              data={data}
              formatDays={formatDays}
              areaName={areaName}
              areaColour={areaColour}
              ticket={ticket}
              owners={owners}
              locale={dateTag}
            />
          )}
        </div>
      </div>
    </>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[98px] rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function ReportBody({
  data,
  formatDays,
  areaName,
  areaColour,
  ticket,
  owners,
  locale,
}: {
  data: Report;
  formatDays: (count: number | null | undefined) => string;
  areaName: (key: string | null) => string;
  areaColour: (key: string | null) => string;
  ticket: (card: ReportCard) => string | null;
  owners: (card: ReportCard) => string;
  locale: string;
}) {
  const { kpis, cycle } = data;
  const diff = kpis.doneLast7Days - kpis.donePrevious7Days;
  const signedDiff = `${diff >= 0 ? "+" : ""}${diff}`;
  const openCount = kpis.open;
  const blockedAvg = formatDays(kpis.blockedAvgDays);
  const validationAvg = formatDays(kpis.validationAvgDays);
  const cycleP85 = formatDays(cycle.p85);
  const cycleCount = cycle.count;
  const periodDays = data.days;

  const kpiTiles = [
    {
      label: t({ message: "In progress", context: "report" }),
      value: kpis.progress,
      hint: t`${openCount} open cards in total`,
      colour: BLUE,
    },
    {
      label: t({ message: "Blocked", context: "report" }),
      value: kpis.blocked,
      hint: kpis.blocked ? t`For ${blockedAvg} on average` : t`None right now`,
      colour: RED,
    },
    {
      label: t`Awaiting validation`,
      value: kpis.validation,
      hint: kpis.validation
        ? t`Average wait of ${validationAvg}`
        : t`None right now`,
      colour: AMBER,
    },
    {
      label: t({ message: "Overdue", context: "report" }),
      value: kpis.overdue,
      hint: t`Past due date, still open`,
      colour: RED,
    },
    {
      label: t`Done in 7 days`,
      value: kpis.doneLast7Days,
      hint: t`${signedDiff} vs. previous 7 days`,
      colour: GREEN,
    },
    {
      label: t`Cycle time`,
      value: formatDays(cycle.median),
      hint:
        cycle.median == null
          ? t`No history yet`
          : t`Median · 85% within ${cycleP85}`,
      colour: PURPLE,
    },
  ];

  const maxBlock = Math.max(1, ...data.blockArea.map((b) => b.count));
  const maxWeek = Math.max(1, ...data.weeks.map((w) => w.count));
  const maxCycle = Math.max(1, ...cycle.byArea.map((c) => c.p85));
  const maxIntake = Math.max(
    1,
    ...data.intake.map((row) => Math.max(row.opened, row.done)),
  );

  const weekLabel = (start: string) =>
    new Date(`${start}T00:00:00Z`).toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
  const weeksSummary = data.weeks
    .map((w) => {
      const label = weekLabel(w.start);
      const count = w.count;
      return t`week of ${label}, ${count}`;
    })
    .join("; ");

  const cardTitle = (card: ReportCard) => (
    <Link
      href={`/cards/${card.publicId}`}
      className="text-neutral-900 hover:underline dark:text-dark-1000"
    >
      {card.title}
    </Link>
  );

  const cardId = (card: ReportCard) => {
    const id = ticket(card);
    return id ? (
      <span className="mr-2 font-mono text-[11px] text-light-900 dark:text-[#8a8a93]">
        {id}
      </span>
    ) : null;
  };

  return (
    <>
      <section
        aria-label={t`Summary`}
        className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3"
      >
        {kpiTiles.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col gap-1.5 rounded-[10px] border border-light-300 bg-white px-4 py-3.5 dark:border-dark-300 dark:bg-dark-100"
          >
            <div
              className={twMerge("flex items-center gap-2 text-[13px]", MUTED)}
            >
              <Dot colour={kpi.colour} />
              {kpi.label}
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-neutral-900 dark:text-dark-1000">
              {kpi.value}
            </div>
            <div className={twMerge("text-xs", MUTED)}>{kpi.hint}</div>
          </div>
        ))}
      </section>

      <section className={SECTION}>
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className={TITLE}>{t`Stalled cards`}</h2>
            <p className={SUBTITLE}>
              {t`In progress, blocked and awaiting validation, from longest to shortest stalled.`}
            </p>
          </div>
          <span className={twMerge("text-xs", MUTED)}>
            {t`Alert from 5 days in the column`}
          </span>
        </div>
        {data.aging.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className={twMerge("text-left", MUTED)}>
                  <th className={TH}>
                    {t({ message: "Card", context: "report" })}
                  </th>
                  <th className={TH}>{t`Area`}</th>
                  <th className={TH}>{t`Column`}</th>
                  <th className={TH}>{t`Assignee`}</th>
                  <th className={twMerge(TH, "w-[220px]")}>{t`Stalled for`}</th>
                </tr>
              </thead>
              <tbody>
                {data.aging.map((card) => (
                  <tr key={card.publicId}>
                    <td className={TD}>
                      {cardId(card)}
                      {cardTitle(card)}
                    </td>
                    <td className={twMerge(TD, SOFT)}>{areaName(card.area)}</td>
                    <td className={TD}>
                      <span
                        className={twMerge(
                          "whitespace-nowrap rounded-[5px] px-2 py-0.5 text-xs",
                          TONE_CHIP[card.tone] ?? TONE_CHIP.progress,
                        )}
                      >
                        {card.listName}
                      </span>
                    </td>
                    <td className={twMerge(TD, SOFT)}>{owners(card)}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <div
                          className={twMerge(
                            "h-1.5 flex-1 rounded-[3px]",
                            TRACK,
                          )}
                        >
                          <Bar
                            width={pct(card.days, 14)}
                            colour={ageColour(card.days)}
                          />
                        </div>
                        <span
                          className={twMerge(
                            "w-14 text-right font-medium",
                            ageText(card.days),
                          )}
                        >
                          {formatDays(card.days)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t`No cards in progress, blocked or awaiting validation.`}</Empty>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={SECTION}>
          <h2 className={TITLE}>{t`Blocks`}</h2>
          <p className={twMerge(SUBTITLE, "mb-4")}>
            {t`Cards blocked right now, by area.`}
          </p>
          {kpis.blocked > 0 ? (
            <>
              <div className="flex flex-col gap-2.5">
                {data.blockArea.map((row) => (
                  <div key={row.area ?? "none"} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[13px] text-neutral-900 dark:text-dark-1000">
                      <span>{areaName(row.area)}</span>
                      <span className={SOFT}>{row.count}</span>
                    </div>
                    <div className={twMerge("h-2 rounded", TRACK)}>
                      <Bar
                        width={pct(row.count, maxBlock)}
                        colour={RED}
                        className="rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className={twMerge("mt-4 text-[13px]", MUTED)}>
                {t`Average time blocked:`}{" "}
                <span className="font-medium text-red-600 dark:text-[#f07070]">
                  {blockedAvg}
                </span>
              </p>
            </>
          ) : (
            <Empty>{t`No cards blocked right now.`}</Empty>
          )}
        </section>

        <section className={SECTION}>
          <h2 className={TITLE}>{t`Throughput per week`}</h2>
          <p className={twMerge(SUBTITLE, "mb-4")}>
            {t`Cards that entered Done per week (weeks start on Monday).`}
          </p>
          <div
            role="img"
            aria-label={t`Bar chart: ${weeksSummary}`}
            className="flex h-40 items-end gap-3 border-b border-light-400 px-1 dark:border-dark-500"
          >
            {data.weeks.map((week) => (
              <div
                key={week.start}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className={twMerge("text-xs", SOFT)}>{week.count}</span>
                <div
                  className="w-full max-w-[48px] rounded-t"
                  style={{
                    height: Math.max(
                      2,
                      Math.round((week.count / maxWeek) * 120),
                    ),
                    backgroundColor: BLUE,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 px-1 pt-1.5" aria-hidden="true">
            {data.weeks.map((week) => (
              <span
                key={week.start}
                className={twMerge("flex-1 text-center text-[11px]", MUTED)}
              >
                {weekLabel(week.start)}
              </span>
            ))}
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={TITLE}>{t`Cycle time`}</h2>
          <p className={twMerge(SUBTITLE, "mb-4")}>
            {t`From the first entry into "In progress" until "Done". Median and 85% of cards.`}
          </p>
          {cycle.count > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap gap-3">
                <div className={TILE}>
                  <div className={twMerge("text-xs", MUTED)}>{t`Median`}</div>
                  <div className="text-[22px] font-semibold text-neutral-900 dark:text-dark-1000">
                    {formatDays(cycle.median)}
                  </div>
                </div>
                <div className={TILE}>
                  <div className={twMerge("text-xs", MUTED)}>
                    {t`85% done within`}
                  </div>
                  <div className="text-[22px] font-semibold text-neutral-900 dark:text-dark-1000">
                    {cycleP85}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {cycle.byArea.map((row) => (
                  <div
                    key={row.area ?? "none"}
                    className="grid grid-cols-[110px_minmax(0,1fr)_96px] items-center gap-2.5 text-[13px] text-neutral-900 dark:text-dark-1000"
                  >
                    <span className="truncate">{areaName(row.area)}</span>
                    <div className="relative h-2 rounded bg-light-300 dark:bg-[#2a2a30]">
                      <div
                        className="absolute left-0 top-0 h-full rounded"
                        style={{
                          width: pct(row.p85, maxCycle),
                          backgroundColor: P85,
                        }}
                      />
                      <div
                        className="absolute left-0 top-0 h-full rounded"
                        style={{
                          width: pct(row.median, maxCycle),
                          backgroundColor: BLUE,
                        }}
                      />
                    </div>
                    <span className={twMerge("text-right", SOFT)}>
                      {row.median} / {formatDays(row.p85)}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className={twMerge("mt-3 flex flex-wrap gap-4 text-xs", MUTED)}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: BLUE }}
                  />
                  {t`Median`}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: P85 }}
                  />
                  85%
                </span>
                <span>{t`Based on ${cycleCount} cards`}</span>
              </div>
            </>
          ) : (
            <Empty>
              {t`No done cards with a recorded pass through "In progress" yet. Column history started being recorded a few days ago.`}
            </Empty>
          )}
        </section>

        <section className={SECTION}>
          <h2 className={TITLE}>{t`Awaiting validation`}</h2>
          <p className={twMerge(SUBTITLE, "mb-4")}>
            {t`Finished work waiting for approval.`}
          </p>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className={TILE}>
              <div className={twMerge("text-xs", MUTED)}>
                {t`Cards waiting`}
              </div>
              <div className="text-[22px] font-semibold text-neutral-900 dark:text-dark-1000">
                {kpis.validation}
              </div>
            </div>
            <div className={TILE}>
              <div className={twMerge("text-xs", MUTED)}>{t`Average wait`}</div>
              <div className="text-[22px] font-semibold text-amber-600 dark:text-[#e5b84a]">
                {validationAvg}
              </div>
            </div>
          </div>
          {data.validation.length > 0 ? (
            <div className="flex flex-col">
              {data.validation.map((card) => (
                <div
                  key={card.publicId}
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-light-200 py-2.5 text-[13px] dark:border-dark-200"
                >
                  {cardId(card)}
                  <span className="min-w-0 flex-1 basis-40">
                    {cardTitle(card)}
                  </span>
                  <span className={MUTED}>{owners(card)}</span>
                  <span
                    className={twMerge(
                      "font-medium",
                      card.days >= 3
                        ? "text-amber-600 dark:text-[#e5b84a]"
                        : SOFT,
                    )}
                  >
                    {formatDays(card.days)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t`No cards awaiting validation right now.`}</Empty>
          )}
        </section>
      </div>

      <section className={SECTION}>
        <h2 className={TITLE}>{t`Demand intake by area`}</h2>
        <p className={twMerge(SUBTITLE, "mb-3.5")}>
          {t`What each area opened and finished in the last ${periodDays} days. Bugs and high priority count among the opened ones.`}
        </p>
        {data.intake.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px] text-neutral-900 dark:text-dark-1000">
                <thead>
                  <tr className={twMerge("text-left", MUTED)}>
                    <th className={TH}>{t`Area`}</th>
                    <th className={twMerge(TH, "text-right")}>{t`Opened`}</th>
                    <th className={twMerge(TH, "text-right")}>
                      {t({ message: "Done", context: "report" })}
                    </th>
                    <th className={twMerge(TH, "text-right")}>{t`Bugs`}</th>
                    <th className={twMerge(TH, "text-right")}>
                      {t`High or urgent`}
                    </th>
                    <th className={twMerge(TH, "w-[200px]")}>
                      {t`Opened vs. done`}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.intake.map((row) => (
                    <tr key={row.area ?? "none"}>
                      <td className={TD}>
                        <span className="inline-flex items-center gap-2">
                          <AreaDot colour={areaColour(row.area)} />
                          {areaName(row.area)}
                        </span>
                      </td>
                      <td className={twMerge(TD, "text-right")}>
                        {row.opened}
                      </td>
                      <td className={twMerge(TD, "text-right")}>{row.done}</td>
                      <td className={twMerge(TD, "text-right", SOFT)}>
                        {row.bugs}
                      </td>
                      <td className={twMerge(TD, "text-right", SOFT)}>
                        {row.high}
                      </td>
                      <td className={TD}>
                        <div className="flex flex-col gap-[3px]">
                          <div
                            className={twMerge("h-1.5 rounded-[3px]", TRACK)}
                          >
                            <Bar
                              width={pct(row.opened, maxIntake)}
                              colour={ORANGE}
                            />
                          </div>
                          <div
                            className={twMerge("h-1.5 rounded-[3px]", TRACK)}
                          >
                            <Bar
                              width={pct(row.done, maxIntake)}
                              colour={BLUE}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className={twMerge("mt-3 flex flex-wrap gap-4 text-xs", MUTED)}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: ORANGE }}
                />
                {t`Opened`}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: BLUE }}
                />
                {t({ message: "Done", context: "report" })}
              </span>
            </div>
          </>
        ) : (
          <Empty>{t`No cards opened or done in this period.`}</Empty>
        )}
      </section>
    </>
  );
}
