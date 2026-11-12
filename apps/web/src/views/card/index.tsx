import Link from "next/link";
import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  HiBars3BottomLeft,
  HiOutlineChatBubbleBottomCenterText,
  HiOutlineCheckCircle,
  HiXMark,
} from "react-icons/hi2";

import { authClient } from "@kan/auth/client";

import Avatar from "~/components/Avatar";
import Editor from "~/components/Editor";
import FeedbackModal from "~/components/FeedbackModal";
import { LabelForm } from "~/components/LabelForm";
import LabelIcon from "~/components/LabelIcon";
import Modal from "~/components/modal";
import { NewWorkspaceForm } from "~/components/NewWorkspaceForm";
import { PageHead } from "~/components/PageHead";
import { EditYouTubeModal } from "~/components/YouTubeEmbed/EditYouTubeModal";
import {
  setActivitySortOrder,
  useActivitySortOrder,
} from "~/hooks/useActivitySortOrder";
import { usePermissions } from "~/hooks/usePermissions";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import { getBoardReturnUrl } from "~/utils/board-return-url";
import { invalidateCard } from "~/utils/cardInvalidation";
import { formatMemberDisplayName, getAvatarUrl } from "~/utils/helpers";
import { DeleteLabelConfirmation } from "../../components/DeleteLabelConfirmation";
import { getDueDateRequiredListIds } from "../board/utils/listStatus";
import ActivityList from "./components/ActivityList";
import { ActivitySortOrderToggle } from "./components/ActivitySortOrderToggle";
import { AttachmentThumbnails } from "./components/AttachmentThumbnails";
import { AttachmentUpload } from "./components/AttachmentUpload";
import Checklists from "./components/Checklists";
import { DeleteCardConfirmation } from "./components/DeleteCardConfirmation";
import { DeleteChecklistConfirmation } from "./components/DeleteChecklistConfirmation";
import { DeleteCommentConfirmation } from "./components/DeleteCommentConfirmation";
import Dropdown from "./components/Dropdown";
import { DueDateSelector } from "./components/DueDateSelector";
import { PrioritySelector } from "./components/PrioritySelector";
import { AreaSelector } from "./components/AreaSelector";
import LabelSelector from "./components/LabelSelector";
import ListSelector from "./components/ListSelector";
import MemberSelector from "./components/MemberSelector";
import { NewChecklistForm } from "./components/NewChecklistForm";
import NewCommentForm from "./components/NewCommentForm";

const ACTION_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded-[5px] border border-light-300 px-2.5 py-1.5 text-sm font-medium text-light-900 hover:bg-light-200 dark:border-dark-300 dark:text-dark-900 dark:hover:bg-dark-200";

interface FormValues {
  cardId: string;
  title: string;
  description: string;
}

