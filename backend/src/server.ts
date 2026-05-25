import http from "http";
import { createApp } from "./app";
import { initSocket } from "./sockets";
import { config } from "./config";
import fs from "fs";

async function bootstrap() {
  // ensure uploads dir exists
  fs.mkdirSync(config.uploads.dir, { recursive: true });

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`🚀 Melvi Condomínio API listening on http://localhost:${config.port}`);
    console.log(`📡 Socket.io ready  (CORS: ${config.cors.origin.join(", ")})`);
    console.log(`🌍 Env: ${config.env}`);
  });
}

bootstrap().catch((e) => {
  console.error("Fatal bootstrap error:", e);
  process.exit(1);
});
