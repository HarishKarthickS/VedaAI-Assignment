import { describe, expect, it } from "vitest";
import { calculateBackoffDelay, isRetryableProviderStatus, retryAfterToMs } from "./ai.service.js";

describe("AI provider retry helpers", () => {
  it("classifies transient provider statuses as retryable", () => {
    expect(isRetryableProviderStatus(408)).toBe(true);
    expect(isRetryableProviderStatus(409)).toBe(true);
    expect(isRetryableProviderStatus(425)).toBe(true);
    expect(isRetryableProviderStatus(429)).toBe(true);
    expect(isRetryableProviderStatus(500)).toBe(true);
    expect(isRetryableProviderStatus(503)).toBe(true);
    expect(isRetryableProviderStatus(400)).toBe(false);
    expect(isRetryableProviderStatus(422)).toBe(false);
  });

  it("caps exponential backoff and honors retry-after", () => {
    expect(calculateBackoffDelay(1, undefined, 0)).toBe(1000);
    expect(calculateBackoffDelay(3, undefined, 0)).toBe(4000);
    expect(calculateBackoffDelay(8, undefined, 1)).toBe(8000);
    expect(calculateBackoffDelay(1, 12_000, 0)).toBe(8000);
  });

  it("parses retry-after seconds and ignores invalid values", () => {
    expect(retryAfterToMs("3")).toBe(3000);
    expect(retryAfterToMs("not-a-date")).toBeUndefined();
  });
});
