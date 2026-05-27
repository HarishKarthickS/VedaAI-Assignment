import { createUploadthing, type FileRouter } from "uploadthing/express";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../services/auth.service.js";
import { SourceDocument } from "../models/index.js";
import { extractionQueue } from "../queues/index.js";
import { deletePrivateFile } from "../services/file.service.js";

const f = createUploadthing();

export const uploadRouter: FileRouter = {
  studyMaterial: f({
    image: { maxFileSize: "16MB", maxFileCount: 1, acl: "public-read" },
    pdf: { maxFileSize: "16MB", maxFileCount: 1, acl: "public-read" },
    text: { maxFileSize: "2MB", maxFileCount: 1, acl: "public-read" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 1,
      acl: "public-read",
    },
  })
    .input(z.object({ sourceDraftId: z.string().min(1) }))
    .middleware(async ({ req, input }) => {
      if (!env.UPLOADTHING_TOKEN) {
        throw new UploadThingError("File uploads are not configured. Add UPLOADTHING_TOKEN to .env.");
      }

      const token = req.cookies?.["veda_access"] as string | undefined;
      if (!token) throw new UploadThingError("Please sign in before uploading.");
      const claims = verifyAccessToken(token);
      return { sourceDraftId: input.sourceDraftId, userId: claims.userId, workspaceId: claims.workspaceId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      if (file.size > 10 * 1024 * 1024) {
        await deletePrivateFile(file.key);
        throw new UploadThingError("Study material must not exceed 10MB.");
      }
      const existing = await SourceDocument.findOne({
        sourceDraftId: metadata.sourceDraftId,
        workspaceId: metadata.workspaceId,
        uploadedBy: metadata.userId,
        assignmentId: { $exists: false },
      });
      if (existing) {
        await deletePrivateFile(existing.fileKey);
        await existing.deleteOne();
      }
      const source = await SourceDocument.create({
        workspaceId: metadata.workspaceId,
        uploadedBy: metadata.userId,
        sourceDraftId: metadata.sourceDraftId,
        fileKey: file.key,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      await extractionQueue.add("extract", { sourceDocumentId: source.id }, { attempts: 2 });
      return { sourceDocumentId: source.id, extractionStatus: source.extractionStatus };
    }),
};
