import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { format } from "date-fns";
import { env } from "next-runtime-env";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { HiOutlinePaperClip } from "react-icons/hi";
import {
  HiBars3BottomLeft,
  HiChevronDown,
  HiOutlineBarsArrowDown,
  HiOutlineBarsArrowUp,
  HiXMark,
} from "react-icons/hi2";

import type { NewCardInput } from "@kan/api/types";
import { generateUID } from "@kan/shared/utils";

import type { CardArea } from "~/components/CardArea";
import type { CardPriority } from "~/components/CardPriority";
import type { WorkspaceMember } from "~/components/Editor";
import Avatar from "~/components/Avatar";
import Button from "~/components/Button";
import { AreaDot, CARD_AREAS, getArea } from "~/components/CardArea";
import { PriorityPicker } from "~/components/CardPriority";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import DateSelector from "~/components/DateSelector";
import Editor from "~/components/Editor";
import LabelIcon from "~/components/LabelIcon";
import Toggle from "~/components/Toggle";
import { useModalFormState } from "~/hooks/useModalFormState";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import { formatMemberDisplayName, getAvatarUrl } from "~/utils/helpers";
import {
  getDueDateRequiredListIds,
  isDueDateRequiredError,
} from "../utils/listStatus";

type NewCardFormInput = Omit<NewCardInput, "area" | "priority"> & {
  isCreateAnotherEnabled: boolean;
  dueDate?: Date | null;
  priority: CardPriority;
  area: CardArea | null;
};

interface QueryParams {
  boardPublicId: string;
  members: string[];
  labels: string[];
  lists: string[];
}

interface NewCardFormProps {
  isTemplate: boolean;
  boardPublicId: string;
  listPublicId: string;
  queryParams: QueryParams;
  initialDueDate?: Date | null;
}

