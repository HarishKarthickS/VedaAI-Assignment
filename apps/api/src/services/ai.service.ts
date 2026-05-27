import {
  assessmentPaperSchema,
  generatedQuestionSchema,
  generatedSectionSchema,
  questionTotals,
  type AssessmentPaper,
  type CreateAssignmentInput,
} from "@veda/contracts";
import { OpenRouter } from "@openrouter/sdk";
import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/http.js";
import { normalizePaperForAssignment, type IntegrityAssignment } from "./paper-integrity.service.js";

type PromptAssignment = CreateAssignmentInput & {
  totalQuestions: number;
  totalMarks: number;
  material?: string;
};

type ProviderRequest = Record<string, unknown>;
type ProviderResponse = {
  ok: boolean;
  status: number;
  headers?: Headers;
  body?: string;
  result?: {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
};

const OPENROUTER_TIMEOUT_MS = 45_000;
const MAX_PROVIDER_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 8_000;

export function isRetryableProviderStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function retryAfterToMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

export function calculateBackoffDelay(attempt: number, retryAfterMs?: number, jitter = Math.random()) {
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, MAX_BACKOFF_MS);
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS);
  const jitterMs = Math.round(exponential * 0.25 * jitter);
  return Math.min(exponential + jitterMs, MAX_BACKOFF_MS);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeProviderProblem(problem: string) {
  return problem
    .replace(env.OPENROUTER_API_KEY || "never-match-openrouter-key", "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

function openRouterClient() {
  return new OpenRouter({
    apiKey: env.OPENROUTER_API_KEY || "",
    httpReferer: env.OPENROUTER_APP_URL,
    appTitle: env.OPENROUTER_APP_NAME,
  });
}

function buildMessages(prompt: string) {
  return [
    {
      role: "system" as const,
      content:
        "You are a careful school assessment designer. Follow the supplied counts and marks exactly. Return only schema-valid educational content.",
    },
    { role: "user" as const, content: prompt },
  ];
}

function providerRoutingFailed(problem: string) {
  return problem.includes("No endpoints found that can handle the requested parameters");
}

function sdkErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  const value = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status;
  return typeof value === "number" ? value : undefined;
}

function sdkErrorHeaders(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  const headers = (error as { headers?: unknown }).headers;
  return headers instanceof Headers ? headers : undefined;
}

function sdkErrorBody(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  return typeof body === "string" ? body : undefined;
}

async function sendOpenRouterOnce(body: ProviderRequest, timeoutMs: number): Promise<ProviderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await openRouterClient().chat.send(
      { chatRequest: body as any },
      {
        timeoutMs,
        signal: controller.signal,
        retries: { strategy: "none" },
      },
    );
    return { ok: true, status: 200, result: result as ProviderResponse["result"] };
  } catch (error) {
    const status = sdkErrorStatus(error);
    if (status) {
      return {
        ok: false,
        status,
        headers: sdkErrorHeaders(error),
        body: sdkErrorBody(error) || (error instanceof Error ? error.message : "OpenRouter request failed"),
      };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenRouter(body: ProviderRequest, mode: string) {
  let lastNetworkError: unknown;
  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await sendOpenRouterOnce(body, OPENROUTER_TIMEOUT_MS);
      const durationMs = Date.now() - startedAt;
      logger.info(
        { provider: "openrouter", mode, attempt, status: response.status, durationMs },
        "AI provider request finished",
      );
      if (response.ok || !isRetryableProviderStatus(response.status) || attempt === MAX_PROVIDER_ATTEMPTS) {
        return response;
      }
      const problem = sanitizeProviderProblem(response.body || "");
      const delayMs = calculateBackoffDelay(attempt, retryAfterToMs(response.headers?.get("retry-after") || null));
      logger.warn(
        { provider: "openrouter", mode, attempt, status: response.status, delayMs, problem },
        "AI provider request will be retried",
      );
      await sleep(delayMs);
    } catch (error) {
      lastNetworkError = error;
      const durationMs = Date.now() - startedAt;
      if (attempt === MAX_PROVIDER_ATTEMPTS) break;
      const delayMs = calculateBackoffDelay(attempt);
      logger.warn(
        {
          provider: "openrouter",
          mode,
          attempt,
          durationMs,
          delayMs,
          error: error instanceof Error ? error.message : "Unknown provider error",
        },
        "AI provider network failure will be retried",
      );
      await sleep(delayMs);
    }
  }

  logger.error(
    { provider: "openrouter", mode, error: lastNetworkError instanceof Error ? lastNetworkError.message : "Unknown provider error" },
    "AI provider request failed after retries",
  );
  throw new ApiError(502, "AI provider was temporarily unavailable. Please try again shortly.");
}

async function parseStructuredBody<T>(response: ProviderResponse, schema: ZodType<T, any, any>) {
  const content = response.result?.choices?.[0]?.message?.content;
  if (!content) throw new ApiError(502, "AI provider returned an empty assessment.");
  const parsedJson = typeof content === "string" ? (JSON.parse(content) as unknown) : content;
  return schema.parse(parsedJson);
}

