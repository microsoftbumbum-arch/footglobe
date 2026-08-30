import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { startProdServer } from "vinext/server/prod-server";

try {
  loadEnvFile(resolve(process.cwd(), ".env"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const parsedPort = Number.parseInt(process.env.PORT ?? "8080", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 8080;
const host = "0.0.0.0";

await startProdServer({
  port,
  host,
  outDir: resolve(process.cwd(), "dist"),
});
