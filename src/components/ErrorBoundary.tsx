import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getFirebaseUpgradeUrl } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
  isDailyQuotaSpecific: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isQuotaError: false,
      isDailyQuotaSpecific: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Erro inesperado na aplicação.';
    let readable = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.error) {
        readable = `${parsed.error} (Operação: ${parsed.operationType || 'desconhecida'}, Caminho: ${parsed.path || '—'})`;
      }
    } catch {
      // Not JSON, keep raw message
    }

    const isQuotaError = readable.includes('Quota exceeded');
    const isDailyQuotaSpecific = readable.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    );

    return {
      hasError: true,
      message: readable,
      isQuotaError,
      isDailyQuotaSpecific,
    };
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                Falha na operação de dados
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {this.state.isQuotaError
                  ? 'A cota gratuita diária do Firestore foi atingida. O limite é reiniciado automaticamente no dia seguinte.'
                  : 'Ocorreu uma restrição de segurança ou erro de comunicação com o banco de dados.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono text-xs text-slate-700 break-words">
            {this.state.message}
          </div>

          {this.state.isDailyQuotaSpecific && (
            <p className="text-xs text-slate-600">
              Para ampliar a cota do banco de dados, acesse o{' '}
              <a
                href={getFirebaseUpgradeUrl()}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline hover:text-blue-800"
              >
                Console do Firebase (Firestore)
              </a>
              .
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicação
            </button>
          </div>
        </div>
      </div>
    );
  }
}
