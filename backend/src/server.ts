import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocketServer } from "./realtime/socket";

const app = createApp();
const httpServer = http.createServer(app);

initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
