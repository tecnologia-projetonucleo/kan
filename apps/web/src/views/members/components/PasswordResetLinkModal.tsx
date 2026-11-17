import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";

import Button from "~/components/Button";
import { useModal } from "~/providers/modal";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

/**
 * Lets a workspace admin create a one-time link for a member to set a new
 * password. The server has no email, so the admin sends the link by hand.
 */
export function PasswordResetLinkModal() {
  const { closeModal, entityLabel, entityId } = useModal();
  const { workspace } = useWorkspace();
  const [copied, setCopied] = useState(false);

  const createLink = api.member.createPasswordResetLink.useMutation();
  const link = createLink.data?.resetLink;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="p-5">
      <h2 className="text-md pb-4 font-medium text-neutral-900 dark:text-dark-1000">
        <Trans>New password link for {entityLabel}</Trans>
      </h2>
      {link ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-light-900 dark:text-dark-900">
            {t`Send this link to the member. It works once and expires in 24 hours.`}
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border-0 bg-light-50 px-3 py-2 font-mono text-xs text-neutral-900 ring-1 ring-inset ring-light-600 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-500"
          />
          <div className="mt-2 flex justify-end space-x-2">
            <Button onClick={() => closeModal()} variant="secondary">
              {t`Close`}
            </Button>
            <Button onClick={copy}>{copied ? t`Copied` : t`Copy link`}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-light-900 dark:text-dark-900">
            {t`Whoever opens the link can set a new password for this account. Only send it to the member.`}
          </p>
          {createLink.error && (
            <p className="text-xs text-red-400">{createLink.error.message}</p>
          )}
          <div className="mt-2 flex justify-end space-x-2">
            <Button onClick={() => closeModal()} variant="secondary">
              {t`Cancel`}
            </Button>
            <Button
              isLoading={createLink.isPending}
              onClick={() => {
                if (entityId)
                  createLink.mutate({
                    workspacePublicId: workspace.publicId,
                    memberPublicId: entityId,
                  });
              }}
            >
              {t`Create link`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
