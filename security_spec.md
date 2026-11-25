# Especificação de Segurança Zero-Trust (POPs & PACs)

## 1. Invariantes de Dados (Data Invariants)
1. **Isolamento de PII (Split Collection)**: E-mails de usuários são armazenados exclusivamente em `users_private/{userId}`, legíveis e graváveis apenas pelo próprio usuário ou por um `admin`. `users_public/{userId}` contém apenas metadados organizacionais (`displayName`, `role`, `department`, `jobTitle`, `active`).
2. **Prevenção de Auto-Escalação de Privilégio (RBAC)**: Na criação de `users_public/{userId}`, usuários comuns só podem criar seu perfil com `role == 'leitor'` e `active == true`. Apenas um administrador (`isAdmin()`) pode alterar `role`, `department` ou `active` de qualquer usuário.
3. **Integridade de Identidade e Imutabilidade**: Todo documento criado (`pops`, `pacs`, `versions`, `approvals`) exige `ownerId == request.auth.uid` (ou `actorId == request.auth.uid`), e campos imutáveis (`ownerId`, `createdAt`) não podem ser alterados em updates.
4. **Integridade Temporal**: `createdAt` na criação e `updatedAt` na atualização devem ser estritamente iguais a `request.time`.
5. **Bloqueio de Estado Terminal e Transições de Fluxo**:
   - POPs `obsoleto` não podem ser editados por não-administradores.
   - Aprovação final (`vigente`) ou reprovação de POPs exige papel `aprovador` ou `admin`.
   - Publicação de versão (`pops/{popId}/versions/{versionId}`) é imutável (proíbe `update` e `delete`), exige existir o POP pai (`existsAfter` / `exists`) e papel `aprovador` ou `admin`.
   - PACs `concluido` ou `cancelado` são bloqueados para alterações de não-administradores. Verificação de eficácia (`concluido`) exige `aprovador` ou `admin`.
6. **Master Gate e Consultas Seguras (`allow list`)**: Nenhuma regra `allow list` utiliza `get()` ou `exists()` nem permite leitura irrestrita (`if isSignedIn()`), validando sempre campos de `resource.data`.

## 2. Os 12 Payloads Maliciosos ("Dirty Dozen")
1. **Auto-promoção na criação de perfil**: Usuário comum cria `users_public/{uid}` com `role: 'admin'`. -> `PERMISSION_DENIED`.
2. **Escalação de privilégio em update**: Usuário com papel `leitor` tenta atualizar seu próprio `users_public/{uid}` mudando `role: 'aprovador'`. -> `PERMISSION_DENIED`.
3. **Vazamento de PII entre usuários**: Usuário A tenta `get` em `users_private/{userB}`. -> `PERMISSION_DENIED`.
4. **Shadow Field Injection (Ghost Field)**: Editor envia campo extra `isSuperApproved: true` ao criar um POP. -> `PERMISSION_DENIED`.
5. **Identity Spoofing**: Usuário A tenta criar um POP definindo `ownerId: 'uid_do_usuario_B'`. -> `PERMISSION_DENIED`.
6. **Timestamp Forgery**: Usuário tenta criar um POP com `createdAt` retroativo manual ao invés de `serverTimestamp()`. -> `PERMISSION_DENIED`.
7. **State Shortcutting (Aprovação sem Permissão)**: Usuário `editor` tenta atualizar um POP de `em_revisao` diretamente para `vigente`. -> `PERMISSION_DENIED`.
8. **Alteração de Versão Histórica Imutável**: Usuário tenta fazer `update` ou `delete` em `/pops/{popId}/versions/{versionId}`. -> `PERMISSION_DENIED`.
9. **Resource Poisoning / ID Gigante**: Usuário tenta criar documento em `/pops/{id_de_200_chars}` ou `title` com 5000 caracteres. -> `PERMISSION_DENIED`.
10. **Leitura de Rascunho Privado Alheio**: Usuário B tenta ler ou listar POP com `status: 'rascunho'` pertencente ao Usuário A. -> `PERMISSION_DENIED`.
11. **Modificação Pós-Terminal**: Usuário `editor` tenta editar um PAC já `concluido`. -> `PERMISSION_DENIED`.
12. **Email Não Verificado**: Usuário com `email_verified: false` tentando gravar em `pops` ou `pacs`. -> `PERMISSION_DENIED`.
