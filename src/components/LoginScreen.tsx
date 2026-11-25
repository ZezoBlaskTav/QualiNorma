import { useState } from 'react';
import { FileCheck2, GitCompareArrows, LockKeyhole, ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, UserRole } from '../types/compliance';

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível concluir o acesso.';
      setError(msg);
      setLoading(false);
    }
  }

  const rolesOrder: UserRole[] = ['admin', 'aprovador', 'editor', 'leitor'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          QualiNorma
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#recursos" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Recursos
          </a>
          <a href="#niveis-acesso" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Níveis de Acesso
          </a>
        </nav>
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? 'Conectando...' : 'Entrar com Google'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 lg:px-10 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <section id="recursos" className="lg:col-span-7 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-medium text-blue-700 tracking-wide">
              Gestão Documental e Ações Corretivas
            </p>
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-tight">
              Controle de POPs e implantação de PACs com rastreabilidade completa.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Centralize Procedimentos Operacionais Padrão e Planos de Ação Corretiva em um fluxo auditável com aprovação em etapas, histórico imutável de versões e permissões por perfil de usuário.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            <div className="p-5 flex items-start gap-4">
              <FileCheck2 className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  Fluxo de Aprovação e Verificação de Eficácia
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Transições controladas de Rascunho para Revisão Técnica, Aprovação Final e Vigência, além de checklist de implantação e verificação de eficácia para cada PAC.
                </p>
              </div>
            </div>

            <div className="p-5 flex items-start gap-4">
              <GitCompareArrows className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  Histórico de Versões e Comparativo entre Revisões
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cada publicação grava uma cópia imutável da versão aprovada com comparador lado a lado para auditar alterações de objetivo, abrangência e etapas operacionais.
                </p>
              </div>
            </div>

            <div className="p-5 flex items-start gap-4">
              <LockKeyhole className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  Segurança por Nível de Acesso (RBAC)
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Permissões aplicadas diretamente nas regras do banco de dados para Administradores, Aprovadores, Elaboradores e Operadores.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="niveis-acesso" className="lg:col-span-5 flex flex-col justify-between bg-white border border-slate-200 rounded-lg p-6 lg:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-semibold">Acesso Corporativo Autenticado</span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Acessar Ambiente de Trabalho
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Entre com sua conta Google corporativa para carregar seus procedimentos, pendências de aprovação e planos de ação.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-700">
              Perfis suportados na plataforma
            </h3>
            <dl className="divide-y divide-slate-100">
              {rolesOrder.map((role) => (
                <div key={role} className="py-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold text-slate-900">
                    {ROLE_LABELS[role]}
                  </dt>
                  <dd className="text-xs text-slate-600 leading-relaxed">
                    {ROLE_DESCRIPTIONS[role]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? 'Autenticando...' : 'Entrar com Conta Google'}
          </button>
        </section>
      </main>
    </div>
  );
}
