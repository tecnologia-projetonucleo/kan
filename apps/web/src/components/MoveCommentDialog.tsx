import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineChatBubbleBottomCenterText } from "react-icons/hi2";

import Button from "~/components/Button";

/** Plain text from the dialog, stored as a comment in the editor's HTML. */
export const commentTextToHtml = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

interface MoveCommentDialogProps {
  listName: string;
  cardTitle?: string;
  isPending?: boolean;
  onConfirm: (commentHtml: string) => void;
  onCancel: () => void;
}

/**
 * Asks for the comment that justifies moving a card into a blocked,
 * waiting-for-validation or done list. Cancelling leaves the card where it was.
 */
export default function MoveCommentDialog({
  listName,
  cardTitle,
  isPending = false,
  onConfirm,
  onCancel,
}: MoveCommentDialogProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSubmit = text.trim().length > 0 && !isPending;
  const submit = () => {
    if (canSubmit) onConfirm(commentTextToHtml(text));
  };

  // Portalled to <body>: callers sit inside headers and menus whose stacking
  // context would otherwise paint the page over the dialog.
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
        aria-labelledby="move-comment-title"
        className="w-full max-w-md rounded-lg border border-light-300 bg-light-50 p-5 shadow-xl dark:border-dark-300 dark:bg-dark-100"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !isPending) onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <h2
          id="move-comment-title"
          className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-dark-1000"
        >
          <HiOutlineChatBubbleBottomCenterText
            className="h-5 w-5 text-light-800 dark:text-dark-800"
            aria-hidden="true"
          />
          {t`Comment required`}
        </h2>
        <p className="mt-2 text-sm text-light-900 dark:text-dark-900">
          {cardTitle
            ? t`To move "${cardTitle}" to ${listName}, leave a comment explaining why.`
            : t`To move the card to ${listName}, leave a comment explaining why.`}
        </p>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={t`Write the comment...`}
          aria-label={t`Comment`}
          className="mt-3 block w-full resize-y rounded-md border-0 bg-white/5 px-3 py-2 text-sm text-neutral-900 shadow-sm ring-1 ring-inset ring-light-600 placeholder:text-light-700 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:text-dark-1000 dark:ring-dark-700 dark:placeholder:text-dark-700"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>
            {t`Cancel`}
          </Button>
          <Button onClick={submit} disabled={!canSubmit} isLoading={isPending}>
            {t`Comment and move`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
