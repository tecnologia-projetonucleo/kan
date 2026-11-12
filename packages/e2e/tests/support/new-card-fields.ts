import type { Page } from "@playwright/test";

// The new card form requires a responsible area and someone responsible.
// Pick the first area and the first workspace member (the test user).
export async function fillRequiredCardFields(page: Page) {
  await page
    .getByRole("button", { name: "Responsible area", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Produto" })
    .filter({ visible: true })
    .click();
  await page.getByPlaceholder("Card title").click();

  const responsible = page.getByRole("button", {
    name: "Responsible",
    exact: true,
  });
  // Template boards have no responsible field.
  if ((await responsible.count()) === 0) return;
  await responsible.click();
  await page.getByRole("checkbox").filter({ visible: true }).first().click();
  await page.getByPlaceholder("Card title").click();
}
