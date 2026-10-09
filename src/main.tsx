import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { CrashScreen } from "./components/CrashScreen";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CrashScreen>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </CrashScreen>
  </StrictMode>,
);
