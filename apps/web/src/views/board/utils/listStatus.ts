import { useCallback, useEffect, useState } from "react";

// Lists have no status field, so the tone comes from the list name
// (Portuguese and English). Unknown names get the neutral tone.
export type ListTone =
  | "backlog"
  | "prioritized"
  | "progress"
  | "blocked"
  | "done"
  | "cancelled"
  | "default";

const TONE_PATTERNS: [ListTone, RegExp][] = [
  ["blocked", /bloque|blocked|impedid|travad/],
  ["done", /conclu|done|complete|finaliz|entregue/],
  ["cancelled", /cancel/],
  ["progress", /andamento|progress|doing|fazendo|desenvolv/],
  ["prioritized", /prioriz|priorit|a fazer|to ?do|ready|pronto para/],
  ["backlog", /backlog/],
];

export function getListTone(name: string): ListTone {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const match = TONE_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  return match?.[0] ?? "default";
}

// Subtle tint layered over the list background so the column keeps its
// theme colour in both light and dark mode.
export const TONE_TINT: Partial<Record<ListTone, string>> = {
  blocked: "linear-gradient(rgba(248,113,113,0.04), rgba(248,113,113,0.04))",
};

// Short age such as "5d" or "3h", for the card footer.
export function compactAge(from: Date, now: Date = new Date()): string {
  const elapsedMs = now.getTime() - from.getTime();
  const minutes = Math.max(0, Math.floor(elapsedMs / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d`;
  return `${Math.floor(days / 30)}m`;
}

interface ListPreferences {
  collapsed: boolean;
  wipLimit: number | null;
}

const DEFAULT_PREFERENCES: ListPreferences = {
  collapsed: false,
  wipLimit: null,
};

// Per-browser list preferences. Storage can be unavailable (private mode,
// blocked site data), so every access is guarded and defaults still render.
export function useListPreferences(listPublicId: string) {
  const key = `kan.list.${listPublicId}`;
  const [preferences, setPreferences] =
    useState<ListPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<ListPreferences>;
        setPreferences({ ...DEFAULT_PREFERENCES, ...stored });
      }
    } catch {
      // Keep defaults.
    }
  }, [key]);

  const update = useCallback(
    (patch: Partial<ListPreferences>) => {
      setPreferences((current) => {
        const next = { ...current, ...patch };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Preference only lasts for this page view.
        }
        return next;
      });
    },
    [key],
  );

  return { preferences, update };
}

// Due date rule (mirrors packages/api utils/dueDateRule.ts): a due date is
// required from the "in progress" list onwards. `lists` must be in board order.
export function getDueDateRequiredListIds(
  lists: { publicId: string; name: string }[],
): Set<string> {
  const progressAt = lists.findIndex(
    (list) => getListTone(list.name) === "progress",
  );
  if (progressAt < 0) return new Set();
  return new Set(lists.slice(progressAt).map((list) => list.publicId));
}

export const isDueDateRequiredError = (
  error: { message?: string } | null | undefined,
) => !!error?.message?.includes("DUE_DATE_REQUIRED");

// Comment rule (mirrors packages/api utils/dueDateRule.ts): entering a
// blocked, waiting-for-validation or done list needs a comment.
const COMMENT_LIST_PATTERN =
  /bloque|blocked|impedid|travad|aguardando|valida|review|homolog|conclu|done|complete|finaliz|entregue/;

export const listRequiresComment = (name: string) =>
  COMMENT_LIST_PATTERN.test(
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase(),
  );

export const isCommentRequiredError = (
  error: { message?: string } | null | undefined,
) => !!error?.message?.includes("COMMENT_REQUIRED");
