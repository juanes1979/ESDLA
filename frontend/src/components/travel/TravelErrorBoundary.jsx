/**
 * Error Boundary que captura crashes de React y los muestra en pantalla en
 * lugar de dejar al usuario con una pantalla en blanco.
 *
 * Imprime también el error y el component stack en la consola para poder
 * depurarlos rápidamente.
 */
import React from 'react';

class TravelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('[TravelErrorBoundary] Caught error:', error);
    // eslint-disable-next-line no-console
    console.error('[TravelErrorBoundary] Component stack:', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, errorInfo } = this.state;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(var(--background))]" data-testid="travel-error-boundary">
        <div className="max-w-3xl w-full card-parchment rounded-lg p-6 border-2 border-red-500/50">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-4xl">⚠️</div>
            <div>
              <h2 className="font-heading text-2xl text-red-400 mb-1">Algo se ha roto en el viaje</h2>
              <p className="text-sm text-muted-foreground">
                Un componente del sistema de viaje ha lanzado un error y la pantalla quedaba en blanco.
                Aquí tienes el detalle para que podamos arreglarlo.
              </p>
            </div>
          </div>

          <div className="bg-black/40 rounded p-3 mb-3 font-mono text-xs text-red-300 break-all" data-testid="travel-error-message">
            <strong>{error?.name || 'Error'}:</strong> {error?.message || String(error)}
          </div>

          {error?.stack && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Stack trace</summary>
              <pre className="mt-2 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap text-orange-300/80 max-h-64">
                {error.stack}
              </pre>
            </details>
          )}

          {errorInfo?.componentStack && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Component stack (React)</summary>
              <pre className="mt-2 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap text-blue-300/80 max-h-64">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-[hsl(var(--gold))]/20 hover:bg-[hsl(var(--gold))]/30 text-[hsl(var(--gold))] rounded text-sm"
              data-testid="travel-error-retry"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-border/50 hover:bg-black/20 rounded text-sm"
              data-testid="travel-error-reload"
            >
              Recargar la página
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-4 py-2 border border-border/50 hover:bg-black/20 rounded text-sm"
              data-testid="travel-error-home"
            >
              Volver al inicio
            </button>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground italic">
            Copia este mensaje y mándalo a quien gestiona la app para que lo arregle rápido.
          </p>
        </div>
      </div>
    );
  }
}

export default TravelErrorBoundary;
