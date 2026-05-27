import { createApp } from "./app";
import { config } from "./config";

const app = createApp();
app.listen(config.port, () => {
  console.log(`[financas-api] a escutar em http://localhost:${config.port}`);
});
