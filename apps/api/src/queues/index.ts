import { Queue } from "bullmq";
import { bullConnection } from "../config/redis.js";

export const generationQueue = new Queue("assessment-generation", { connection: bullConnection });
export const extractionQueue = new Queue("document-extraction", { connection: bullConnection });
export const pdfQueue = new Queue("pdf-export", { connection: bullConnection });
