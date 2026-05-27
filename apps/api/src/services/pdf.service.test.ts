import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  lastDefinition: undefined as any,
}));

vi.mock("pdfmake", () => ({
  default: class {
    createPdfKitDocument(definition: any) {
      mockState.lastDefinition = definition;
      const document = new EventEmitter() as EventEmitter & { end: () => void };
      document.end = () => {
        document.emit("data", Buffer.from("pdf"));
        document.emit("end");
      };
      return document;
    }
  },
}));

vi.mock("../models/index.js", () => ({
  PdfExport: { findById: vi.fn() },
  Assignment: { findById: vi.fn() },
  AssessmentRevision: { findById: vi.fn() },
  Workspace: { findById: vi.fn() },
}));

vi.mock("./file.service.js", () => ({
  uploadPrivateFile: vi.fn().mockResolvedValue({ data: { key: "pdf-key" } }),
}));

import { AssessmentRevision, Assignment, PdfExport, Workspace } from "../models/index.js";
import { uploadPrivateFile } from "./file.service.js";
import { buildAndStorePdf } from "./pdf.service.js";

const assignment = {
  _id: "assignment-1",
  name: "Numbers Quiz",
  subject: "Math",
  grade: "Grade 4",
  timeLimit: 30,
  totalMarks: 1,
  questionGroups: [{ type: "Multiple Choice Questions", count: 1, marks: 1 }],
  difficultyPreference: "mixed",
  bloomsLevel: "Mixed",
  instructions: "",
};

const validRevision = {
  _id: "revision-1",
  sections: [
    {
      title: "AI Section",
      instruction: "Pick one.",
      questions: [
        {
          questionText: "For SHM, d²x/dt² = -ω²x in a mass‑spring system.",
          type: "Multiple Choice Questions",
          difficulty: "Easy",
          marks: 1,
          options: ["A sin ωt", "A cos ωt", "A e^{iωt}", "A ln ωt"],
          bloomsLevel: "Remember",
          answerKey: "A cos ωt",
          estimatedTime: "1 minute",
          confidenceScore: 1,
          generationRationale: "Checks parity.",
        },
      ],
    },
  ],
};

function leanResult(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function mockExport(variant: "student" | "teacher" = "student") {
  return {
    id: `export-${variant}`,
    assignmentId: "assignment-1",
    revisionId: "revision-1",
    workspaceId: "workspace-1",
    variant,
    template: "modern",
    status: "queued",
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe("pdf service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lastDefinition = undefined;
    vi.mocked(Assignment.findById).mockReturnValue(leanResult(assignment) as any);
    vi.mocked(AssessmentRevision.findById).mockReturnValue(leanResult(validRevision) as any);
    vi.mocked(Workspace.findById).mockReturnValue(leanResult({ _id: "workspace-1", name: "Veda School" }) as any);
  });

  it("builds and stores a student exam-style PDF", async () => {
    const artifact = mockExport("student");
    vi.mocked(PdfExport.findById).mockResolvedValue(artifact as any);

    await buildAndStorePdf("export-student");

    expect(artifact.status).toBe("completed");
    expect(artifact.fileName).toBe("numbers-quiz-student.pdf");
    expect(uploadPrivateFile).toHaveBeenCalledOnce();
    expect(JSON.stringify(mockState.lastDefinition)).toContain("Section A - Multiple Choice Questions");
    expect(JSON.stringify(mockState.lastDefinition)).toContain("Name: ______________________________");
    expect(JSON.stringify(mockState.lastDefinition)).toContain("d^2x/dt^2 = -omega^2x in a mass-spring system");
    expect(JSON.stringify(mockState.lastDefinition)).not.toContain("End of Question Paper");
  });

  it("includes teacher answer metadata in the answer-key PDF", async () => {
    const artifact = mockExport("teacher");
    vi.mocked(PdfExport.findById).mockResolvedValue(artifact as any);

    await buildAndStorePdf("export-teacher");

    const definition = JSON.stringify(mockState.lastDefinition);
    expect(definition).toContain("Answer Key");
    expect(definition).toContain("Answer: A cos omegat");
    expect(definition).toContain("Bloom: Remember | Easy | Confidence: 100%");
  });

  it("marks the export failed when revision data violates the assignment", async () => {
    const artifact = mockExport("student");
    vi.mocked(PdfExport.findById).mockResolvedValue(artifact as any);
    vi.mocked(AssessmentRevision.findById).mockReturnValue(
      leanResult({
        ...validRevision,
        sections: [
          {
            ...validRevision.sections[0],
            questions: [{ ...validRevision.sections[0].questions[0], options: ["3"] }],
          },
        ],
      }) as any,
    );

    await expect(buildAndStorePdf("export-student")).rejects.toThrow(/exactly four/);

    expect(artifact.status).toBe("failed");
    expect(artifact.error).toMatch(/exactly four/);
    expect(uploadPrivateFile).not.toHaveBeenCalled();
  });
});
