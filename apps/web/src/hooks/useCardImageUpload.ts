import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";
import { useCallback } from "react";

import { usePopup } from "~/providers/popup";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Uploads an image pasted or dropped into a card editor as a card
 * attachment and returns the stable address the editor stores
 * (/api/attachments/<id>, which redirects to a fresh signed URL). It does
 * not refetch the card: that would reset an editor with unsaved text.
 */
export function useCardImageUpload(cardPublicId: string | undefined) {
  const { showPopup } = usePopup();

  return useCallback(
    async (file: File): Promise<string | null> => {
      if (!cardPublicId) return null;

      if (file.size > MAX_IMAGE_BYTES) {
        showPopup({
          header: t`Image too large`,
          message: t`Images can have up to 20 MB.`,
          icon: "error",
        });
        return null;
      }

      const extension = file.type.split("/")[1] ?? "png";
      const name =
        file.name && file.name !== "image.png"
          ? file.name
          : `imagem-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;

      try {
        const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
        const response = await fetch(
          `${baseUrl}/api/upload/attachment?cardPublicId=${encodeURIComponent(cardPublicId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": file.type,
              "x-original-filename": encodeURIComponent(name),
            },
            body: file,
          },
        );
        if (!response.ok) throw new Error("Upload failed");

        const { attachment } = (await response.json()) as {
          attachment: { publicId: string };
        };
        // Relative, so stored HTML keeps working if the domain changes.
        return `/api/attachments/${attachment.publicId}`;
      } catch {
        showPopup({
          header: t`Upload failed`,
          message: t`Could not upload the image. Please try again.`,
          icon: "error",
        });
        return null;
      }
    },
    [cardPublicId, showPopup],
  );
}
