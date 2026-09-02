# VitrineAI

Catálogo público com painel administrativo protegido por senha, em português.

## Funciona nesta versão

- Catálogo público em `/`, com busca, categorias e páginas individuais de produtos.
- Painel em `/admin`: cadastro e edição de produtos, até 5 fotos por produto, preço opcional, medidas, cores, ordem e publicação/rascunho.
- Configurações: nome, apresentação, logo, foto de destaque, cor, WhatsApp opcional e visibilidade dos preços.
- Produtos/configurações salvos em D1; fotos salvas em R2. Rascunhos e suas fotos não são entregues a visitantes.
- Senha exclusiva do administrador, sessão de 8 horas, saída e troca de senha com revogação das outras sessões.
- Primeiro acesso e recuperação em `/configurar-acesso`: exclusivamente pela identidade ChatGPT do proprietário configurada no servidor. O login cotidiano usa somente a senha do site.

O Studio de anúncios está em `/admin/studio` e continua sendo demonstrativo: geração de imagens/textos por IA, pesquisa automática, análises e contadores ainda não estão conectados a serviços reais. O catálogo não processa pagamentos nem publica anúncios em marketplaces.

## Teste local

Requisitos: Node.js >=22.13 e pnpm (validado com 11.19.0).

```sh
pnpm install --frozen-lockfile
# Copie .env.example para .env (somente desenvolvimento).
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.local.json
pnpm dev
```

Abra o endereço impresso no terminal. Para configurar a primeira senha local, visite `/configurar-acesso` e use o login de desenvolvimento do Sites. O e-mail local é `seedy@sites.test`; nunca use esse proprietário em produção.

```sh
pnpm exec tsc --noEmit
pnpm build
# Com o servidor local em execução e banco de testes:
node scripts/test-catalog.mjs
```

O teste de integração é exclusivamente local: configura uma senha aleatória de teste, cria produtos de verificação, volta os produtos para rascunho e encerra as sessões. Não execute contra dados locais que precise preservar. Ele verifica acesso anônimo, autorização, CSRF, uploads, persistência, rascunhos, metadados, mudança de senha e limitação de tentativas.

## Publicação e segurança

- Stack: Vinext/React/TypeScript, Sites/Cloudflare Workers. Não é um projeto estático para GitHub Pages.
- `.openai/hosting.json` preserva o projeto Sites existente e declara `DB` (D1) e `BUCKET` (R2). Sites provisiona os recursos.
- Migrações Drizzle em `drizzle/`; não modifique migrações já aplicadas. Alterações de esquema são geradas com `pnpm exec drizzle-kit generate`.
- Configure `SITE_URL` com a origem HTTPS publicada (sem barra final) e `OWNER_EMAIL` com a conta proprietária real no ambiente de produção. Não copie `.env` para a publicação.
- O login usa scrypt (N=16384, r=8, p=5) com salt aleatório; o banco guarda somente hashes de senha e sessão. Cookies de produção são `__Host-`, Secure, HttpOnly, SameSite=Strict. As verificações de autorização ocorrem no servidor.
- A identidade de recuperação depende dos cabeçalhos autenticados confiáveis do dispatcher do Sites. Em outra hospedagem, será necessário integrar um provedor de identidade confiável; nunca aceite esses cabeçalhos de visitantes diretamente.
- Uploads aceitam JPG/PNG/WEBP de até 8 MB; arquivos SVG são rejeitados. Fotos removidas de um formulário deixam de ser referenciadas após salvar, mas seus arquivos são preservados no armazenamento. O painel não tem exclusão permanente.
- Salvar um produto marcado como publicado, imagens da loja ou número de WhatsApp torna essas informações públicas. Não cadastre dados pessoais privados nos campos do catálogo.
- O repositório GitHub pode continuar privado mesmo com o catálogo público.

Referências técnicas: [armazenamento de senhas — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [crypto no Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).
