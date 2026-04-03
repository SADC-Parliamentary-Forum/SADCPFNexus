/**
 * Global setup — logs in as admin and staff, saves auth state for reuse.
 * Runs once before the entire test suite.
 */
import { test as setup, expect, type Page, type APIRequestContext } from "@playwright/test";
import fs from "fs";
import path from "path";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const AUTH_DIR = path.join(process.cwd(), "playwright/.auth");

async function loginAndSave(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
  fileName: string
) {
  // Obtain token via API — faster than going through the UI every time
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `Login failed for ${email}: ${await res.text()}`).toBeTruthy();

  const { token, user } = await res.json();

  // Navigate to origin so we can set localStorage
  await page.goto("/");

  // Inject auth into localStorage and set the middleware cookie
  await page.evaluate(
    ({ token, user }: { token: string; user: object }) => {
      localStorage.setItem("sadcpf_token", token);
      localStorage.setItem("sadcpf_user", JSON.stringify(user));
    },
    { token, user }
  );

  await page.context().addCookies([
    {
      name: "sadcpf_authenticated",
      value: "1",
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
  ]);

  // Verify we can access a protected page
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  // Save storage state (cookies + localStorage)
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: path.join(AUTH_DIR, fileName) });
}

setup("authenticate as admin", async ({ page, request }) => {
  await loginAndSave(
    page,
    request,
    "admin@sadcpf.org",
    "Admin@2024!",
    "admin.json"
  );
});

setup("authenticate as staff", async ({ page, request }) => {
  await loginAndSave(
    page,
    request,
    "staff@sadcpf.org",
    "Staff@2024!",
    "staff.json"
  );
});
