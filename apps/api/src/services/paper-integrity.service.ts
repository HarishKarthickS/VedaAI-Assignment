import { assessmentPaperSchema, type AssessmentPaper, type CreateAssignmentInput } from "@veda/contracts";
import { ApiError } from "../utils/http.js";

export type IntegrityAssignment = Pick<
  CreateAssignmentInput,
  "subject" | "grade" | "questionGroups" | "difficultyPreference" | "bloomsLevel" | "instructions"
> & {
  name?: string;
  totalMarks?: number;
  timeLimit?: number;
};

type Question = AssessmentPaper["sections"][number]["questions"][number];

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeAnswer(value: string) {
  return cleanText(value).toLowerCase().replace(/^[a-f][).:-]\s*/i, "").replace(/\W/g, "");
}

function stripOptionPrefix(value: string) {
  return cleanText(value).replace(/^\(?[A-Fa-f]\)?[\).:\-]\s*/, "").trim();
}

function optionFromAnswerLabel(answerKey: string, options: string[]) {
  const match = cleanText(answerKey).match(/^\(?([A-Da-d])\)?[\).:\-]?$/);
  if (!match) return undefined;
  return options[match[1]!.toUpperCase().charCodeAt(0) - 65];
}

function cleanOptions(options: string[]) {
  const seen = new Set<string>();
  return options
    .map(stripOptionPrefix)
    .filter(Boolean)
    .filter((option) => {
      const key = normalizeAnswer(option);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeMcq(question: Question): Question {
  const rawOptions = Array.isArray(question.options) ? question.options.map(cleanText).filter(Boolean) : [];
  let options = cleanOptions(rawOptions);
  const labelAnswer = optionFromAnswerLabel(question.answerKey, rawOptions);
  let answerKey = stripOptionPrefix(labelAnswer || question.answerKey);

  if (options.length > 4) {
    const answerIndex = options.findIndex((option) => normalizeAnswer(option) === normalizeAnswer(answerKey));
    const answerOption = answerIndex >= 0 ? options[answerIndex] : undefined;
    const firstOptions = options.filter((_, index) => index !== answerIndex).slice(0, answerOption ? 3 : 4);
    options = answerOption ? [...firstOptions, answerOption] : firstOptions;
  }

  const matchedOption = options.find((option) => normalizeAnswer(option) === normalizeAnswer(answerKey));
  if (matchedOption) answerKey = matchedOption;

  return {
    ...question,
    questionText: cleanText(question.questionText),
    answerKey,
    options,
  };
}

function normalizeTrueFalseAnswer(answerKey: string) {
  const value = cleanText(answerKey);
  if (/^true$/i.test(value) || /\btrue\b/i.test(value)) return "True";
  if (/^false$/i.test(value) || /\bfalse\b/i.test(value)) return "False";
  return value;
}

function normalizeQuestion(question: Question, marks: number): Question {
  const normalized: Question = {
    ...question,
    questionText: cleanText(question.questionText),
    marks,
    options: [],
    bloomsLevel: cleanText(question.bloomsLevel),
    answerKey: cleanText(question.answerKey),
    estimatedTime: cleanText(question.estimatedTime),
    generationRationale: cleanText(question.generationRationale),
  };

  if (normalized.type === "Multiple Choice Questions") {
    return normalizeMcq({ ...normalized, options: question.options || [] });
  }

  if (normalized.type === "True / False") {
    normalized.answerKey = normalizeTrueFalseAnswer(normalized.answerKey);
  }

  if (normalized.type === "Fill in the Blanks" && !/_{3,}|\bblank\b|\[blank\]/i.test(normalized.questionText)) {
    normalized.questionText = `${normalized.questionText} ________`;
  }

  return normalized;
}

function assertQuestion(question: Question) {
  if (question.type === "Multiple Choice Questions") {
    if (!question.options || question.options.length !== 4) {
      throw new ApiError(422, "Multiple Choice Questions must include exactly four non-empty answer options.");
    }
    const optionSet = new Set(question.options.map((option) => normalizeAnswer(option)));
    if (!optionSet.has(normalizeAnswer(question.answerKey))) {
      throw new ApiError(422, "Multiple Choice answer keys must match one of the four options.");
    }
  } else if (question.options?.length) {
    throw new ApiError(422, `${question.type} questions must not include answer options.`);
  }

  if (question.type === "True / False" && !/^(True|False)$/.test(question.answerKey)) {
    throw new ApiError(422, "True / False answer keys must be exactly True or False.");
  }
}

export function instructionForQuestionType(type: string) {
  switch (type) {
    case "Multiple Choice Questions":
      return "Choose the correct answer from the given options.";
    case "Short Questions":
      return "Answer the following questions briefly.";
    case "Long Answer Questions":
      return "Answer the following questions in detail.";
    case "True / False":
      return "Write True or False for each statement.";
    case "Fill in the Blanks":
      return "Fill in each blank with the most appropriate answer.";
    case "Case Study":
      return "Read the case carefully and answer the questions.";
    case "Diagram/Graph-Based Questions":
      return "Study the diagram or graph and answer the questions.";
    case "Numerical Problems":
      return "Solve the following problems and show the main steps.";
    default:
      return "Answer all questions in this section.";
  }
}

function sectionTitle(index: number, type: string) {
  return `Section ${String.fromCharCode(65 + index)} - ${type}`;
}

function distributionKey(type: string, marks: number) {
  return `${type}:${marks}`;
}

export function normalizePaperForAssignment(paper: unknown, assignment: IntegrityAssignment): AssessmentPaper {
  const parsed = assessmentPaperSchema.parse(paper);
  const flatQuestions = parsed.sections.flatMap((section) => section.questions);
  const used = new Set<number>();
  const repeated = new Set<string>();
  const sections: AssessmentPaper["sections"] = [];

  assignment.questionGroups.forEach((group, groupIndex) => {
    const matchingIndexes = flatQuestions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => !used.has(index) && question.type === group.type)
      .sort((left, right) => {
        const leftExact = left.question.marks === group.marks ? 0 : 1;
        const rightExact = right.question.marks === group.marks ? 0 : 1;
        return leftExact - rightExact;
      });

    if (matchingIndexes.length < group.count) {
      const received = matchingIndexes.length;
      throw new ApiError(
        422,
        `Expected ${group.count} ${group.type} question(s) at ${group.marks} mark(s), but found ${received}.`,
      );
    }

    const questions = matchingIndexes.slice(0, group.count).map(({ question, index }) => {
      used.add(index);
      const normalized = normalizeQuestion(question, group.marks);
      assertQuestion(normalized);
      const normalizedText = normalizeAnswer(normalized.questionText);
      if (repeated.has(normalizedText)) throw new ApiError(422, "Assessment contains repeated questions.");
      repeated.add(normalizedText);
      return normalized;
    });

    sections.push({
      title: sectionTitle(groupIndex, group.type),
      instruction: instructionForQuestionType(group.type),
      questions,
    });
  });

  return { sections };
}

export function assertPaperMatchesAssignment(paper: unknown, assignment: IntegrityAssignment) {
  const normalized = normalizePaperForAssignment(paper, assignment);
  const expected = new Map<string, number>();
  for (const group of assignment.questionGroups) {
    const key = distributionKey(group.type, group.marks);
    expected.set(key, (expected.get(key) || 0) + group.count);
  }

  const actual = new Map<string, number>();
  for (const question of normalized.sections.flatMap((section) => section.questions)) {
    const key = distributionKey(question.type, question.marks);
    actual.set(key, (actual.get(key) || 0) + 1);
  }

  for (const [key, count] of expected) {
    if (actual.get(key) !== count) {
      throw new ApiError(422, `Assessment distribution mismatch for ${key}.`);
    }
  }

  return normalized;
}
