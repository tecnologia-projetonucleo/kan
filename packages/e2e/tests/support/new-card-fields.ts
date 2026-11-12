import type { Page } from "@playwright/test";

// The new card form requires a responsible area and someone responsible.
// Pick the first area and the first workspace member (the test user).
// The dropdown triggers are labelled divs, not buttons, so they are found by
// aria-label like the other selector helpers.
export async function fillRequiredCardFields(page: Page) {
  await page
    .locator('[aria-label="Responsible area"]')
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("checkbox", { name: "Produto" })
    .filter({ visible: true })
    .click();
  // Any click outside the open menu closes it; the form body reports itself
  // as covering the title while the menu is open, so skip that check.
  await page.getByPlaceholder("Card title").click({ force: true });

  const responsible = page
    .locator('[aria-label="Responsible"]')
    .filter({ visible: true });
  // Template boards have no responsible field.
  if ((await responsible.count()) === 0) return;
  await responsible.first().click();
  await page.getByRole("checkbox").filter({ visible: true }).first().click();
  // Any click outside the open menu closes it; the form body reports itself
  // as covering the title while the menu is open, so skip that check.
  await page.getByPlaceholder("Card title").click({ force: true });
}
