import { describe, expect, it } from "vitest";
import { normalizePaperForAssignment } from "./paper-integrity.service.js";

const assignment = {
  name: "Numbers Quiz",
  subject: "Math",
  grade: "Grade 4",
  dueDate: new Date(Date.now() + 86_400_000).toISOString(),
  timeLimit: 30,
  difficultyPreference: "mixed" as const,
  bloomsLevel: "Mixed" as const,
  instructions: "",
  questionGroups: [{ type: "Multiple Choice Questions" as const, count: 4, marks: 1 }],
};

function mcq(index: number, overrides = {}) {
  return {
    questionText: `Which number is even in set ${index}?`,
    type: "Multiple Choice Questions",
    difficulty: "Easy",
    marks: 1,
    options: ["A. 3", "B. 5", "C. 8", "D. 9"],
    bloomsLevel: "Remember",
    answerKey: "C",
    estimatedTime: "1 minute",
    confidenceScore: 1,
    generationRationale: "Checks parity.",
    ...overrides,
  };
}

describe("paper integrity", () => {
  it("keeps the requested MCQ count and cleans option labels", () => {
    const paper = normalizePaperForAssignment(
      { sections: [{ title: "Mixed", instruction: "Answer", questions: [mcq(1), mcq(2), mcq(3), mcq(4)] }] },
      assignment,
    );

    expect(paper.sections).toHaveLength(1);
    expect(paper.sections[0].questions).toHaveLength(4);
    expect(paper.sections[0].questions[0].options).toEqual(["3", "5", "8", "9"]);
    expect(paper.sections[0].questions[0].answerKey).toBe("8");
  });

  it("removes options from non-MCQ questions", () => {
    const paper = normalizePaperForAssignment(
      {
        sections: [
          {
            title: "Section",
            instruction: "Answer",
            questions: [
              {
                questionText: "Define evaporation.",
                type: "Short Questions",
                difficulty: "Easy",
                marks: 2,
                options: ["A. Wrong", "B. Also wrong"],
                bloomsLevel: "Remember",
                answerKey: "Evaporation is conversion of liquid into vapour.",
                estimatedTime: "2 minutes",
                confidenceScore: 1,
                generationRationale: "Checks definition.",
              },
            ],
          },
        ],
      },
      { ...assignment, questionGroups: [{ type: "Short Questions", count: 1, marks: 2 }] },
    );

    expect(paper.sections[0].questions[0].options).toEqual([]);
  });

  it("repairs marks for enough questions of the requested type", () => {
    const paper = normalizePaperForAssignment(
      { sections: [{ title: "Mixed", instruction: "Answer", questions: [mcq(1, { marks: 2 })] }] },
      { ...assignment, questionGroups: [{ type: "Multiple Choice Questions", count: 1, marks: 1 }] },
    );

    expect(paper.sections[0].questions[0].marks).toBe(1);
  });

  it("rejects MCQs with fewer than four options", () => {
    expect(() =>
      normalizePaperForAssignment(
        { sections: [{ title: "Mixed", instruction: "Answer", questions: [mcq(1, { options: ["3"] })] }] },
        { ...assignment, questionGroups: [{ type: "Multiple Choice Questions", count: 1, marks: 1 }] },
      ),
    ).toThrow(/exactly four/);
  });

  it("rejects papers that do not contain the requested type count", () => {
    expect(() =>
      normalizePaperForAssignment(
        { sections: [{ title: "Mixed", instruction: "Answer", questions: [mcq(1)] }] },
        assignment,
      ),
    ).toThrow(/Expected 4 Multiple Choice Questions/);
  });
});
