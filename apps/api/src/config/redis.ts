import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

const redisUrl = new URL(env.REDIS_URL);
export const bullConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
};
