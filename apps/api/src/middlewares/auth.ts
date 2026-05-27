import type { RequestHandler } from "express";
import { authCookies, verifyAccessToken } from "../services/auth.service.js";
import { ApiError } from "../utils/http.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const token = request.cookies?.[authCookies.accessCookie] as string | undefined;
  if (!token) {
    next(new ApiError(401, "Please sign in."));
    return;
  }
  try {
    request.auth = verifyAccessToken(token);
    next();
  } catch {
    next(new ApiError(401, "Your session has expired."));
  }
};
