import { t } from "@lingui/core/macro";
import { format, isBefore, isSameYear, startOfDay } from "date-fns";
import { HiOutlinePaperClip } from "react-icons/hi";
import {
  HiChatBubbleLeft,
  HiOutlineClock,
  HiOutlineLockClosed,
} from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import type { ListTone } from "../utils/listStatus";
import Avatar from "~/components/Avatar";
import Badge from "~/components/Badge";
import CircularProgress from "~/components/CircularProgress";
import LabelIcon from "~/components/LabelIcon";
import { useLocalisation } from "~/hooks/useLocalisation";
import { getAvatarUrl } from "~/utils/helpers";
import { compactAge } from "../utils/listStatus";

const Card = ({
  title,
  ticketNumber,
  labels,
  members,
  checklists,
  comments,
  commentCount,
  attachments,
  dueDate,
  createdAt,
  listEnteredAt,
  listTone,
}: {
  title: string;
  ticketNumber?: string | null;
  labels: { name: string; colourCode: string | null }[];
  members: {
    publicId: string;
    email: string;
    user: { name: string | null; email: string; image: string | null } | null;
  }[];
  checklists: {
    publicId: string;
    name: string;
    items: {
      publicId: string;
      title: string;
      completed: boolean;
      index: number;
    }[];
  }[];
  // Kept for callers such as the public board; the board footer no longer
  // shows a description icon.
  description?: string | null;
  comments: { publicId: string }[];
  commentCount?: number;
  attachments?: { publicId: string }[];
  dueDate?: Date | null;
  createdAt?: Date;
  listEnteredAt?: Date;
  listTone?: ListTone;
}) => {
  const { dateLocale } = useLocalisation();
  const showYear = dueDate ? !isSameYear(dueDate, new Date()) : false;
  const isOverdue = dueDate ? isBefore(dueDate, startOfDay(new Date())) : false;
  const completedItems = checklists.reduce((acc, checklist) => {
    return acc + checklist.items.filter((item) => item.completed).length;
  }, 0);

  const totalItems = checklists.reduce((acc, checklist) => {
    return acc + checklist.items.length;
  }, 0);

  const progress =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const totalComments = commentCount ?? comments.length;
  const attachmentCount = attachments?.length ?? 0;
  const isBlocked = listTone === "blocked";
  const isDone = listTone === "done" || listTone === "cancelled";
  const blockedSince = isBlocked ? listEnteredAt : undefined;
  // A missed due date stops mattering once the card is done or cancelled.
  const showOverdue = isOverdue && !isDone;
  const fullDate = (date: Date) => format(date, "PPp", { locale: dateLocale });

  const hasMeta =
    !!dueDate ||
    totalComments > 0 ||
    attachmentCount > 0 ||
    !!createdAt ||
    !!blockedSince;
  const hasRight = checklists.length > 0 || members.length > 0;

  return (
    <div
      className={twMerge(
        "flex flex-col overflow-hidden rounded-md border border-light-300 bg-light-50 px-3 py-2 text-sm text-neutral-900 shadow-sm transition duration-150 hover:-translate-y-px hover:border-light-500 hover:shadow-md dark:border-[#2e2e33] dark:bg-[#232327] dark:text-dark-1000 dark:hover:border-[#45454d] dark:hover:bg-[#27272c]",
        isDone && "opacity-60 hover:opacity-100",
        showOverdue &&
          "border-red-400/70 hover:border-red-500 dark:border-red-500/50 dark:hover:border-red-400/80",
      )}
    >
      {ticketNumber && (
        <span className="mb-0.5 font-mono text-[10px] leading-4 text-light-700 dark:text-dark-700">
          {ticketNumber}
        </span>
      )}
      <span className="break-words font-medium">{title}</span>
      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-0.5">
          {labels.map((label) => (
            <Badge
              key={label.name}
              value={label.name}
              iconLeft={<LabelIcon colourCode={label.colourCode} />}
            />
          ))}
        </div>
      )}
      {(hasMeta || hasRight) && (
        <div className="mt-2 flex items-center justify-between gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-light-800 dark:text-dark-800">
            {blockedSince && (
              <span
                className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400"
                title={t`Blocked since ${fullDate(blockedSince)}`}
              >
                <HiOutlineLockClosed
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />

                {compactAge(blockedSince)}
              </span>
            )}
            {dueDate && (
              <span
                className={twMerge(
                  "flex items-center gap-1",
                  showOverdue && "font-medium text-red-600 dark:text-red-400",
                )}
                title={
                  showOverdue
                    ? t`Overdue since ${fullDate(dueDate)}`
                    : t`Due ${fullDate(dueDate)}`
                }
              >
                <HiOutlineClock className="h-3.5 w-3.5" aria-hidden="true" />
                {format(dueDate, showYear ? "do MMM yyyy" : "do MMM", {
                  locale: dateLocale,
                })}
              </span>
            )}
            {totalComments > 0 && (
              <span
                className="flex items-center gap-1"
                aria-label={t`${totalComments} comments`}
              >
                <HiChatBubbleLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {totalComments}
              </span>
            )}
            {attachmentCount > 0 && (
              <span
                className="flex items-center gap-1"
                aria-label={t`${attachmentCount} attachments`}
              >
                <HiOutlinePaperClip
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {attachmentCount}
              </span>
            )}
            {createdAt && (
              <span title={t`Created ${fullDate(createdAt)}`}>
                {compactAge(createdAt)}
              </span>
            )}
          </div>
          {hasRight && (
            <div className="flex shrink-0 items-center justify-end gap-1">
              {checklists.length > 0 && (
                <div className="flex items-center gap-1 rounded-full border-[1px] border-light-300 px-2 py-0.5 dark:border-dark-600">
                  <CircularProgress
                    progress={progress || 2}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <span className="text-[10px] text-light-900 dark:text-dark-950">
                    {completedItems}/{totalItems}
                  </span>
                </div>
              )}
              {members.length > 0 && (
                <div className="isolate flex justify-end -space-x-1 overflow-hidden">
                  {members.map(({ publicId, user, email }) => {
                    const avatarUrl = user?.image
                      ? getAvatarUrl(user.image)
                      : undefined;

                    return (
                      <Avatar
                        key={publicId}
                        name={user?.name ?? ""}
                        email={user?.email ?? email}
                        imageUrl={avatarUrl}
                        size="sm"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Card;
