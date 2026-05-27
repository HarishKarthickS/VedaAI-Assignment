import { z } from "zod";

export const workspaceRoleSchema = z.enum(["ADMIN", "TEACHER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const questionTypeSchema = z.enum([
  "Multiple Choice Questions",
  "Short Questions",
  "Long Answer Questions",
  "True / False",
  "Fill in the Blanks",
  "Case Study",
  "Diagram/Graph-Based Questions",
  "Numerical Problems",
]);

export const difficultySchema = z.enum(["Easy", "Moderate", "Challenging"]);
export const difficultyPreferenceSchema = z.enum(["easy", "medium", "hard", "mixed"]);
export const bloomLevelSchema = z.enum([
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
  "Mixed",
]);

export const questionGroupSchema = z.object({
  type: questionTypeSchema,
  count: z.number().int().min(1).max(50),
  marks: z.number().int().min(1).max(100),
});

export const createAssignmentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  subject: z.string().trim().min(2).max(80),
  grade: z.string().trim().min(1).max(40),
  dueDate: z.string().datetime(),
  timeLimit: z.number().int().min(5).max(360),
  questionGroups: z.array(questionGroupSchema).min(1).max(12),
  difficultyPreference: difficultyPreferenceSchema,
  bloomsLevel: bloomLevelSchema,
  instructions: z.string().trim().max(1200).default(""),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const generatedQuestionSchema = z.object({
  questionText: z.string().trim().min(5),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  marks: z.number().int().positive(),
  options: z.array(z.string().trim().min(1)).max(6).default([]),
  bloomsLevel: z.string().trim().min(1),
  answerKey: z.string().trim().min(1),
  estimatedTime: z.string().trim().min(1),
  confidenceScore: z.number().min(0).max(1),
  generationRationale: z.string().trim().min(1),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const generatedSectionSchema = z.object({
  title: z.string().trim().min(1),
  instruction: z.string().trim().min(1),
  questions: z.array(generatedQuestionSchema).min(1),
});
export type GeneratedSection = z.infer<typeof generatedSectionSchema>;

export const assessmentPaperSchema = z.object({
  sections: z.array(generatedSectionSchema).min(1),
});
export type AssessmentPaper = z.infer<typeof assessmentPaperSchema>;

export const generationStatusSchema = z.enum([
  "queued",
  "processing",
  "generating",
  "parsing",
  "finalizing",
  "completed",
  "failed",
]);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const revisionOriginSchema = z.enum([
  "initial",
  "regenerated_question",
  "regenerated_section",
  "rebalanced",
  "manual_edit",
]);

export const pdfTemplateSchema = z.enum(["modern", "classic", "minimal"]);
export const pdfVariantSchema = z.enum(["student", "teacher"]);

export const generationSocketPayloadSchema = z.object({
  assignmentId: z.string(),
  runId: z.string(),
  status: generationStatusSchema,
  progress: z.number().int().min(0).max(100),
  message: z.string(),
  sectionTitle: z.string().optional(),
  revisionId: z.string().optional(),
});
export type GenerationSocketPayload = z.infer<typeof generationSocketPayloadSchema>;

export type GenerationEvent =
  | "generation_started"
  | "generation_progress"
  | "section_generated"
  | "generation_completed"
  | "generation_failed";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(80),
  schoolName: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(80),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  role: workspaceRoleSchema.exclude(["ADMIN"]).default("TEACHER"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  avatar: z.string().trim().url().max(500).optional().or(z.literal("")),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(80),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const questionTotals = (groups: z.infer<typeof questionGroupSchema>[]) =>
  groups.reduce(
    (total, group) => ({
      questions: total.questions + group.count,
      marks: total.marks + group.count * group.marks,
    }),
    { questions: 0, marks: 0 },
  );
