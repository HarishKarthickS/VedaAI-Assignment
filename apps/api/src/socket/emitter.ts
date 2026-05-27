import { Emitter } from "@socket.io/redis-emitter";
import type { GenerationEvent, GenerationSocketPayload } from "@veda/contracts";
import { createRedisConnection } from "../config/redis.js";

const emitter = new Emitter(createRedisConnection());

export function emitGenerationEvent(event: GenerationEvent, payload: GenerationSocketPayload) {
  emitter.to(`assignment:${payload.assignmentId}`).emit(event, payload);
}
