import type { FileRouter } from "uploadthing/server";

type UploadRouteShape<TInput, TOutput> = FileRouter[string] & {
  $types: {
    input: TInput;
    output: TOutput;
    errorShape: unknown;
  };
};

export type UploadRouter = FileRouter & {
  studyMaterial: UploadRouteShape<
    { sourceDraftId: string },
    { sourceDocumentId: string; extractionStatus: "queued" | "processing" | "completed" | "failed" }
  >;
};
