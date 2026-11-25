import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { ApprovalsQueueView } from './components/ApprovalsQueueView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { OverviewView } from './components/OverviewView';
import { PacDetailView } from './components/PacDetailView';
import { PacEditorModal } from './components/PacEditorModal';
import { PacsView } from './components/PacsView';
import { PopDetailView } from './components/PopDetailView';
import { PopEditorModal } from './components/PopEditorModal';
import { PopsView } from './components/PopsView';
import { UsersAccessView } from './components/UsersAccessView';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signOutUser,
  testConnection,
} from './firebase';
import { ensureUserProfile } from './services/complianceService';
import {
  PacDocument,
  PopDocument,
  ROLE_LABELS,
  UserPublic,
} from './types/compliance';

type NavTab = 'overview' | 'pops' | 'pacs' | 'approvals' | 'users';

function WorkspaceApp() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [profileError, setProfileError] = useState('');

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedPopId, setSelectedPopId] = useState<string | null>(null);
  const [selectedPacId, setSelectedPacId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [popsTeam, setPopsTeam] = useState<PopDocument[]>([]);
  const [popsOwn, setPopsOwn] = useState<PopDocument[]>([]);
  const [popsLoaded, setPopsLoaded] = useState(false);

  const [pacsTeam, setPacsTeam] = useState<PacDocument[]>([]);
  const [pacsOwn, setPacsOwn] = useState<PacDocument[]>([]);
  const [pacsLoaded, setPacsLoaded] = useState(false);

  const [users, setUsers] = useState<UserPublic[]>([]);

  const [popModalOpen, setPopModalOpen] = useState(false);
  const [editingPop, setEditingPop] = useState<PopDocument | null>(null);

  const [pacModalOpen, setPacModalOpen] = useState(false);
  const [preselectedPopForPac, setPreselectedPopForPac] =
    useState<PopDocument | null>(null);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setPopsTeam([]);
        setPopsOwn([]);
        setPacsTeam([]);
        setPacsOwn([]);
        setUsers([]);
        setAuthReady(true);
        return;
      }

      try {
        const initialProfile = await ensureUserProfile(user);
        setProfile(initialProfile);
      } catch (err) {
        setProfileError(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar perfil do usuário.'
        );
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const uid = firebaseUser.uid;
    const unsubProfile = onSnapshot(
      doc(db, 'users_public', uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserPublic);
        }
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, `users_public/${uid}`)
    );

    const qPopsTeam = query(
      collection(db, 'pops'),
      where('status', 'in', [
        'vigente',
        'em_revisao',
        'aguardando_aprovacao',
        'obsoleto',
      ])
    );
    const unsubPopsTeam = onSnapshot(
      qPopsTeam,
      (snap) => {
        setPopsTeam(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PopDocument, 'id'>),
          }))
        );
        setPopsLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'pops')
    );

    const qPopsOwn = query(
      collection(db, 'pops'),
      where('ownerId', '==', uid)
    );
    const unsubPopsOwn = onSnapshot(
      qPopsOwn,
      (snap) => {
        setPopsOwn(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PopDocument, 'id'>),
          }))
        );
        setPopsLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'pops')
    );

    const qPacsTeam = query(
      collection(db, 'pacs'),
      where('status', 'in', [
        'aberto',
        'em_execucao',
        'aguardando_verificacao',
        'concluido',
      ])
    );
    const unsubPacsTeam = onSnapshot(
      qPacsTeam,
      (snap) => {
        setPacsTeam(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PacDocument, 'id'>),
          }))
        );
        setPacsLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'pacs')
    );

    const qPacsOwn = query(
      collection(db, 'pacs'),
      where('ownerId', '==', uid)
    );
    const unsubPacsOwn = onSnapshot(
      qPacsOwn,
      (snap) => {
        setPacsOwn(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PacDocument, 'id'>),
          }))
        );
        setPacsLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'pacs')
    );

    const qUsers = query(
      collection(db, 'users_public'),
      where('active', '==', true)
    );
    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserPublic)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(list);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'users_public')
    );

    return () => {
      unsubProfile();
      unsubPopsTeam();
      unsubPopsOwn();
      unsubPacsTeam();
      unsubPacsOwn();
      unsubUsers();
    };
  }, [authReady, firebaseUser]);

  const pops = useMemo(() => {
    const map = new Map<string, PopDocument>();
    popsTeam.forEach((p) => map.set(p.id, p));
    popsOwn.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [popsTeam, popsOwn]);

  const pacs = useMemo(() => {
    const map = new Map<string, PacDocument>();
    pacsTeam.forEach((p) => map.set(p.id, p));
    pacsOwn.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [pacsTeam, pacsOwn]);

  const selectedPop = useMemo(
    () => pops.find((p) => p.id === selectedPopId) || null,
    [pops, selectedPopId]
  );

  const selectedPac = useMemo(
    () => pacs.find((p) => p.id === selectedPacId) || null,
    [pacs, selectedPacId]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Carregando ambiente...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <LoginScreen />;
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Preparando seu perfil corporativo
          </h2>
          <p className="text-sm text-slate-600">
            {profileError || 'Sincronizando permissões de acesso...'}
          </p>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (!profile.active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Acesso suspenso
          </h2>
          <p className="text-sm text-slate-600">
            Seu usuário foi marcado como inativo por um Administrador. Solicite a reativação junto à Garantia da Qualidade.
          </p>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
          >
            Encerrar Sessão
          </button>
        </div>
      </div>
    );
  }

  const canCreate = profile.role !== 'leitor';
  const pendingApprovalsCount =
    pops.filter(
      (p) => p.status === 'em_revisao' || p.status === 'aguardando_aprovacao'
    ).length +
    pacs.filter((p) => p.status === 'aguardando_verificacao').length;

  const navItems: {
    id: NavTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'pops', label: 'POPs', icon: FileText, count: pops.length },
    { id: 'pacs', label: 'PACs', icon: ClipboardList, count: pacs.length },
    {
      id: 'approvals',
      label: 'Aprovações',
      icon: ShieldCheck,
      count: pendingApprovalsCount,
    },
    { id: 'users', label: 'Usuários e Acessos', icon: Users },
  ];

  function handleSelectTab(tab: NavTab) {
    setActiveTab(tab);
    setSelectedPopId(null);
    setSelectedPacId(null);
    setMobileNavOpen(false);
  }

  function handleOpenPop(popId: string) {
    setActiveTab('pops');
    setSelectedPopId(popId);
    setSelectedPacId(null);
  }

  function handleOpenPac(pacId: string) {
    setActiveTab('pacs');
    setSelectedPacId(pacId);
    setSelectedPopId(null);
  }

  const breadcrumbText = (() => {
    if (activeTab === 'pops') {
      return selectedPop
        ? `QualiNorma / POPs / ${selectedPop.code}`
        : 'QualiNorma / Procedimentos Operacionais Padrão (POPs)';
    }
    if (activeTab === 'pacs') {
      return selectedPac
        ? `QualiNorma / PACs / ${selectedPac.code}`
        : 'QualiNorma / Planos de Ação Corretiva (PACs)';
    }
    if (activeTab === 'approvals') {
      return 'QualiNorma / Fila de Aprovações e Verificações';
    }
    if (activeTab === 'users') {
      return 'QualiNorma / Usuários e Níveis de Acesso';
    }
    return 'QualiNorma / Visão Geral';
  })();

  const primaryActionButton = (() => {
    if (!canCreate) return null;
    if (activeTab === 'pacs') {
      return (
        <button
          type="button"
          onClick={() => {
            setPreselectedPopForPac(null);
            setPacModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo PAC
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setEditingPop(null);
          setPopModalOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
      >
        <Plus className="w-4 h-4" />
        Novo POP
      </button>
    );
  })();

  const SidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-slate-200 w-64">
      <div>
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            QualiNorma
          </span>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1 text-slate-500 hover:text-slate-800"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono tabular-nums text-xs ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {profile.displayName}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {ROLE_LABELS[profile.role]} · {profile.department}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOutUser()}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Encerrar Sessão
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:block shrink-0">{SidebarContent}</aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full">{SidebarContent}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              aria-label="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs sm:text-sm font-medium text-slate-600 truncate">
              {breadcrumbText}
            </span>
          </div>

          <div className="shrink-0">{primaryActionButton}</div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              profile={profile}
              pops={pops}
              pacs={pacs}
              loading={!popsLoaded && !pacsLoaded}
              onSelectPop={handleOpenPop}
              onSelectPac={handleOpenPac}
              onOpenNewPop={() => {
                setEditingPop(null);
                setPopModalOpen(true);
              }}
              onOpenNewPac={() => {
                setPreselectedPopForPac(null);
                setPacModalOpen(true);
              }}
              onNavigateTab={(t) => handleSelectTab(t)}
            />
          )}

          {activeTab === 'pops' &&
            (selectedPop ? (
              <PopDetailView
                pop={selectedPop}
                profile={profile}
                onBack={() => setSelectedPopId(null)}
                onEditDraft={(pop) => {
                  setEditingPop(pop);
                  setPopModalOpen(true);
                }}
                onCreateLinkedPac={(pop) => {
                  setPreselectedPopForPac(pop);
                  setPacModalOpen(true);
                }}
              />
            ) : (
              <PopsView
                profile={profile}
                pops={pops}
                loading={!popsLoaded}
                onSelectPop={(id) => setSelectedPopId(id)}
                onOpenNewPop={() => {
                  setEditingPop(null);
                  setPopModalOpen(true);
                }}
              />
            ))}

          {activeTab === 'pacs' &&
            (selectedPac ? (
              <PacDetailView
                pac={selectedPac}
                profile={profile}
                onBack={() => setSelectedPacId(null)}
                onOpenPop={handleOpenPop}
              />
            ) : (
              <PacsView
                profile={profile}
                pacs={pacs}
                loading={!pacsLoaded}
                onSelectPac={(id) => setSelectedPacId(id)}
                onOpenNewPac={() => {
                  setPreselectedPopForPac(null);
                  setPacModalOpen(true);
                }}
              />
            ))}

          {activeTab === 'approvals' && (
            <ApprovalsQueueView
              profile={profile}
              pops={pops}
              pacs={pacs}
              onSelectPop={handleOpenPop}
              onSelectPac={handleOpenPac}
            />
          )}

          {activeTab === 'users' && (
            <UsersAccessView profile={profile} users={users} />
          )}
        </main>
      </div>

      {popModalOpen && (
        <PopEditorModal
          profile={profile}
          editingPop={editingPop}
          onClose={() => {
            setPopModalOpen(false);
            setEditingPop(null);
          }}
          onSaved={(popId) => {
            setPopModalOpen(false);
            setEditingPop(null);
            handleOpenPop(popId);
          }}
        />
      )}

      {pacModalOpen && (
        <PacEditorModal
          profile={profile}
          users={users}
          pops={pops}
          preselectedPop={preselectedPopForPac}
          onClose={() => {
            setPacModalOpen(false);
            setPreselectedPopForPac(null);
          }}
          onSaved={(pacId) => {
            setPacModalOpen(false);
            setPreselectedPopForPac(null);
            handleOpenPac(pacId);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
