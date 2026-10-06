import { Component, type ReactNode } from "react";

/** Shows the error instead of a blank page, so a crash can be reported and fixed. */
export class CrashScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main style={{ maxWidth: 760, margin: "48px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ color: "#0a2463" }}>BalikGamit hit an error</h1>
        <p>Copy the message below when reporting it.</p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f4f5f7", padding: 16, borderRadius: 8, fontSize: 13 }}>
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("balikgamit.demoUser");
            } catch {
              /* storage blocked */
            }
            location.assign("/");
          }}
        >
          Clear demo sign-in and reload
        </button>
      </main>
    );
  }
}
