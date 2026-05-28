import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { createRouteHandler } from "uploadthing/express";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { redis } from "./config/redis.js";
import { uploadRouter } from "./uploadthing/router.js";
import { apiRouter } from "./routes/index.js";
import { swaggerDocument } from "./docs/swagger.js";
import { errorHandler } from "./utils/http.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    pinoHttp({
      logger,
      genReqId: (request, response) => {
        const existing = request.headers["x-request-id"];
        const requestId = Array.isArray(existing) ? existing[0] : existing;
        const id = requestId || randomUUID();
        response.setHeader("x-request-id", id);
        return id;
      },
      customProps: (request) => ({
        authUserId: request.auth?.userId,
        workspaceId: request.auth?.workspaceId,
      }),
      customSuccessMessage: (request, response) =>
        `${request.method} ${request.originalUrl} completed with ${response.statusCode}`,
      customErrorMessage: (request, response) =>
        `${request.method} ${request.originalUrl} failed with ${response.statusCode}`,
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use("/api/uploadthing", createRouteHandler({ router: uploadRouter }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: "draft-7" }));

  app.get("/health", (_request, response) => response.json({ service: "vedaai-api", status: "healthy" }));
  app.get("/ready", async (_request, response) => {
    await redis.ping();
    response.json({ service: "vedaai-api", status: "ready" });
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use("/api", apiRouter);
  app.use(errorHandler);
  return app;
}
