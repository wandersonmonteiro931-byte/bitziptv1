import React from "react";

type State = { hasError: boolean; message: string };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Falha inesperada ao abrir o aplicativo.",
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("WMCPLAYER runtime error:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-dvh items-center justify-center bg-black p-5 text-white">
        <section className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-6 text-center shadow-2xl">
          <h1 className="text-xl font-bold">Não foi possível abrir esta tela</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            O aplicativo encontrou uma falha local. Toque em recarregar para abrir novamente.
          </p>
          {this.state.message && (
            <p className="mt-3 break-words rounded-lg bg-black/40 p-3 text-xs text-zinc-500">{this.state.message}</p>
          )}
          <button onClick={this.reload} className="mt-5 w-full rounded-xl bg-red-600 py-3 font-bold text-white">
            Recarregar aplicativo
          </button>
        </section>
      </main>
    );
  }
}
