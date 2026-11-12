import { describe, expect, it } from "vitest";

import { listRequiresDueDate } from "./dueDateRule";

const board = [
  { id: 1, name: "Backlog", index: 0 },
  { id: 2, name: "Priorizada", index: 1 },
  { id: 3, name: "Em Andamento", index: 2 },
  { id: 4, name: "Bloqueado", index: 3 },
  { id: 5, name: "Concluído", index: 4 },
];

describe("listRequiresDueDate", () => {
  it("does not require a date before the in-progress list", () => {
    expect(listRequiresDueDate(board, 1)).toBe(false);
    expect(listRequiresDueDate(board, 2)).toBe(false);
  });

  it("requires a date in the in-progress list and every list after it", () => {
    expect(listRequiresDueDate(board, 3)).toBe(true);
    expect(listRequiresDueDate(board, 4)).toBe(true);
    expect(listRequiresDueDate(board, 5)).toBe(true);
  });

  it("follows list positions, not array order", () => {
    expect(listRequiresDueDate([...board].reverse(), 2)).toBe(false);
    expect(listRequiresDueDate([...board].reverse(), 4)).toBe(true);
  });

  it("never requires a date on boards without an in-progress list", () => {
    expect(
      listRequiresDueDate(
        [
          { id: 1, name: "To do", index: 0 },
          { id: 2, name: "Done", index: 1 },
        ],
        2,
      ),
    ).toBe(false);
  });
});
