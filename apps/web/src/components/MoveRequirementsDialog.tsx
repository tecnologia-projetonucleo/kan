import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import type { CardArea } from "~/components/CardArea";
import Button from "~/components/Button";
import { AreaDot, CARD_AREAS } from "~/components/CardArea";
import { commentTextToHtml } from "~/components/MoveCommentDialog";

export interface MoveNeeds {
  area: boolean;
  responsible: boolean;
  dueDate: boolean;
  comment: boolean;
}

export interface MoveFill {
  area?: CardArea;
  memberPublicIds?: string[];
  dueDate?: Date;
  comment?: string;
}

export const hasMoveNeeds = (needs: MoveNeeds) =>
  needs.area || needs.responsible || needs.dueDate || needs.comment;

interface MoveRequirementsDialogProps {
  listName: string;
  cardTitle?: string;
  needs: MoveNeeds;
  members: { publicId: string; name: string }[];
  isPending?: boolean;
  onConfirm: (fill: MoveFill) => void;
  onCancel: () => void;
}

const FIELD_LABEL =
  "mb-1 block text-xs font-semibold text-light-800 dark:text-dark-800";
const INPUT =
  "block w-full rounded-md border-0 bg-white/5 px-3 py-2 text-sm text-neutral-900 shadow-sm ring-1 ring-inset ring-light-600 placeholder:text-light-700 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:text-dark-1000 dark:ring-dark-700 dark:placeholder:text-dark-700";

const Required = () => (
  <span className="text-red-500" aria-hidden="true">
    {" "}
    *
  </span>
);

/**
 * Asks, in one step, for whatever a card is missing before it can move:
 * responsible area, someone responsible, a due date (In Progress onwards)
 * and a comment (blocked, waiting-for-validation and done lists). Only the
 * missing fields are shown; cancelling leaves the card where it was.
 */
export default function MoveRequirementsDialog({
  listName,
  cardTitle,
  needs,
  members,
  isPending = false,
  onConfirm,
  onCancel,
}: MoveRequirementsDialogProps) {
  const [area, setArea] = useState<CardArea | "">("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");
  const firstFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    firstFieldRef.current
      ?.querySelector<HTMLElement>("select, input, textarea, button")
      ?.focus();
  }, []);

  const ready =
    (!needs.area || !!area) &&
    (!needs.responsible || memberIds.length > 0) &&
    (!needs.dueDate || !!dueDate) &&
    (!needs.comment || comment.trim().length > 0) &&
    !isPending;

  const submit = () => {
    if (!ready) return;
    const fill: MoveFill = {};
    if (needs.area && area) fill.area = area;
    if (needs.responsible) fill.memberPublicIds = memberIds;
    if (needs.dueDate && dueDate) {
      const [year, month, day] = dueDate.split("-").map(Number);
      fill.dueDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    }
    if (needs.comment) fill.comment = commentTextToHtml(comment);
    onConfirm(fill);
  };

  const toggleMember = (publicId: string) =>
    setMemberIds((current) =>
      current.includes(publicId)
        ? current.filter((id) => id !== publicId)
        : [...current, publicId],
    );

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-requirements-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-light-300 bg-light-50 p-5 shadow-xl dark:border-dark-300 dark:bg-dark-100"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !isPending) onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <h2
          id="move-requirements-title"
          className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-dark-1000"
        >
          <HiOutlineClipboardDocumentCheck
            className="h-5 w-5 text-light-800 dark:text-dark-800"
            aria-hidden="true"
          />
          {t`Complete the card to move it`}
        </h2>
        <p className="mt-2 text-sm text-light-900 dark:text-dark-900">
          {cardTitle
            ? t`To move "${cardTitle}" to ${listName}, fill in what is missing.`
            : t`To move the card to ${listName}, fill in what is missing.`}
        </p>

        <div ref={firstFieldRef} className="mt-4 space-y-4">
          {needs.area && (
            <label className="block">
              <span className={FIELD_LABEL}>
                {t`Responsible area`}
                <Required />
              </span>
              <select
                className={INPUT}
                value={area}
                onChange={(e) => setArea(e.target.value as CardArea | "")}
              >
                <option value="">{t`Choose an area`}</option>
                {CARD_AREAS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </select>
              {area && (
                <span className="mt-1 flex items-center gap-1.5 text-xs text-light-800 dark:text-dark-800">
                  <AreaDot
                    colour={
                      CARD_AREAS.find((option) => option.key === area)
                        ?.colour ?? "#999"
                    }
                  />
                  {CARD_AREAS.find((option) => option.key === area)?.name}
                </span>
              )}
            </label>
          )}

          {needs.responsible && (
            <fieldset>
              <legend className={FIELD_LABEL}>
                {t`Responsible`}
                <Required />
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {members.map((member) => {
                  const selected = memberIds.includes(member.publicId);
                  return (
                    <button
                      key={member.publicId}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleMember(member.publicId)}
                      className={twMerge(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-light-900 bg-light-900 text-light-50 dark:border-dark-1000 dark:bg-dark-1000 dark:text-dark-50"
                          : "border-light-400 text-light-900 hover:bg-light-200 dark:border-dark-400 dark:text-dark-900 dark:hover:bg-dark-200",
                      )}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {needs.dueDate && (
            <label className="block">
              <span className={FIELD_LABEL}>
                {t`Due date`}
                <Required />
              </span>
              <input
                type="date"
                className={INPUT}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          )}

          {needs.comment && (
            <label className="block">
              <span className={FIELD_LABEL}>
                {t`Comment`}
                <Required />
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={t`Why is the card going to ${listName}?`}
                className={twMerge(INPUT, "resize-y")}
              />
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            {t`Cancel`}
          </Button>
          <Button onClick={submit} disabled={!ready} isLoading={isPending}>
            {t`Save and move`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
