import { expect, test } from "@playwright/test";

test("login provides an accessible entry point", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
});

test("assignment creator follows the responsive application shell", async ({ page }, testInfo) => {
  await page.context().addCookies([{ name: "veda_access", value: "visual-review", url: "http://localhost:3000" }]);
  await page.goto("/assignments/new");
  await expect(page.getByRole("heading", { name: "Create Assignment" })).toBeVisible();
  await expect(page.getByText("Assignment Details")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("assignment-creator.png"), fullPage: true });
});
