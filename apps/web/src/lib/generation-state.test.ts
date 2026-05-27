import { describe, expect, it } from "vitest";
import { generationDisplayState, isActiveGeneration } from "./generation-state";

describe("generation display state", () => {
  it("treats queued and processing states as active", () => {
    expect(isActiveGeneration("queued")).toBe(true);
    expect(isActiveGeneration("generating")).toBe(true);
    expect(isActiveGeneration("completed")).toBe(false);
  });

  it("uses latest run progress and message while generating", () => {
    const state = generationDisplayState({
      assignmentStatus: "queued",
      generated: false,
      latestRun: {
        runId: "run-1",
        status: "generating",
        progress: 45,
        message: "Generating balanced question sections",
      },
    });

    expect(state.active).toBe(true);
    expect(state.progress).toBe(45);
    expect(state.message).toBe("Generating balanced question sections");
  });

  it("keeps completed papers visible after success and exposes user-safe failures", () => {
    expect(generationDisplayState({ assignmentStatus: "completed", generated: true }).complete).toBe(true);
    expect(
      generationDisplayState({
        generated: false,
        latestRun: {
          runId: "run-2",
          status: "failed",
          progress: 100,
          message: "Generation failed",
          error: "Generation failed after multiple attempts.",
        },
      }).userError,
    ).toBe("Generation failed after multiple attempts.");
  });
});