export function CardFields({ isTemplate }: { isTemplate?: boolean }) {
  const router = useRouter();
  const { canEditCard } = usePermissions();
  const { data: session } = authClient.useSession();
  const cardId = Array.isArray(router.query.cardId)
    ? router.query.cardId[0]
    : router.query.cardId;

  const { data: card } = api.card.byId.useQuery(
    { cardPublicId: cardId ?? "" },
    { enabled: !!cardId && cardId.length >= 12 },
  );

  const isCreator = card?.createdBy && session?.user.id === card.createdBy;
  const canEdit = canEditCard || isCreator;

  const board = card?.list.board;
  const labels = board?.labels;
  const workspaceMembers = board?.workspace.members;
  const selectedLabels = card?.labels;
  const selectedMembers = card?.members;

  const formattedLabels =
    labels?.map((label) => {
      const isSelected = selectedLabels?.some(
        (selectedLabel) => selectedLabel.publicId === label.publicId,
      );

      return {
        key: label.publicId,
        value: label.name,
        selected: isSelected ?? false,
        leftIcon: <LabelIcon colourCode={label.colourCode} />,
      };
    }) ?? [];

  const formattedMembers =
    workspaceMembers?.map((member) => {
      const isSelected = selectedMembers?.some(
        (assignedMember) => assignedMember.publicId === member.publicId,
      );

      return {
        key: member.publicId,
        value: formatMemberDisplayName(
          member.user?.name ?? null,
          member.user?.email ?? member.email,
        ),
        imageUrl: member.user?.image
          ? getAvatarUrl(member.user.image)
          : undefined,
        selected: isSelected ?? false,
        leftIcon: (
          <Avatar
            size="xs"
            name={member.user?.name ?? ""}
            imageUrl={
              member.user?.image ? getAvatarUrl(member.user.image) : undefined
            }
            email={member.user?.email ?? member.email}
          />
        ),
      };
    }) ?? [];

  const dueDateRequired =
    !isTemplate &&
    !!card &&
    getDueDateRequiredListIds(board?.lists ?? []).has(card.list.publicId);

  const field = (label: string, control: React.ReactNode) => (
    <div className="flex min-w-[150px] flex-col gap-1">
      <span className="text-xs font-semibold text-light-800 dark:text-dark-800">
        {label}
      </span>
      <div className="flex min-h-[30px] items-center">{control}</div>
    </div>
  );

  // Rendered inside the card body, Trello-style: each field is a small
  // heading over its value, wrapping across the column.
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4 text-light-900 dark:text-dark-900">
      {field(
        t`Priority`,
        <PrioritySelector
          cardPublicId={cardId ?? ""}
          priority={card?.priority}
          isLoading={!card}
          disabled={!canEdit}
        />,
      )}
      {field(
        t`Responsible area`,
        <AreaSelector
          cardPublicId={cardId ?? ""}
          area={card?.area}
          isLoading={!card}
          disabled={!canEdit}
        />,
      )}
      {!isTemplate &&
        field(
          t`Responsible`,
          <MemberSelector
            cardPublicId={cardId ?? ""}
            members={formattedMembers}
            isLoading={!card}
            disabled={!canEdit}
          />,
        )}
      {field(
        t`Labels`,
        <LabelSelector
          cardPublicId={cardId ?? ""}
          labels={formattedLabels}
          isLoading={!card}
          disabled={!canEdit}
        />,
      )}
      {field(
        t`Due date`,
        <DueDateSelector
          cardPublicId={cardId ?? ""}
          dueDate={card?.dueDate}
          isLoading={!card}
          disabled={!canEdit}
          required={dueDateRequired}
        />,
      )}
    </div>
  );
}

// List switcher shown as a chip in the card header.
function CardListChip({
  cardPublicId,
  lists,
  disabled,
}: {
  cardPublicId: string;
  lists: { key: string; value: string; selected: boolean }[];
  disabled: boolean;
}) {
  return (
    <div className="rounded-[5px] bg-light-200 text-xs font-semibold dark:bg-dark-200 [&>*]:!border-transparent">
      <ListSelector
        cardPublicId={cardPublicId}
        lists={lists}
        isLoading={false}
        disabled={disabled}
        showChevron
      />
    </div>
  );
}

