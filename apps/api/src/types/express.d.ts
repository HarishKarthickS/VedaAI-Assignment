import type { WorkspaceRole } from "@veda/contracts";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        workspaceId: string;
        role: WorkspaceRole;
      };
    }
  }
}

export {};
