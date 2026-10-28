import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

// A render error shows a plain message with a reload button, never a blank page or a verdict we cannot trust.
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Echt page error", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="screen" role="alert">
          <h1>Something went wrong on this page</h1>
          <p>Nothing has been changed. Reload the page to try again.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
