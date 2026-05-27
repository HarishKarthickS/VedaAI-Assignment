import { describe, expect, it } from "vitest";
import { createAssignmentSchema, generatedQuestionSchema, questionTotals, updateProfileSchema } from "./index.js";

describe("assignment contract", () => {
  it("calculates marks from question groups", () => {
    expect(
      questionTotals([{ type: "Short Questions", count: 4, marks: 2 }]),
    ).toEqual({ questions: 4, marks: 8 });
  });

  it("does not accept negative question counts", () => {
    const result = createAssignmentSchema.safeParse({
      name: "Electricity Quiz",
      subject: "Science",
      grade: "Grade 8",
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
      timeLimit: 45,
      difficultyPreference: "mixed",
      bloomsLevel: "Mixed",
      instructions: "",
      questionGroups: [{ type: "Short Questions", count: -1, marks: 2 }],
    });

    expect(result.success).toBe(false);
  });

  it("keeps generated question options backward compatible", () => {
    const question = generatedQuestionSchema.parse({
      questionText: "What is 2 + 2?",
      type: "Short Questions",
      difficulty: "Easy",
      marks: 1,
      bloomsLevel: "Remember",
      answerKey: "4",
      estimatedTime: "1 minute",
      confidenceScore: 1,
      generationRationale: "Basic arithmetic recall.",
    });

    expect(question.options).toEqual([]);
  });

  it("accepts multiple choice options", () => {
    const question = generatedQuestionSchema.parse({
      questionText: "Which number is even?",
      type: "Multiple Choice Questions",
      difficulty: "Easy",
      marks: 1,
      options: ["3", "5", "8", "9"],
      bloomsLevel: "Remember",
      answerKey: "8",
      estimatedTime: "1 minute",
      confidenceScore: 1,
      generationRationale: "Checks number parity.",
    });

    expect(question.options).toHaveLength(4);
  });

  it("accepts profile updates with an avatar URL", () => {
    const profile = updateProfileSchema.parse({
      name: "Harish Teacher",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=teacher",
    });

    expect(profile.name).toBe("Harish Teacher");
  });
});
