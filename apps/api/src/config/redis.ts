import { Redis, RedisOptions } from "ioredis";
import { env } from "./env.js";

const isTls = env.REDIS_URL.startsWith("rediss:");

const commonOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Aiven Valkey/Redis aggressively drops idle connections.
  // Enabling TCP Keep-Alive ensures connections stay alive without failing with ECONNRESET.
  keepAlive: 10000,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
};

export const redis = new Redis(env.REDIS_URL, commonOptions);

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, commonOptions);
}

const redisUrl = new URL(env.REDIS_URL);
export const bullConnection: RedisOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  ...commonOptions,
};