export function NewCardForm({
  isTemplate,
  boardPublicId,
  listPublicId,
  queryParams,
  initialDueDate = null,
}: NewCardFormProps) {
  const { showPopup } = usePopup();
  const { workspace } = useWorkspace();
  const { closeModal, openModal, modalStates, clearModalState } = useModal();

  const utils = api.useUtils();

  // persists the form values
  const { formState, saveFormState } = useModalFormState<NewCardFormInput>({
    modalType: "NEW_CARD",
    initialValues: {
      title: "",
      description: "",
      listPublicId,
      labelPublicIds: [],
      memberPublicIds: [],
      isCreateAnotherEnabled: false,
      position: "start",
      dueDate: initialDueDate,
      priority: "normal",
      area: null,
    },
    resetOnClose: true,
  });

  const { register, handleSubmit, reset, setValue, watch } =
    useForm<NewCardFormInput>({
      values: formState,
    });

  const labelPublicIds = watch("labelPublicIds") || [];
  const memberPublicIds = watch("memberPublicIds") || [];
  const isCreateAnotherEnabled = watch("isCreateAnotherEnabled");
  const position = watch("position");
  const title = watch("title");
  const description = watch("description");
  const dueDate = watch("dueDate");
  const priority = watch("priority") ?? "normal";
  const area = watch("area") ?? null;
  const selectedArea = getArea(area);
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false);

  // Files queued for upload after the card is created. Kept outside of
  // useModalFormState: File objects do not survive serialization.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // saving form state whenever form values change
  useEffect(() => {
    const subscription = watch((data) => {
      saveFormState(data as NewCardFormInput);
    });
    return () => subscription.unsubscribe();
  }, [watch, saveFormState]);

  const { data: boardData } = api.board.byId.useQuery(queryParams, {
    enabled: !!boardPublicId,
  });

  // this adds the new created label to selected labels
  useEffect(() => {
    const newLabelId = modalStates.NEW_LABEL_CREATED;
    if (newLabelId !== undefined && !labelPublicIds.includes(newLabelId)) {
      setValue("labelPublicIds", [...labelPublicIds, newLabelId]);
    }
  }, [modalStates, labelPublicIds]);

  // this removes the deleted label from selected labels if it is selected
  useEffect(() => {
    if (boardData?.labels) {
      const availableLabelIds = boardData.labels.map((label) => label.publicId);
      const newLabelId = modalStates.NEW_LABEL_CREATED;

      if (newLabelId && availableLabelIds.includes(newLabelId)) {
        clearModalState("NEW_LABEL_CREATED");
      }

      const validLabelIds = labelPublicIds.filter(
        (id) => availableLabelIds.includes(id) || id === newLabelId,
      );

      if (validLabelIds.length !== labelPublicIds.length) {
        setValue("labelPublicIds", validLabelIds);
      }
    }
  }, [boardData?.labels, labelPublicIds, modalStates.NEW_LABEL_CREATED]);

  const createCard = api.card.create.useMutation({
    onMutate: async (args) => {
      await utils.board.byId.cancel();

      const currentState = utils.board.byId.getData(queryParams);

      utils.board.byId.setData(queryParams, (oldBoard) => {
        if (!oldBoard) return oldBoard;

        const updatedLists = oldBoard.lists.map((list) => {
          if (list.publicId === listPublicId) {
            const newCard = {
              publicId: `PLACEHOLDER_${generateUID()}`,
              title: args.title,
              listId: 2,
              description: "",
              dueDate: args.dueDate ?? null,
              priority: args.priority ?? "normal",
              area: args.area ?? null,
              cardNumber: null,
              comments: [],
              commentCount: 0,
              createdAt: new Date(),
              listEnteredAt: new Date(),
              checklists: [],
              attachments: [],
              labels: oldBoard.labels.filter((label) =>
                args.labelPublicIds.includes(label.publicId),
              ),
              members:
                oldBoard.workspace.members
                  .filter((member) =>
                    args.memberPublicIds.includes(member.publicId),
                  )
                  .map((member) => ({
                    ...member,
                    deletedAt: null,
                  })) ?? [],
              _filteredLabels: labelPublicIds.map((id) => ({ publicId: id })),
              _filteredMembers: memberPublicIds.map((id) => ({ publicId: id })),
              index: position === "start" ? 0 : list.cards.length,
            };

            const updatedCards =
              position === "start"
                ? [newCard, ...list.cards]
                : [...list.cards, newCard];
            return { ...list, cards: updatedCards };
          }
          return list;
        });

        return { ...oldBoard, lists: updatedLists };
      });

      return { previousState: currentState };
    },
    onError: (error, _newList, context) => {
      utils.board.byId.setData(queryParams, context?.previousState);
      if (isDueDateRequiredError(error)) {
        showPopup({
          header: t`Due date required`,
          message: t`Cards created in In Progress or any list after it need a due date.`,
          icon: "error",
        });
        return;
      }
      showPopup({
        header: t`Unable to create card`,
        message: error.data?.zodError?.fieldErrors.title?.[0]
          ? `${error.data.zodError.fieldErrors.title[0].replace("String", "Title")}`
          : t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSuccess: async () => {
      const isCreateAnotherEnabled = watch("isCreateAnotherEnabled");
      if (!isCreateAnotherEnabled) {
        // close modal (state will auto-clear due to resetOnClose: true)
        closeModal();
      } else {
        // reset form for creating another card
        const newFormState = {
          title: "",
          description: "",
          listPublicId: watch("listPublicId"),
          labelPublicIds: [],
          memberPublicIds: watch("memberPublicIds"),
          isCreateAnotherEnabled,
          position,
          dueDate: null,
          priority: "normal" as const,
          // Keep the area: cards created in a row usually share it.
          area: watch("area"),
        };
        reset(newFormState);
        saveFormState(newFormState);
      }
      await utils.board.byId.invalidate(queryParams);
    },
  });

  useEffect(() => {
    const titleElement: HTMLElement | null =
      document.querySelector<HTMLElement>("#title");
    if (titleElement) titleElement.focus();
  }, []);

  const formattedLabels =
    boardData?.labels.map((label) => ({
      key: label.publicId,
      value: label.name,
      leftIcon: <LabelIcon colourCode={label.colourCode} />,
      selected: labelPublicIds.includes(label.publicId),
    })) ?? [];

  const formattedLists =
    boardData?.lists.map((list) => ({
      key: list.publicId,
      value: list.name,
      selected: list.publicId === watch("listPublicId"),
    })) ?? [];

  const formattedMembers =
    boardData?.workspace.members.map((member) => ({
      key: member.publicId,
      value: formatMemberDisplayName(
        member.user?.name ?? null,
        member.user?.email ?? member.email,
      ),
      selected: memberPublicIds.includes(member.publicId),
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
    })) ?? [];

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (cardPublicId: string, files: File[]) => {
    const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
    let failedCount = 0;

    for (const file of files) {
      try {
        const response = await fetch(
          `${baseUrl}/api/upload/attachment?cardPublicId=${encodeURIComponent(cardPublicId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              "x-original-filename": encodeURIComponent(file.name),
            },
            body: file,
          },
        );
        if (!response.ok) failedCount++;
      } catch {
        failedCount++;
      }
    }

    return failedCount;
  };

  const onSubmit = async (data: NewCardFormInput) => {
    // Enter in the title submits too, so the required fields are checked here
    // and not only through the disabled button.
    if (
      !data.area ||
      (!isTemplate && data.memberPublicIds.length === 0) ||
      (dueDateRequired && !data.dueDate)
    )
      return;

    const filesToUpload = pendingFiles;
    setPendingFiles([]);

    let newCard;
    try {
      newCard = await createCard.mutateAsync({
        title: data.title,
        description: data.description,
        listPublicId: data.listPublicId,
        labelPublicIds: data.labelPublicIds,
        memberPublicIds: data.memberPublicIds,
        position: data.position,
        dueDate: data.dueDate ?? null,
        priority: data.priority ?? "normal",
        area: data.area ?? undefined,
      });
    } catch {
      // onError already surfaced the failure; keep the files queued for retry.
      setPendingFiles(filesToUpload);
      return;
    }

    if (filesToUpload.length > 0) {
      const failedCount = await uploadAttachments(
        newCard.publicId,
        filesToUpload,
      );
      if (failedCount > 0) {
        showPopup({
          header: t`Some attachments failed`,
          message: t`The card was created, but ${failedCount} of ${filesToUpload.length} attachments could not be uploaded.`,
          icon: "error",
        });
      }
      await utils.board.byId.invalidate(queryParams);
    }
  };

  const handleToggleCreateAnother = (): void => {
    setValue("isCreateAnotherEnabled", !isCreateAnotherEnabled);
  };

  const handleSelectList = (listPublicId: string): void => {
    setValue("listPublicId", listPublicId);
  };

  const handleSelectMembers = (memberPublicId: string): void => {
    const currentIndex = memberPublicIds.indexOf(memberPublicId);
    if (currentIndex === -1) {
      setValue("memberPublicIds", [...memberPublicIds, memberPublicId]);
    } else {
      const newMemberPublicIds = [...memberPublicIds];
      newMemberPublicIds.splice(currentIndex, 1);
      setValue("memberPublicIds", newMemberPublicIds);
    }
  };

  const handleSelectLabels = (labelPublicId: string): void => {
    const currentIndex = labelPublicIds.indexOf(labelPublicId);
    if (currentIndex === -1) {
      setValue("labelPublicIds", [...labelPublicIds, labelPublicId]);
    } else {
      const newLabelPublicIds = [...labelPublicIds];
      newLabelPublicIds.splice(currentIndex, 1);
      setValue("labelPublicIds", newLabelPublicIds);
    }
  };

  const selectedList = formattedLists.find((item) => item.selected);
  const dueDateRequired =
    !isTemplate &&
    getDueDateRequiredListIds(boardData?.lists ?? []).has(
      watch("listPublicId"),
    );

  const chipClass =
    "flex h-full min-h-[28px] w-full items-center gap-1.5 rounded-[5px] border-[1px] px-2 py-1 text-left text-xs";
  const chipFilled =
    "border-light-600 bg-light-200 text-light-800 hover:bg-light-300 dark:border-dark-600 dark:bg-dark-400 dark:text-dark-1000 dark:hover:bg-dark-500";
  const chipMissing =
    "border-dashed border-amber-500/70 text-amber-700 hover:bg-amber-500/10 dark:border-amber-400/60 dark:text-amber-300";

  const field = (label: string, required: boolean, control: ReactNode) => (
    <div className="flex flex-col gap-1">
      <span className="whitespace-nowrap text-xs font-semibold text-light-800 dark:text-dark-800">
        {label}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      <div className="w-fit">{control}</div>
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDraggingFiles(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingFiles(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault();
          setIsDraggingFiles(false);
          addFiles(Array.from(e.dataTransfer.files));
        }
      }}
      className={
        isDraggingFiles
          ? "rounded-lg ring-2 ring-inset ring-light-700 dark:ring-dark-700"
          : undefined
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {/* Header: list chip on the left, close on the right */}
      <div className="flex items-center justify-between gap-2 border-b border-light-300 px-5 py-3 dark:border-dark-300">
        <div className="flex items-center gap-2">
          <CheckboxDropdown
            items={formattedLists}
            handleSelect={(_groupKey, item) => handleSelectList(item.key)}
            ariaLabel={t`List`}
          >
            <div className="flex items-center gap-1 rounded-[5px] bg-light-200 px-2 py-1 text-xs font-semibold text-light-1000 hover:bg-light-300 dark:bg-dark-200 dark:text-dark-1000 dark:hover:bg-dark-300">
              {selectedList?.value}
              <HiChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </CheckboxDropdown>
          <h2 className="whitespace-nowrap text-xs font-normal text-light-700 dark:text-dark-800">
            {t`New card`}
          </h2>
        </div>
        <button
          type="button"
          aria-label={t`Close`}
          className="rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
          onClick={(e) => {
            closeModal();
            e.preventDefault();
          }}
        >
          <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
        </button>
      </div>

      {/* No inner scroll: it clipped the area, responsible and label menus. */}
      <div className="px-6 py-5">
        <input
          id="title"
          type="text"
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder={t`Card title`}
          {...register("title")}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await handleSubmit(onSubmit)();
            }
          }}
          className="block w-full rounded-[5px] border-0 bg-transparent px-0 py-1 text-xl font-bold text-neutral-900 placeholder:text-light-700 focus:ring-0 dark:text-dark-1000 dark:placeholder:text-dark-700"
        />

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
          {field(
            t`Priority`,
            false,
            <PriorityPicker
              value={priority}
              onChange={(next) => setValue("priority", next)}
            />,
          )}
          {field(
            t`Responsible area`,
            true,
            <CheckboxDropdown
              items={CARD_AREAS.map((option) => ({
                key: option.key,
                value: option.name,
                selected: option.key === area,
                leftIcon: <AreaDot colour={option.colour} />,
              }))}
              handleSelect={(_groupKey, item) =>
                setValue("area", item.key as CardArea)
              }
              ariaLabel={t`Responsible area`}
            >
              <div
                className={`${chipClass} ${selectedArea ? chipFilled : chipMissing}`}
              >
                {selectedArea ? (
                  <>
                    <AreaDot colour={selectedArea.colour} />
                    {selectedArea.name}
                  </>
                ) : (
                  t`Choose an area`
                )}
              </div>
            </CheckboxDropdown>,
          )}
          {!isTemplate &&
            field(
              t`Responsible`,
              true,
              <CheckboxDropdown
                items={formattedMembers}
                handleSelect={(_groupKey, item) =>
                  handleSelectMembers(item.key)
                }
                ariaLabel={t`Responsible`}
              >
                <div
                  className={`${chipClass} ${memberPublicIds.length ? chipFilled : chipMissing}`}
                >
                  {!memberPublicIds.length ? (
                    t`Choose who`
                  ) : (
                    <div className="flex -space-x-1 overflow-hidden">
                      {memberPublicIds.map((memberPublicId) => {
                        const member = formattedMembers.find(
                          (member) => member.key === memberPublicId,
                        );

                        return (
                          <span
                            key={member?.key}
                            title={member?.value}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 ring-1 ring-light-200 dark:ring-dark-500"
                          >
                            <span className="text-[8px] font-medium leading-none text-white">
                              {member?.value
                                .split(" ")
                                .map((namePart) =>
                                  namePart.charAt(0).toUpperCase(),
                                )
                                .join("")}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CheckboxDropdown>,
            )}
          {field(
            t`Labels`,
            false,
            <CheckboxDropdown
              items={formattedLabels}
              handleSelect={(_groupKey, item) => handleSelectLabels(item.key)}
              handleEdit={(labelPublicId) =>
                openModal("EDIT_LABEL", labelPublicId)
              }
              handleCreate={() => openModal("NEW_LABEL")}
              createNewItemLabel={t`Create new label`}
            >
              <div className={`${chipClass} ${chipFilled}`}>
                {!labelPublicIds.length ? (
                  t`Add`
                ) : (
                  <>
                    <div
                      className={
                        labelPublicIds.length > 1
                          ? "flex -space-x-[2px] overflow-hidden"
                          : "flex items-center"
                      }
                    >
                      {labelPublicIds.map((labelPublicId) => {
                        const label = boardData?.labels.find(
                          (label) => label.publicId === labelPublicId,
                        );

                        return (
                          <span key={labelPublicId} className="flex items-center">
                            <svg
                              fill={label?.colourCode ?? "#3730a3"}
                              className="h-2 w-2"
                              viewBox="0 0 6 6"
                              aria-hidden="true"
                            >
                              <circle cx={3} cy={3} r={3} />
                            </svg>
                            {labelPublicIds.length === 1 && (
                              <span className="ml-1">{label?.name}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    {labelPublicIds.length > 1 && (
                      <div className="ml-1">
                        <Trans>{`${labelPublicIds.length} labels`}</Trans>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CheckboxDropdown>,
          )}
          {field(
            t`Due date`,
            dueDateRequired,
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDateSelectorOpen(!isDateSelectorOpen)}
                className={`${chipClass} ${dueDate || !dueDateRequired ? chipFilled : chipMissing}`}
              >
                {dueDate ? (
                  <span>{format(dueDate, "MMM d, yyyy")}</span>
                ) : dueDateRequired ? (
                  t`Choose the date`
                ) : (
                  t`Add`
                )}
              </button>
              {isDateSelectorOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDateSelectorOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-full z-20 mt-2 rounded-md border border-light-200 bg-light-50 shadow-lg dark:border-dark-200 dark:bg-dark-100"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <DateSelector
                      selectedDate={dueDate ?? undefined}
                      onDateSelect={(date) => {
                        setValue("dueDate", date ?? null);
                        setIsDateSelectorOpen(false);
                      }}
                      weekStartsOn={workspace.weekStartDay}
                    />
                  </div>
                </>
              )}
            </div>,
          )}
        </div>

        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-light-1000 dark:text-dark-1000">
            <HiBars3BottomLeft
              className="h-5 w-5 text-light-800 dark:text-dark-800"
              aria-hidden="true"
            />
            {t`Description`}
          </h3>
          <div className="block max-h-80 min-h-40 w-full overflow-y-auto rounded-md border border-light-300 px-3 py-2 text-sm focus-within:border-light-600 dark:border-dark-300 dark:focus-within:border-dark-600 sm:leading-6">
            <Editor
              content={description}
              onChange={(value) => {
                setValue("description", value);
                saveFormState({ ...formState, description: value });
              }}
              workspaceMembers={
                boardData?.workspace.members.map(
                  (member): WorkspaceMember => ({
                    publicId: member.publicId,
                    email: member.email,
                    user: member.user
                      ? {
                          id: member.publicId,
                          name: member.user.name,
                          image: member.user.image ?? null,
                        }
                      : null,
                  }),
                ) ?? []
              }
              enableYouTubeEmbed={false}
            />
          </div>
        </section>

        {/* Attachments after the description, as on the card page */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-[5px] border border-light-300 px-2.5 py-1.5 text-sm font-medium text-light-900 hover:bg-light-200 dark:border-dark-300 dark:text-dark-900 dark:hover:bg-dark-200"
          >
            <HiOutlinePaperClip className="h-4 w-4" aria-hidden="true" />
            {t`Attachment`}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setValue("position", position === "start" ? "end" : "start");
            }}
            title={
              position === "start"
                ? t`Add to the top of the list`
                : t`Add to the bottom of the list`
            }
            className="flex items-center gap-1.5 rounded-[5px] border border-light-300 px-2.5 py-1.5 text-sm text-light-900 hover:bg-light-200 dark:border-dark-300 dark:text-dark-900 dark:hover:bg-dark-200"
          >
            {position === "start" ? (
              <HiOutlineBarsArrowUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <HiOutlineBarsArrowDown className="h-4 w-4" aria-hidden="true" />
            )}
            {position === "start" ? t`Top of list` : t`Bottom of list`}
          </button>
        </div>
        {pendingFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {pendingFiles.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="flex items-center gap-1 rounded-[5px] border-[1px] border-light-600 bg-light-200 px-2 py-1 text-xs text-light-800 dark:border-dark-600 dark:bg-dark-400 dark:text-dark-1000"
              >
                <HiOutlinePaperClip size={12} />
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={t`Remove file`}
                  className="rounded p-0.5 hover:bg-light-300 focus:outline-none dark:hover:bg-dark-500"
                >
                  <HiXMark size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end space-x-4 border-t border-light-600 px-5 py-4 dark:border-dark-600">
        <Toggle
          label={t`Create another`}
          isChecked={isCreateAnotherEnabled}
          onChange={handleToggleCreateAnother}
        />

        <div>
          <Button
            type="submit"
            disabled={
              title.length === 0 ||
              !area ||
              (!isTemplate && memberPublicIds.length === 0) ||
              (dueDateRequired && !dueDate) ||
              createCard.isPending
            }
          >
            {t`Create card`}
          </Button>
        </div>
      </div>
    </form>
  );
}