export default function CardPage({ isTemplate }: { isTemplate?: boolean }) {
  const router = useRouter();
  const activitySortOrder = useActivitySortOrder();
  const utils = api.useUtils();
  const {
    openModal,
    modalContentType,
    entityId,
    getModalState,
    clearModalState,
    isOpen,
    modalStates,
  } = useModal();
  const { showPopup } = usePopup();
  const { workspace, selectWorkspaceById } = useWorkspace();
  const { canEditCard } = usePermissions();
  const { data: session } = authClient.useSession();
  const [activeChecklistForm, setActiveChecklistForm] = useState<string | null>(
    null,
  );
  const [recentCommentPublicIds, setRecentCommentPublicIds] = useState<
    string[]
  >([]);

  const cardId = Array.isArray(router.query.cardId)
    ? router.query.cardId[0]
    : router.query.cardId;

  useEffect(() => {
    setRecentCommentPublicIds([]);
  }, [cardId]);

  const {
    data: card,
    isLoading,
    error,
  } = api.card.byId.useQuery(
    { cardPublicId: cardId ?? "" },
    { enabled: !!cardId && cardId.length >= 12 },
  );

  // Redirect to 404 if card doesn't exist
  useEffect(() => {
    if (router.isReady && cardId && !isLoading) {
      if (error?.data?.code === "NOT_FOUND" || (!card && !isLoading)) {
        router.replace("/404");
      }
    }
  }, [router, cardId, isLoading, error, card]);

  const cardWorkspacePublicId = card?.list.board.workspace.publicId;
  useEffect(() => {
    if (cardWorkspacePublicId) selectWorkspaceById(cardWorkspacePublicId);
  }, [cardWorkspacePublicId, selectWorkspaceById]);

  const isCreator = card?.createdBy && session?.user.id === card.createdBy;
  const canEdit = canEditCard || isCreator;

  const refetchCard = async () => {
    if (cardId) await utils.card.byId.refetch({ cardPublicId: cardId });
  };

  const board = card?.list.board;
  const workspaceMembers = board?.workspace.members;
  const boardId = board?.publicId;
  const boardReturnUrl = getBoardReturnUrl(
    router.query.returnUrl,
    `/${isTemplate ? "templates" : "boards"}/${boardId}`,
  );

  const formattedLists =
    board?.lists.map((list) => ({
      key: list.publicId,
      value: list.name,
      selected: list.publicId === card?.list.publicId,
    })) ?? [];

  const editorWorkspaceMembers =
    workspaceMembers
      ?.filter((member) => member.email)
      .map((member) => ({
        publicId: member.publicId,
        email: member.email,
        user: member.user
          ? {
              id: member.user.id,
              name: member.user.name ?? null,
              image: member.user.image ?? null,
            }
          : null,
      })) ?? [];

  const updateCard = api.card.update.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to update card`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) await invalidateCard(utils, cardId);
    },
  });

  const addOrRemoveLabel = api.card.addOrRemoveLabel.useMutation({
    onError: () => {
      showPopup({
        header: t`Unable to add label`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      if (cardId) {
        await utils.card.byId.invalidate({ cardPublicId: cardId });
      }
    },
  });

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    values: {
      cardId: cardId ?? "",
      title: card?.title ?? "",
      description: card?.description ?? "",
    },
  });

  const onSubmit = (values: FormValues) => {
    updateCard.mutate({
      cardPublicId: values.cardId,
      title: values.title,
      description: values.description,
    });
  };

  const handleCommentCreated = (commentPublicId: string) => {
    setRecentCommentPublicIds((current) => [...current, commentPublicId]);
  };

  // this adds the new created label to selected labels
  useEffect(() => {
    const newLabelId = modalStates.NEW_LABEL_CREATED;
    if (newLabelId && cardId) {
      const isAlreadyAdded = card?.labels.some(
        (label) => label.publicId === newLabelId,
      );

      if (!isAlreadyAdded) {
        addOrRemoveLabel.mutate({
          cardPublicId: cardId,
          labelPublicId: newLabelId,
        });
      }
      clearModalState("NEW_LABEL_CREATED");
    }
  }, [modalStates.NEW_LABEL_CREATED, card, cardId]);

  // Open the new item form after creating a new checklist
  useEffect(() => {
    if (!card) return;
    const state = getModalState("ADD_CHECKLIST");
    const createdId: string | undefined = state?.createdChecklistId;
    if (createdId) {
      setActiveChecklistForm(createdId);
      clearModalState("ADD_CHECKLIST");
    }
  }, [card, getModalState, clearModalState]);

  // Auto-resize title textarea
  useEffect(() => {
    const titleTextarea = document.getElementById(
      "title",
    ) as HTMLTextAreaElement;
    if (titleTextarea) {
      titleTextarea.style.height = "auto";
      titleTextarea.style.height = `${titleTextarea.scrollHeight}px`;
    }
  }, [card]);

  if (!cardId) return <></>;

  return (
    <>
      <PageHead
        title={t`${card?.title ?? t`Card`} | ${board?.name ?? t`Board`}`}
      />
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Header: list chip and card number on the left, menu and close on the right */}
        <div className="flex w-full items-center justify-between gap-3 border-b-[1px] border-light-300 bg-light-50 px-4 py-2 dark:border-dark-300 dark:bg-dark-50 md:px-6">
          {!card && isLoading && (
            <div className="h-[1.5rem] w-[150px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
          )}
          {card && (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <CardListChip
                  cardPublicId={cardId}
                  lists={formattedLists}
                  disabled={!canEdit}
                />
                {card.cardNumber != null &&
                  card.list.board.workspace.cardPrefix && (
                    <span className="whitespace-nowrap font-mono text-xs text-light-700 dark:text-dark-800">
                      {card.list.board.workspace.cardPrefix}-{card.cardNumber}
                    </span>
                  )}
                <span className="hidden text-light-600 dark:text-dark-600 sm:inline">
                  ·
                </span>
                <Link
                  className="hidden truncate text-xs text-light-800 hover:underline dark:text-dark-800 sm:inline"
                  href={boardReturnUrl}
                >
                  {board?.name}
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <Dropdown
                  cardPublicId={cardId}
                  isTemplate={isTemplate}
                  boardPublicId={boardId}
                  cardCreatedBy={card?.createdBy}
                  ticketNumber={
                    card.cardNumber != null &&
                    card.list.board.workspace.cardPrefix
                      ? `${card.list.board.workspace.cardPrefix}-${card.cardNumber}`
                      : null
                  }
                  listPublicId={card?.list.publicId}
                  cardIndex={card?.index}
                />
                <Link
                  href={boardReturnUrl}
                  className="flex h-7 w-7 items-center justify-center rounded-[5px] text-light-900 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
                  aria-label={t`Close`}
                >
                  <HiXMark className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
          {!card && !isLoading && (
            <p className="block p-0 py-0 font-bold leading-[1.5rem] tracking-tight text-light-900 dark:text-dark-900 sm:text-[1rem]">
              {t`Card not found`}
            </p>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Main column: title, actions, fields, description, checklists, attachments */}
          <div className="list-scroll min-w-0 flex-1 px-4 py-6 md:px-8 lg:overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px]">
              {!card && isLoading && (
                <div className="h-[2.3rem] w-[300px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
              )}
              {!card && !isLoading && (
                <p className="font-bold text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
                  {t`Card not found`}
                </p>
              )}
              {card && (
                <>
                  <form onSubmit={handleSubmit(onSubmit)} className="w-full">
                    <textarea
                      id="title"
                      {...register("title")}
                      onBlur={canEdit ? handleSubmit(onSubmit) : undefined}
                      rows={1}
                      disabled={!canEdit}
                      aria-label={t`Card title`}
                      className={`block w-full resize-none overflow-hidden rounded-[5px] border-0 bg-transparent p-0 text-xl font-bold leading-snug text-neutral-900 focus:ring-0 dark:text-dark-1000 sm:text-2xl ${!canEdit ? "cursor-default" : ""}`}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                  </form>

                  <div className="mt-5">
                    <CardFields isTemplate={isTemplate} />
                  </div>

                  <section className="mt-8">
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-light-1000 dark:text-dark-1000">
                      <HiBars3BottomLeft
                        className="h-5 w-5 text-light-800 dark:text-dark-800"
                        aria-hidden="true"
                      />
                      {t`Description`}
                    </h2>
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="rounded-md border border-light-300 px-3 py-2 dark:border-dark-300"
                    >
                      <Editor
                        content={card.description}
                        onChange={
                          canEdit
                            ? (e) => setValue("description", e)
                            : undefined
                        }
                        onBlur={
                          canEdit ? () => handleSubmit(onSubmit)() : undefined
                        }
                        workspaceMembers={workspaceMembers ?? []}
                        readOnly={!canEdit}
                      />
                    </form>
                  </section>

                  {/* Checklist and attachment actions sit right after the description */}
                  {canEdit && (
                    <div className="mt-3">
                      {isTemplate ? (
                        <button
                          type="button"
                          onClick={() => openModal("ADD_CHECKLIST")}
                          aria-label={t`Add checklist`}
                          className={ACTION_BUTTON_CLASS}
                        >
                          <HiOutlineCheckCircle
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          {t`Checklist`}
                        </button>
                      ) : (
                        <AttachmentUpload cardPublicId={cardId} />
                      )}
                    </div>
                  )}

                  <div className="mt-6">
                    <Checklists
                      checklists={card.checklists}
                      cardPublicId={cardId}
                      activeChecklistForm={activeChecklistForm}
                      setActiveChecklistForm={setActiveChecklistForm}
                      viewOnly={!canEdit}
                    />
                  </div>

                  {!isTemplate && card.attachments.length > 0 && (
                    <div className="mt-6">
                      <AttachmentThumbnails
                        attachments={card.attachments}
                        cardPublicId={cardId}
                        isReadOnly={!canEdit}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Side column: comments and activity */}
          {card && (
            <div className="list-scroll w-full shrink-0 border-t border-light-300 bg-light-100 px-4 py-6 dark:border-dark-300 dark:bg-[#141416] md:px-6 lg:w-[400px] lg:overflow-y-auto lg:border-l lg:border-t-0">
              <header className="mb-4 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-light-1000 dark:text-dark-1000">
                  <HiOutlineChatBubbleBottomCenterText
                    className="h-5 w-5 text-light-800 dark:text-dark-800"
                    aria-hidden="true"
                  />
                  {t`Comments and activity`}
                </h2>
                <ActivitySortOrderToggle
                  order={activitySortOrder}
                  onChange={setActivitySortOrder}
                />
              </header>
              {!isTemplate && (
                <div className="mb-4">
                  <NewCommentForm
                    cardPublicId={cardId}
                    workspaceMembers={editorWorkspaceMembers}
                    onCommentCreated={handleCommentCreated}
                  />
                </div>
              )}
              <ActivityList
                cardPublicId={cardId}
                isLoading={!card}
                order={activitySortOrder}
                recentCommentPublicIds={recentCommentPublicIds}
              />
            </div>
          )}
        </div>
        <>
          <Modal
            modalSize="md"
            isVisible={isOpen && modalContentType === "NEW_FEEDBACK"}
          >
            <FeedbackModal />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "NEW_LABEL"}
          >
            <LabelForm boardPublicId={boardId ?? ""} refetch={refetchCard} />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "EDIT_LABEL"}
          >
            <LabelForm
              boardPublicId={boardId ?? ""}
              refetch={refetchCard}
              isEdit
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_LABEL"}
          >
            <DeleteLabelConfirmation
              refetch={refetchCard}
              labelPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_CARD"}
          >
            <DeleteCardConfirmation
              boardPublicId={boardId ?? ""}
              cardPublicId={cardId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_COMMENT"}
          >
            <DeleteCommentConfirmation
              cardPublicId={cardId}
              commentPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "NEW_WORKSPACE"}
          >
            <NewWorkspaceForm />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "ADD_CHECKLIST"}
          >
            <NewChecklistForm cardPublicId={cardId} />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "DELETE_CHECKLIST"}
          >
            <DeleteChecklistConfirmation
              cardPublicId={cardId}
              checklistPublicId={entityId}
            />
          </Modal>

          <Modal
            modalSize="sm"
            isVisible={isOpen && modalContentType === "EDIT_YOUTUBE"}
          >
            <EditYouTubeModal />
          </Modal>
        </>
      </div>
    </>
  );
}
