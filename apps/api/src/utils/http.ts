import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const asyncHandler =
  (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    request.log?.warn({ issues: error.issues }, "Request validation failed");
    response.status(400).json({
      error: "Please correct the highlighted fields.",
      issues: error.flatten().fieldErrors,
    });
    return;
  }
  if (error instanceof ApiError) {
    request.log?.warn({ statusCode: error.statusCode, error: error.message }, "Request failed with API error");
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  request.log?.error({ error: message }, "Unhandled request failure");
  response.status(500).json({ error: "Unexpected server error" });
}
