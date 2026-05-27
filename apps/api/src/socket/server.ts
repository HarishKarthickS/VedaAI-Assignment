import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { parse } from "cookie";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { createRedisConnection } from "../config/redis.js";
import { authCookies, verifyAccessToken } from "../services/auth.service.js";
import { Assignment } from "../models/index.js";

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });
  const publisher = createRedisConnection();
  const subscriber = publisher.duplicate();
  io.adapter(createAdapter(publisher, subscriber));

  io.use((socket, next) => {
    try {
      const cookies = parse(socket.handshake.headers.cookie || "");
      const token = cookies[authCookies.accessCookie];
      if (!token) return next(new Error("Unauthorized"));
      socket.data.auth = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("watch_assignment", async (assignmentId: string) => {
      const assignment = await Assignment.exists({
        _id: assignmentId,
        workspaceId: socket.data.auth.workspaceId,
      });
      if (assignment) socket.join(`assignment:${assignmentId}`);
    });
    socket.on("unwatch_assignment", (assignmentId: string) => socket.leave(`assignment:${assignmentId}`));
  });
  return io;
}
