import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 393, height: 857 } } },
  ],
  webServer: {
    command: "npm run start -w @veda/web -- -p 3000",
    url: "http://localhost:3000/auth/login",
    reuseExistingServer: true,
  },
});
