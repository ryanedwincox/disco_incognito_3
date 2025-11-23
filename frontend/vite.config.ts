import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [vue()],
    server: {
      port: parseInt(env.VITE_PORT || "3000"),
      host: "0.0.0.0",
      strictPort: true
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV || "development")
    },
    test: {
      globals: true,
      environment: "jsdom",
      include: ["tests/unit/**/*.test.ts"],
      exclude: ["tests/e2e/**/*"],
      env: {
        VITE_TEST_MODE: "true"
      }
    }
  };
});
