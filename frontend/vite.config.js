import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Read PORT from backend/.env so proxy stays in sync (e.g. 3001)
  const backendEnv = loadEnv(mode, path.resolve(__dirname, "../backend"), "");
  const apiPort = backendEnv.PORT || "3001";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          timeout: 30 * 60 * 1000,
        },
      },
    },
  };
});
