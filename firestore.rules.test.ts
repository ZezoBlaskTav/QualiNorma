/**
 * Dirty Dozen Security Test Matrix for Firestore Rules (POPs & PACs).
 * Designed for execution with @firebase/rules-unit-testing against the Firebase Emulator.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Auto-promoção na criação de perfil',
    collectionPath: 'users_public/user_attacker',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      uid: 'user_attacker',
      displayName: 'Atacante',
      role: 'admin',
      department: 'Produção',
      jobTitle: 'Operador',
      active: true,
    },
  },
  {
    id: 2,
    name: 'Escalação de privilégio em update de perfil',
    collectionPath: 'users_public/user_leitor',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { role: 'aprovador' },
  },
  {
    id: 3,
    name: 'Leitura de PII de terceiros',
    collectionPath: 'users_private/user_victim',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    payload: {},
  },
  {
    id: 4,
    name: 'Shadow Field Injection em POP',
    collectionPath: 'pops/pop_shadow_test',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      code: 'POP-GQ-999',
      title: 'POP Teste',
      isSuperApproved: true,
    },
  },
  {
    id: 5,
    name: 'Identity Spoofing na criação de POP',
    collectionPath: 'pops/pop_spoof',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      code: 'POP-GQ-998',
      ownerId: 'another_user_uid',
    },
  },
  {
    id: 6,
    name: 'Timestamp Forgery em POP',
    collectionPath: 'pops/pop_time_forge',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    id: 7,
    name: 'State Shortcutting: Editor aprovando POP diretamente para vigente',
    collectionPath: 'pops/pop_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { status: 'vigente' },
  },
  {
    id: 8,
    name: 'Alteração de versão imutável de POP',
    collectionPath: 'pops/pop_1/versions/v1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { title: 'Versão adulterada' },
  },
  {
    id: 9,
    name: 'Resource Poisoning com ID acima de 128 caracteres',
    collectionPath: `pops/${'a'.repeat(200)}`,
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { title: 'Payload gigante' },
  },
  {
    id: 10,
    name: 'Leitura de rascunho privado de outro autor',
    collectionPath: 'pops/pop_private_draft',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    payload: {},
  },
  {
    id: 11,
    name: 'Modificação de PAC após estado terminal concluido',
    collectionPath: 'pacs/pac_completed',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { status: 'em_execucao' },
  },
  {
    id: 12,
    name: 'Escrita com e-mail não verificado',
    collectionPath: 'pacs/pac_unverified',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { code: 'PAC-2026-999' },
  },
];
