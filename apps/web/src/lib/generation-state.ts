import type { GenerationSocketPayload, GenerationStatus } from "@veda/contracts";

const activeStatuses: GenerationStatus[] = ["queued", "processing", "generating", "parsing", "finalizing"];

export type LatestRun = Pick<GenerationSocketPayload, "runId" | "status" | "progress" | "message" | "revisionId"> & {
  action?: string;
  error?: string;
  updatedAt?: string;
};

export function isActiveGeneration(status?: string) {
  return activeStatuses.includes(status as GenerationStatus);
}

export function generationDisplayState({
  assignmentStatus,
  generated,
  latestRun,
}: {
  assignmentStatus?: string;
  generated: boolean;
  latestRun?: LatestRun | null;
}) {
  const status = latestRun?.status || assignmentStatus;
  const active = isActiveGeneration(status);
  const failed = status === "failed";
  const progress = latestRun?.progress ?? (active ? 35 : generated ? 100 : failed ? 100 : 8);
  const message =
    latestRun?.message ||
    (failed
      ? "We couldn't finish generating this assessment."
      : active
        ? "We're preparing your assessment paper."
        : generated
          ? "Editing your generated assessment"
          : "Waiting to begin generation");

  return {
    active,
    failed,
    complete: generated && !active && !failed,
    progress,
    message,
    userError: latestRun?.error || (failed ? message : undefined),
  };
}
