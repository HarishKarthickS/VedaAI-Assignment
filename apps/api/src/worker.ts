import { connectDatabase } from "./config/database.js";
import { logger } from "./config/logger.js";
import { startWorkers } from "./workers/processors.js";

async function startWorkerProcess() {
  await connectDatabase();
  const workers = startWorkers();
  logger.info({ count: workers.length }, "VedaAI workers listening");
}

startWorkerProcess().catch((error) => {
  logger.fatal(error, "Worker failed to start");
  process.exit(1);
});
