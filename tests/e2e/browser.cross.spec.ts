import { chromium, firefox, type BrowserType } from "playwright";
import { afterEach, describe, expect, it } from "vitest";

import { createTestAppServer, type TestAppServer } from "./helpers/testAppServer.js";

type SupportedBrowser = "chromium" | "firefox";

async function runBrowserFlow(browserType: BrowserType, appUrl: string): Promise<void> {
  const browser = await browserType.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.getByTestId("item-input").fill("from-e2e");
    await page.getByTestId("add-btn").click();

    await page.waitForSelector("[data-testid='item']");
    const addedText = await page.textContent("[data-testid='item']");
    expect(addedText).toBe("from-e2e");

    const screenshot = await page.screenshot({ fullPage: true, type: "png" });
    expect(screenshot.byteLength).toBeGreaterThan(2_048);

    const domSnapshot = await page.evaluate(() => {
      return {
        title: document.title,
        buttonCount: document.querySelectorAll("button").length,
        listItems: Array.from(document.querySelectorAll("[data-testid='item']")).map((node) =>
          node.textContent?.trim(),
        ),
      };
    });

    expect(domSnapshot.title).toContain("E2E Harness App");
    expect(domSnapshot.buttonCount).toBe(1);
    expect(domSnapshot.listItems).toContain("from-e2e");

    const accessibility = await page.accessibility.snapshot();
    expect(accessibility).toBeTruthy();
  } finally {
    await browser.close();
  }
}

describe("real-browser e2e", () => {
  let appServer: TestAppServer | null = null;

  afterEach(async () => {
    if (appServer) {
      await appServer.close();
      appServer = null;
    }
  });

  for (const browserName of ["chromium", "firefox"] as const satisfies SupportedBrowser[]) {
    it(`interacts with the page and captures artifacts in ${browserName}`, async () => {
      appServer = await createTestAppServer();

      const browserType = browserName === "chromium" ? chromium : firefox;
      await runBrowserFlow(browserType, appServer.baseUrl);
    });
  }
});
