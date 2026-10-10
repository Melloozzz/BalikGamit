import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { CrashScreen } from "./components/CrashScreen";
import { supabaseConfigured } from "./lib/supabase";
// Fonts are bundled with the app (no Google Fonts request), so a slow or blocked
// network can't hold the page on a blank screen.
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-sans/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/site.css";
import "./styles/app.css";
import "./styles/admin.css";
import "./styles/mobile.css";

/** Shown instead of the app when .env.local is missing, so a fresh clone explains itself. */
function SetupNeeded() {
  return (
    <main style={{ maxWidth: 560, margin: "64px auto", padding: "0 16px", fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24 }}>BalikGamit needs its database settings</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code> in the project folder, fill in <code>VITE_SUPABASE_URL</code> and{" "}
        <code>VITE_SUPABASE_ANON_KEY</code> (ask the project lead), then stop and restart <code>npm run dev</code>.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {supabaseConfigured ? (
      <CrashScreen>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </CrashScreen>
    ) : (
      <SetupNeeded />
    )}
  </StrictMode>,
);
