/**
 * Global setup: warm up the Vercel deployment and create a saved auth session.
 * All tests load this session instead of logging in individually, avoiding
 * repeated cold-start timeouts on Vercel serverless functions.
 */
import { chromium, type FullConfig } from "@playwright/test";

const BASE = "https://invotrust.vercel.app";
const EMAIL = "levid865@gmail.com";
const PASSWORD = "Blessedao,";

export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("[setup] Loading login page (cold start may take 30-60s)...");
  await page.goto(`${BASE}/login`, { timeout: 90_000, waitUntil: "domcontentloaded" });
  console.log("[setup] Login page loaded. Waiting for hydration...");
  await page.waitForTimeout(4000);
  console.log("[setup] Authenticating...");

  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("button[type=submit]").click({ noWaitAfter: true });

  await page.waitForURL(/\/app\/dashboard/, { timeout: 60_000, waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");
  console.log("[setup] Authenticated. Dashboard loaded.");

  // Save the authenticated session (cookies + localStorage)
  await context.storageState({ path: "e2e/.auth.json" });
  console.log("[setup] Auth session saved to e2e/.auth.json");

  await browser.close();
}
