"use client";

import React from "react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean };

/**
 * Guards modal/sheet content so a render error can never leave the user
 * stuck on an empty blurred overlay — the sheet's close controls still work.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Sheet content error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <p className="py-6 text-center text-sm text-white/60">
            Something went wrong. Close this and try again.
          </p>
        )
      );
    }
    return this.props.children;
  }
}
