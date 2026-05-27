import { randomUUID } from "node:crypto";
import { createAssignmentSchema, questionTotals } from "@veda/contracts";
import { z } from "zod";
import { Assignment, AssessmentRevision, GenerationRun, ActivityEvent, SourceDocument } from "../models/index.js";
import { logger } from "../config/logger.js";
import { generationQueue, pdfQueue } from "../queues/index.js";
import { ApiError } from "../utils/http.js";
import { repairPaperForAssignment } from "./ai.service.js";

type Actor = { userId: string; workspaceId: string; role: string };
const createAssignmentRequestSchema = createAssignmentSchema.extend({
  sourceDraftId: z.string().min(1).optional(),
});

async function ownedAssignment(id: string, actor: Actor) {
  const assignment = await Assignment.findOne({ _id: id, workspaceId: actor.workspaceId, archivedAt: null });
  if (!assignment) throw new ApiError(404, "Assessment not found.");
  return assignment;
}

export async function createAssignment(input: unknown, actor: Actor) {
  const parsed = createAssignmentRequestSchema.parse(input);
  const { sourceDraftId, ...assignmentValues } = parsed;
  if (new Date(assignmentValues.dueDate) <= new Date()) throw new ApiError(400, "Due date must be in the future.");
  const totals = questionTotals(assignmentValues.questionGroups);
  const assignment = await Assignment.create({
    ...assignmentValues,
    dueDate: new Date(assignmentValues.dueDate),
    ...totals,
    totalQuestions: totals.questions,
    totalMarks: totals.marks,
    createdBy: actor.userId,
    workspaceId: actor.workspaceId,
    status: "queued",
  });

  if (sourceDraftId) {
    const source = await SourceDocument.findOne({
      sourceDraftId,
      workspaceId: actor.workspaceId,
      uploadedBy: actor.userId,
      assignmentId: { $exists: false },
    });
    if (source) {
      source.assignmentId = assignment._id;
      source.sourceDraftId = undefined;
      await source.save();
      assignment.sourceDocumentId = source._id;
      await assignment.save();
    }
  }

  await ActivityEvent.create({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    assignmentId: assignment._id,
    action: "assignment.created",
  });
  logger.info(
    {
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      assignmentId: assignment.id,
      totalQuestions: assignment.totalQuestions,
      totalMarks: assignment.totalMarks,
      hasSourceDraft: Boolean(sourceDraftId),
    },
    "Assignment created",
  );
  return assignment;
}

export async function listAssignments(
  actor: Actor,
  query: { search?: string; status?: string; page?: string },
) {
  const page = Math.max(1, Number(query.page) || 1);
  const filter: Record<string, unknown> = { workspaceId: actor.workspaceId, archivedAt: null };
  if (query.search) filter.name = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (query.status) filter.status = query.status;
  const [items, count] = await Promise.all([
    Assignment.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * 12).limit(12).lean(),
    Assignment.countDocuments(filter),
  ]);
  return { items, page, total: count, pages: Math.ceil(count / 12) };
}

export async function getAssignment(id: string, actor: Actor) {
  const assignment = await ownedAssignment(id, actor);
  const revision = assignment.currentRevisionId
    ? await AssessmentRevision.findById(assignment.currentRevisionId).lean()
    : null;
  const latestRun = await GenerationRun.findOne({ assignmentId: id, workspaceId: actor.workspaceId })
    .sort({ createdAt: -1 })
    .select("_id status progress message error action updatedAt")
    .lean()
    .then((run) => run as any);
  return {
    assignment,
    revision,
    latestRun: latestRun
      ? {
          runId: latestRun._id.toString(),
          status: latestRun.status,
          progress: latestRun.progress,
          message: latestRun.message,
          error: latestRun.error,
          action: latestRun.action,
          updatedAt: latestRun.updatedAt,
        }
      : null,
  };
}

export async function archiveAssignment(id: string, actor: Actor) {
  const assignment = await ownedAssignment(id, actor);
  assignment.archivedAt = new Date();
  await assignment.save();
  logger.info({ workspaceId: actor.workspaceId, actorId: actor.userId, assignmentId: id }, "Assignment archived");
}

