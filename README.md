# VitrineAI

Protótipo de um estúdio de anúncios para Shopee e Mercado Livre, em português.

## Estado atual

Esta versão demonstra a interface e o fluxo de trabalho. **Ainda não é uma automação de IA completa.**

- Navegação entre cadastro, laboratório de imagens, títulos/descrições, consultor e análise.
- Seleção local de uma foto (o arquivo não é enviado nem armazenado em servidor).
- Exemplos visuais e textos demonstrativos, não resultados de geração real.
- Notas, contadores de uso e análises são dados de demonstração.
- Alguns botões ainda são somente visuais. Não há banco de dados, geração de imagens, pesquisa automática, cobrança ou publicação em marketplaces.

## Testar no computador

Requisitos: Node.js 22.13 ou superior e pnpm. A instalação original foi validada com pnpm 11.19.0.

```sh
git clone https://github.com/guiviqunha/vitrineai.git
cd vitrineai
pnpm install --frozen-lockfile
pnpm dev
```

Abra o endereço local mostrado no terminal (normalmente http://localhost:3000).

Para verificar a compilação de produção:

```sh
pnpm build
```

O repositório é privado; o clone exige uma conta com acesso. Colocar o código no GitHub não publica automaticamente um site. A implementação usa Vinext, React, TypeScript, Tailwind e o ambiente Sites/Cloudflare Workers; não é uma página HTML estática pronta para GitHub Pages.

## Estrutura

- `app/page.tsx`: telas e interações do protótipo.
- `app/globals.css`: tema e estilos.
- `app/layout.tsx`: idioma e metadados.
- `components/ui/`: componentes de interface disponíveis.
- `public/`: arquivos visuais.
- `.openai/hosting.json`: identificação da publicação Sites existente; não contém chave de API.

## Próxima etapa funcional

Conectar geração de imagens e textos no servidor, armazenamento seguro, validação dos dados reais, exportação dos pacotes e pesquisa por categoria. Nunca colocar chaves de API no navegador ou no repositório.

As sugestões de marketing são orientações, não garantias de vendas. Confira as regras atuais de cada marketplace e valide medidas, materiais, cores, direitos das imagens e alegações antes de publicar.