async function parseOrRepairStructuredBody<T>(
  name: string,
  schema: ZodType<T, any, any>,
  prompt: string,
  response: ProviderResponse,
  mode: string,
): Promise<T> {
  try {
    return await parseStructuredBody(response, schema);
  } catch (error) {
    logger.warn(
      {
        provider: "openrouter",
        mode,
        error: error instanceof Error ? sanitizeProviderProblem(error.message) : "Invalid structured response",
      },
      "AI provider returned invalid structured content; requesting repair",
    );
    const repairResponse = await callOpenRouter(
      {
        model: env.OPENROUTER_MODEL,
        messages: [
          ...buildMessages(prompt),
          {
            role: "user",
            content: [
              "Return a corrected response as valid JSON only.",
              "It must match this JSON schema exactly.",
              JSON.stringify(zodToJsonSchema(schema, { $refStrategy: "none" })),
            ].join("\n"),
          },
        ],
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name,
            strict: true,
            schema: zodToJsonSchema(schema, { $refStrategy: "none" }),
          },
        },
        temperature: 0.2,
      },
      `${mode}:repair`,
    );
    if (!repairResponse.ok) {
      const problem = sanitizeProviderProblem(repairResponse.body || "");
      throw new ApiError(502, `AI provider could not repair the generated assessment: ${problem}`);
    }
    return parseStructuredBody(repairResponse, schema);
  }
}

async function structuredCompletion<T>(name: string, schema: ZodType<T, any, any>, prompt: string): Promise<T> {
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) {
    throw new ApiError(503, "AI generation is not configured. Add OPENROUTER_API_KEY and OPENROUTER_MODEL to .env.");
  }

  const baseRequest = {
    model: env.OPENROUTER_MODEL,
    messages: buildMessages(prompt),
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name,
        strict: true,
        schema: zodToJsonSchema(schema, { $refStrategy: "none" }),
      },
    },
    temperature: 0.55,
  };

  const strictResponse = await callOpenRouter(
    {
      ...baseRequest,
      provider: { requireParameters: true },
    },
    "strict_schema",
  );
  if (strictResponse.ok) {
    return parseOrRepairStructuredBody(name, schema, prompt, strictResponse, "strict_schema");
  }

  const strictProblem = sanitizeProviderProblem(strictResponse.body || "");
  if (!providerRoutingFailed(strictProblem)) {
    throw new ApiError(502, `AI provider rejected the generation request: ${strictProblem.slice(0, 160)}`);
  }

  const relaxedResponse = await callOpenRouter(baseRequest, "relaxed_schema");
  if (relaxedResponse.ok) {
    return parseOrRepairStructuredBody(name, schema, prompt, relaxedResponse, "relaxed_schema");
  }

  const relaxedProblem = sanitizeProviderProblem(relaxedResponse.body || "");
  const jsonOnlyResponse = await callOpenRouter(
    {
      model: env.OPENROUTER_MODEL,
      messages: [
        ...buildMessages(prompt),
        {
          role: "user",
          content:
            "Return only valid JSON that matches the requested schema exactly. Do not wrap it in markdown fences or extra commentary.",
        },
      ],
      temperature: 0.3,
    },
    "json_only",
  );

  if (!jsonOnlyResponse.ok) {
    const problem = sanitizeProviderProblem(jsonOnlyResponse.body || "");
    throw new ApiError(
      502,
      `AI provider rejected the generation request: ${problem.slice(0, 160) || relaxedProblem.slice(0, 160) || strictProblem.slice(0, 160)}`,
    );
  }

  return parseOrRepairStructuredBody(name, schema, prompt, jsonOnlyResponse, "json_only");
}

function requestedDistribution(assignment: Pick<PromptAssignment, "questionGroups">) {
  return assignment.questionGroups
    .map((group) => `${group.count} x ${group.type} at ${group.marks} marks each`)
    .join("; ");
}

function repairPrompt(assignment: IntegrityAssignment, paper: unknown, problem: string) {
  return [
    `Repair this ${assignment.subject} assessment for ${assignment.grade}.`,
    `Required distribution: ${requestedDistribution(assignment)}.`,
    `Validation problem: ${problem}.`,
    "Return a complete replacement paper, not a patch.",
    "Every requested question group must be present with the exact type, count, and marks.",
    "For Multiple Choice Questions, include exactly four options and make answerKey exactly match the correct option text.",
    "For all non-MCQ question types, set options to an empty array.",
    "Do not include duplicate questions.",
    `Current invalid paper JSON:\n${JSON.stringify(paper).slice(0, 16000)}`,
  ].join("\n");
}

