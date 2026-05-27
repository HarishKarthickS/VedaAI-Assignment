import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("./config/redis.js", () => ({
  redis: { ping: vi.fn().mockResolvedValue("PONG") },
  createRedisConnection: vi.fn(),
  bullConnection: { host: "localhost", port: 6379 },
}));

vi.mock("./queues/index.js", () => ({
  generationQueue: { add: vi.fn() },
  extractionQueue: { add: vi.fn() },
  pdfQueue: { add: vi.fn() },
}));

vi.mock("uploadthing/express", async () => {
  const actual = await vi.importActual<typeof import("uploadthing/express")>("uploadthing/express");
  return {
    ...actual,
    createRouteHandler: () => (_request: unknown, _response: unknown, next: () => void) => next(),
  };
});

import { createApp } from "./app.js";

describe("API entry points", () => {
  it("reports basic service health without authentication", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
  });

  it("protects assessment history without a teacher session", async () => {
    const response = await request(createApp()).get("/api/assignments");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Please sign in.");
  });
});