export async function duplicateAssignment(id: string, actor: Actor) {
  const source = await ownedAssignment(id, actor);
  const copy = await Assignment.create({
    ...source.toObject(),
    _id: undefined,
    name: `${source.name} (Copy)`,
    createdBy: actor.userId,
    currentRevisionId: undefined,
    sourceDocumentId: undefined,
    status: "queued",
    createdAt: undefined,
    updatedAt: undefined,
  });
  logger.info(
    { workspaceId: actor.workspaceId, actorId: actor.userId, sourceAssignmentId: id, assignmentId: copy.id },
    "Assignment duplicated",
  );
  return copy;
}

export async function startGenerationRun(
  assignmentId: string,
  actor: Actor,
  action = "initial",
  target?: { questionId?: string; sectionId?: string },
) {
  await ownedAssignment(assignmentId, actor);
  const idempotencyKey = `${actor.userId}:${assignmentId}:${action}:${target?.questionId || target?.sectionId || "all"}:${randomUUID()}`;
  const run = await GenerationRun.create({
    workspaceId: actor.workspaceId,
    assignmentId,
    requestedBy: actor.userId,
    action,
    targetQuestionId: target?.questionId,
    targetSectionId: target?.sectionId,
    idempotencyKey,
  });
  await Assignment.findByIdAndUpdate(assignmentId, { status: "queued" });
  await generationQueue.add(
    action,
    { runId: run.id, assignmentId, actor, target },
    { jobId: run.id, attempts: 3, backoff: { type: "exponential", delay: 1500 } },
  );
  logger.info(
    {
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      assignmentId,
      runId: run.id,
      action,
      targetQuestionId: target?.questionId,
      targetSectionId: target?.sectionId,
    },
    "Generation run queued",
  );
  return run;
}

export async function requestPdfExport(
  assignmentId: string,
  actor: Actor,
  variant: "student" | "teacher",
  template: "modern" | "classic" | "minimal",
) {
  const assignment = await ownedAssignment(assignmentId, actor);
  if (!assignment.currentRevisionId) throw new ApiError(409, "Generate this assessment before exporting it.");
  const exportJob = await import("../models/index.js").then(({ PdfExport }) =>
    PdfExport.create({
      workspaceId: actor.workspaceId,
      assignmentId,
      revisionId: assignment.currentRevisionId,
      requestedBy: actor.userId,
      variant,
      template,
    }),
  );
  await pdfQueue.add("export", { exportId: exportJob.id }, { attempts: 2, backoff: { type: "exponential", delay: 1000 } });
  logger.info(
    {
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      assignmentId,
      exportId: exportJob.id,
      variant,
      template,
    },
    "PDF export queued",
  );
  return exportJob;
}

export async function getDashboard(actor: Actor) {
  const assignments = await Assignment.find({ workspaceId: actor.workspaceId, archivedAt: null }).lean();
  return {
    totalGenerated: assignments.filter((item) => item.currentRevisionId).length,
    totalQuestions: assignments.reduce((sum, item) => sum + item.totalQuestions, 0),
    averageMarks: assignments.length
      ? Math.round(assignments.reduce((sum, item) => sum + item.totalMarks, 0) / assignments.length)
      : 0,
    recent: assignments.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt)).slice(0, 5),
  };
}

export async function saveManualRevision(assignmentId: string, actor: Actor, input: unknown) {
  const assignment = await ownedAssignment(assignmentId, actor);
  const paper = await repairPaperForAssignment(assignment.toObject(), input, "manual_revision_repair");
  const version = (await AssessmentRevision.countDocuments({ assignmentId })) + 1;
  const revision = await AssessmentRevision.create({
    assignmentId,
    workspaceId: actor.workspaceId,
    version,
    origin: "manual_edit",
    sections: paper.sections,
  });
  assignment.currentRevisionId = revision._id;
  assignment.status = "completed";
  assignment.totalQuestions = paper.sections.reduce((sum, section) => sum + section.questions.length, 0);
  assignment.totalMarks = paper.sections.reduce(
    (sum, section) => sum + section.questions.reduce((sectionTotal, question) => sectionTotal + question.marks, 0),
    0,
  );
  await assignment.save();
  logger.info(
    { workspaceId: actor.workspaceId, actorId: actor.userId, assignmentId, revisionId: revision.id, version },
    "Manual revision saved",
  );
  return revision;
}
