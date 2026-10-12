import { Component, type ReactNode } from "react";

/**
 * Shows the error instead of a blank page. Pages that fail to load (no connection, a server
 * error) also land here, so the message comes first and the technical details are folded away.
 */
export class CrashScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main style={{ maxWidth: 760, margin: "48px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
        <h1 style={{ color: "#0a2463" }}>Something went wrong</h1>
        <p>{error.message || "This page couldn't be shown."}</p>
        <p>Check your connection and try again. If it keeps happening, copy the details below when reporting it.</p>
        <p style={{ display: "flex", gap: 12 }}>
          <button onClick={() => location.reload()}>Try again</button>
          <button onClick={() => location.assign("/")}>Go to the home page</button>
        </p>
        <details>
          <summary>Details</summary>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f4f5f7", padding: 16, borderRadius: 8, fontSize: 13 }}>{error.stack ?? error.message}</pre>
        </details>
      </main>
    );
  }
}