export async function repairPaperForAssignment(
  assignment: IntegrityAssignment,
  paper: unknown,
  mode = "assessment_repair",
) {
  try {
    return normalizePaperForAssignment(paper, assignment);
  } catch (error) {
    const problem = error instanceof Error ? error.message : "Assessment did not match the requested structure.";
    logger.warn({ mode, problem }, "Assessment paper failed deterministic integrity checks; requesting repair");
    const repaired = await structuredCompletion<AssessmentPaper>(
      "veda_repaired_assessment_paper",
      assessmentPaperSchema,
      repairPrompt(assignment, paper, problem),
    );
    return normalizePaperForAssignment(repaired, assignment);
  }
}

export async function generatePaper(assignment: PromptAssignment) {
  const prompt = [
    `Create a ${assignment.subject} assessment for ${assignment.grade}.`,
    `Title: ${assignment.name}. Time allowed: ${assignment.timeLimit} minutes. Total marks: ${assignment.totalMarks}.`,
    `Required distribution: ${requestedDistribution(assignment)}.`,
    `Difficulty preference: ${assignment.difficultyPreference}. Bloom's preference: ${assignment.bloomsLevel}.`,
    `Teacher instructions: ${assignment.instructions || "No additional instructions."}`,
    "Organize compatible question types into clearly titled Sections A, B, and C where applicable.",
    "Give every question a concise answer key, honest confidence from 0 to 1, and a short rationale.",
    "For Multiple Choice Questions, include exactly four options in the options array and make answerKey exactly match the correct option text.",
    "For all non-MCQ question types, set options to an empty array.",
    "For True / False questions, the answerKey must be exactly True or False.",
    "For Fill in the Blanks, include a visible blank using underscores in questionText.",
    assignment.material ? `Use this extracted source material as curriculum context:\n${assignment.material.slice(0, 14000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const paper = await structuredCompletion<AssessmentPaper>("veda_assessment_paper", assessmentPaperSchema, prompt);
  return repairPaperForAssignment(assignment, paper, "generate_paper");
}

export async function regenerateQuestion(
  assignment: PromptAssignment,
  previousQuestion: z.infer<typeof generatedQuestionSchema>,
) {
  const replacement = await structuredCompletion<z.infer<typeof generatedQuestionSchema>>(
    "veda_replacement_question",
    generatedQuestionSchema,
    `Write a new, non-duplicate ${previousQuestion.type} question for ${assignment.subject}, ${assignment.grade}.
It must remain ${previousQuestion.marks} marks and at difficulty ${previousQuestion.difficulty}.
If it is a Multiple Choice Question, include exactly four options and set answerKey to the correct option text. Otherwise use an empty options array.
Avoid this old question: ${previousQuestion.questionText}.
Teacher context: ${assignment.instructions || "None"}.`,
  );
  if (
    replacement.type !== previousQuestion.type ||
    replacement.marks !== previousQuestion.marks ||
    replacement.difficulty !== previousQuestion.difficulty
  ) {
    throw new ApiError(422, "Replacement question did not preserve the configured assessment structure.");
  }
  const normalized = await repairPaperForAssignment(
    {
      ...assignment,
      questionGroups: [{ type: previousQuestion.type, marks: previousQuestion.marks, count: 1 }],
    },
    { sections: [{ title: "Replacement", instruction: "Replacement", questions: [replacement] }] },
    "regenerate_question_repair",
  );
  const replacementQuestion = normalized.sections[0]?.questions[0];
  if (!replacementQuestion) throw new ApiError(422, "Replacement question could not be repaired.");
  return replacementQuestion;
}

export async function regenerateSection(
  assignment: PromptAssignment,
  previousSection: z.infer<typeof generatedSectionSchema>,
) {
  const distribution = previousSection.questions
    .map((question) => `${question.type}, ${question.marks} marks, ${question.difficulty}`)
    .join("; ");
  const replacement = await structuredCompletion<z.infer<typeof generatedSectionSchema>>(
    "veda_replacement_section",
    generatedSectionSchema,
    `Replace ${previousSection.title} for ${assignment.subject}, ${assignment.grade}.
Keep exactly this per-question distribution: ${distribution}.
For Multiple Choice Questions, include exactly four options and set answerKey to the correct option text. For all other question types use an empty options array.
Do not repeat these earlier questions: ${previousSection.questions.map((item) => item.questionText).join(" | ")}.`,
  );
  const before = previousSection.questions.map((question) => `${question.type}:${question.marks}`).sort();
  const after = replacement.questions.map((question) => `${question.type}:${question.marks}`).sort();
  if (before.join("|") !== after.join("|")) {
    throw new ApiError(422, "Replacement section did not preserve the configured marks and question types.");
  }
  const normalized = await repairPaperForAssignment(
    {
      ...assignment,
      questionGroups: previousSection.questions.map((question) => ({
        type: question.type,
        marks: question.marks,
        count: 1,
      })),
    },
    { sections: [replacement] },
    "regenerate_section_repair",
  );
  return { ...replacement, questions: normalized.sections.flatMap((section) => section.questions) };
}
