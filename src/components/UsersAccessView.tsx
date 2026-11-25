import React, { useState } from 'react';
import { Check, Shield } from 'lucide-react';
import { updateOwnProfile, updateUserAccess } from '../services/complianceService';
import {
  DEPARTMENTS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  UserPublic,
  UserRole,
} from '../types/compliance';
import { RoleDisplay } from './StatusText';

interface UsersAccessViewProps {
  profile: UserPublic;
  users: UserPublic[];
}

export function UsersAccessView({ profile, users }: UsersAccessViewProps) {
  const isAdmin = profile.role === 'admin';
  const [ownName, setOwnName] = useState(profile.displayName);
  const [ownJob, setOwnJob] = useState(profile.jobTitle);
  const [savingOwn, setSavingOwn] = useState(false);
  const [savedOwnOk, setSavedOwnOk] = useState(false);

  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<UserRole>('leitor');
  const [draftDept, setDraftDept] = useState(DEPARTMENTS[0]);
  const [draftJob, setDraftJob] = useState('');
  const [draftActive, setDraftActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [error, setError] = useState('');

  const rolesList: UserRole[] = ['admin', 'aprovador', 'editor', 'leitor'];

  function startEditUser(user: UserPublic) {
    setEditingUid(user.uid);
    setDraftRole(user.role);
    setDraftDept(user.department || DEPARTMENTS[0]);
    setDraftJob(user.jobTitle || 'Colaborador');
    setDraftActive(user.active);
    setError('');
  }

  async function saveUserEdit(targetUid: string) {
    setSavingUser(true);
    setError('');
    try {
      await updateUserAccess(
        targetUid,
        {
          role: draftRole,
          department: draftDept,
          jobTitle: draftJob || 'Colaborador',
          active: draftActive,
        },
        profile.uid
      );
      setEditingUid(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao atualizar permissões.'
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSaveOwnProfile(e: React.FormEvent) {
    e.preventDefault();
    if (ownName.trim().length < 2) return;
    setSavingOwn(true);
    setSavedOwnOk(false);
    setError('');
    try {
      await updateOwnProfile(profile.uid, ownName, ownJob || 'Colaborador');
      setSavedOwnOk(true);
      setTimeout(() => setSavedOwnOk(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao atualizar seus dados.'
      );
    } finally {
      setSavingOwn(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Matriz de Níveis de Acesso (RBAC)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {rolesList.map((role) => (
            <div key={role} className="p-5 space-y-2">
              <RoleDisplay role={role} />
              <p className="text-xs text-slate-600 leading-relaxed">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Meu Perfil</h2>
          <p className="text-xs text-slate-500">
            Seu nível de acesso atual é{' '}
            <strong className="text-slate-900">{ROLE_LABELS[profile.role]}</strong> ·{' '}
            {profile.department}.
          </p>
        </div>

        <form
          onSubmit={handleSaveOwnProfile}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Nome Completo</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={ownName}
              onChange={(e) => setOwnName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Cargo / Função</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={ownJob}
              onChange={(e) => setOwnJob(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingOwn}
              className="px-4 py-1.5 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
            >
              {savingOwn ? 'Salvando...' : 'Atualizar Perfil'}
            </button>
            {savedOwnOk && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="w-3.5 h-3.5" />
                Salvo
              </span>
            )}
          </div>
        </form>
      </section>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
          {error}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Usuários Cadastrados ({users.length})
            </h2>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'Como Administrador, você pode atribuir níveis de acesso e departamentos.'
                : 'Apenas Administradores podem alterar níveis de acesso de outros usuários.'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Colaborador</th>
                <th className="py-2.5 px-4">Departamento</th>
                <th className="py-2.5 px-4">Cargo</th>
                <th className="py-2.5 px-4">Nível de Acesso</th>
                <th className="py-2.5 px-4">Situação</th>
                {isAdmin && <th className="py-2.5 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map((u) => {
                const isEditing = editingUid === u.uid;
                return (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {u.displayName}
                      {u.uid === profile.uid && (
                        <span className="text-xs font-normal text-slate-500 ml-1.5">
                          (você)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {isEditing ? (
                        <select
                          value={draftDept}
                          onChange={(e) => setDraftDept(e.target.value)}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                        >
                          {DEPARTMENTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        u.department
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draftJob}
                          onChange={(e) => setDraftJob(e.target.value)}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded w-40"
                        />
                      ) : (
                        u.jobTitle
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select
                          value={draftRole}
                          onChange={(e) => setDraftRole(e.target.value as UserRole)}
                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                        >
                          {rolesList.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <RoleDisplay role={u.role} />
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {isEditing ? (
                        <label className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={draftActive}
                            disabled={u.uid === profile.uid}
                            onChange={(e) => setDraftActive(e.target.checked)}
                          />
                          <span>Ativo</span>
                        </label>
                      ) : u.active ? (
                        <span className="text-emerald-700 font-medium">Ativo</span>
                      ) : (
                        <span className="text-rose-700 font-medium">Inativo</span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingUid(null)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={savingUser}
                              onClick={() => saveUserEdit(u.uid)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800 disabled:opacity-50"
                            >
                              Salvar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditUser(u)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            Alterar Acesso
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
