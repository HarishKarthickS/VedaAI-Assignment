import { UTApi, type UTFile } from "uploadthing/server";
import { env } from "../config/env.js";
import { PdfExport, SourceDocument } from "../models/index.js";
import { ApiError } from "../utils/http.js";

type UploadPrivateFileOptions = {
  acl?: "private" | "public-read";
  contentDisposition?: "inline" | "attachment";
  concurrency?: number;
  signal?: AbortSignal;
};

type UploadedPrivateFile = {
  data: {
    key: string;
    url: string;
    appUrl: string;
    ufsUrl: string;
    lastModified: number;
    name: string;
    size: number;
    type: string;
    customId: string | null;
    fileHash: string;
  } | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

function getUtapi() {
  if (!env.UPLOADTHING_TOKEN) {
    throw new ApiError(503, "File storage is not configured. Add UPLOADTHING_TOKEN to .env.");
  }

  return new UTApi({ token: env.UPLOADTHING_TOKEN });
}

export async function issueSourceFileAccess(fileId: string, workspaceId: string) {
  const file = await SourceDocument.findOne({ _id: fileId, workspaceId });
  if (!file) throw new ApiError(404, "File not found.");
  const result = await getUtapi().getFileUrls(file.fileKey);
  const publicUrl = result.data[0]?.url;
  if (!publicUrl) throw new ApiError(404, "File URL is not available.");
  return { url: publicUrl, ufsUrl: publicUrl };
}

export async function issuePdfAccess(exportId: string, assignmentId: string, workspaceId: string) {
  const artifact = await PdfExport.findOne({ _id: exportId, assignmentId, workspaceId, status: "completed" });
  if (!artifact?.fileKey) throw new ApiError(404, "PDF export is not available.");
  const result = await getUtapi().getFileUrls(artifact.fileKey);
  const publicUrl = result.data[0]?.url;
  if (!publicUrl) throw new ApiError(404, "PDF URL is not available.");
  return { url: publicUrl, ufsUrl: publicUrl };
}

export async function deletePrivateFile(fileKey: string) {
  await getUtapi().deleteFiles(fileKey);
}

export async function uploadPrivateFile(
  file: UTFile,
  options?: UploadPrivateFileOptions,
): Promise<UploadedPrivateFile> {
  return getUtapi().uploadFiles(file, options) as Promise<UploadedPrivateFile>;
}
