"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class UploadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[UploadErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-500/30 bg-red-950/30 p-6 text-center">
          <p className="text-sm font-medium text-red-300">
            Algo deu errado na área de upload.
          </p>
          <p className="text-xs text-red-400/80">
            {this.state.error?.message ?? "Erro desconhecido"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-800/50"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
