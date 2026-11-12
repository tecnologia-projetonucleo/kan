import type { BoardCard } from "../types";
import type { ListTone } from "../utils/listStatus";
import Card from "./Card";

interface CardPreviewProps {
  card: BoardCard;
  cardPrefix: string;
  listTone?: ListTone;
  requireAssignee?: boolean;
  requireDueDate?: boolean;
}

export default function CardPreview({
  card,
  cardPrefix,
  listTone,
  requireAssignee,
  requireDueDate,
}: CardPreviewProps) {
  return (
    <Card
      title={card.title}
      ticketNumber={
        card.cardNumber != null ? `${cardPrefix}-${card.cardNumber}` : null
      }
      labels={card.labels}
      members={card.members}
      checklists={card.checklists ?? []}
      description={card.description ?? null}
      comments={card.comments ?? []}
      commentCount={card.commentCount}
      attachments={card.attachments}
      dueDate={card.dueDate ?? null}
      createdAt={card.createdAt}
      listEnteredAt={card.listEnteredAt}
      listTone={listTone}
      priority={card.priority}
      area={card.area}
      requireAssignee={requireAssignee}
      requireDueDate={requireDueDate}
    />
  );
}
