import { expect, type Locator } from "@playwright/test";

/** Choose a staff member from the searchable Assigned-to combobox. */
export async function selectAssetAssignee(
  root: Locator,
  search: string,
  optionName: RegExp,
): Promise<void> {
  const input = root.getByTestId("asset-assignee-picker");
  await expect(input).toBeVisible();
  const listed = root.page().waitForResponse(
    (r) => r.url().includes("/tenant-users") && r.request().method() === "GET" && r.ok(),
    { timeout: 15_000 },
  );
  await input.click();
  await input.fill(search);
  await listed;
  const option = root.getByRole("option", { name: optionName }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
}
