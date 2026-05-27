import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../queues/index.js", () => ({
  generationQueue: { add: vi.fn() },
  extractionQueue: { add: vi.fn() },
  pdfQueue: { add: vi.fn() },
}));

import { AssessmentRevision, Assignment, GenerationRun } from "../models/index.js";
import { getAssignment } from "./assignment.service.js";

describe("assignment service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("includes the latest generation run summary with assignment details", async () => {
    vi.spyOn(Assignment, "findOne").mockResolvedValue({
      _id: "assignment-1",
      workspaceId: "workspace-1",
      currentRevisionId: "revision-1",
    } as any);
    vi.spyOn(AssessmentRevision, "findById").mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "revision-1", version: 1, sections: [] }),
    } as any);
    vi.spyOn(GenerationRun, "findOne").mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => "run-1" },
        status: "failed",
        progress: 100,
        message: "Generation failed after multiple attempts.",
        error: "Generation failed after multiple attempts.",
        action: "initial",
        updatedAt: new Date("2026-05-27T10:00:00.000Z"),
      }),
    } as any);

    const detail = await getAssignment("assignment-1", {
      userId: "user-1",
      workspaceId: "workspace-1",
      role: "TEACHER",
    });

    expect(detail.latestRun).toMatchObject({
      runId: "run-1",
      status: "failed",
      progress: 100,
      action: "initial",
    });
  });
});
