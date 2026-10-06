import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React app is built to /dist and served as static assets by the Cloudflare Worker.
// During `npm run dev`, /api calls are proxied to `wrangler dev` (port 8787).
export default defineConfig({
  plugins: [react()],
  // Pre-bundle every runtime dependency at startup. Otherwise Vite discovers some of them
  // on first page load and re-bundles mid-session, which can leave an open tab running
  // two copies of React ("destroy is not a function", "Invalid hook call").
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "react-router",
      "@supabase/supabase-js",
      "zod",
    ],
  },
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
});
