<div align="center">
  <img src="./public/brand-mark.png" alt="Logo do FootGlobe" width="112" />

  # FootGlobe

  **Acompanhe o futebol ao redor do mundo.**

  Explore os jogos de hoje em um globo 3D interativo, entre em uma experiência Retrô histórica, descubra transmissões e highlights e navegue pelo futebol país por país.

  [![Site](https://img.shields.io/badge/Abrir-Site-00AEEF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://footglobe.online)
  [![X](https://img.shields.io/badge/@FootGlobeLive-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/FootGlobeLive)

  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
  ![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Three.js](https://img.shields.io/badge/Three.js-3D-000000?style=flat-square&logo=three.js&logoColor=white)
  ![Locales](https://img.shields.io/badge/i18n-27_idiomas-7C3AED?style=flat-square)

  **[English](./README.md) · [Português (Brasil)](./README.pt-BR.md)**
</div>

<br />

<img src="./public/footglobe-social-preview.webp" alt="FootGlobe — Follow Football Across the Globe" width="100%" />

## Sobre o projeto

O FootGlobe é uma experiência de descoberta de futebol construída ao redor de um globo interativo. Em vez de começar por uma lista de ligas, o site começa pelo mundo: países com partidas viram a navegação principal e cada jogo pode ser explorado a partir dali.

O projeto combina a experiência atual de partidas com um **Modo Retrô**, criado para reproduzir rodadas históricas como se estivessem acontecendo agora.

## Principais recursos

- **Globo 3D interativo** com Three.js e `react-globe.gl`.
- **Jogos de hoje** organizados por país, com placar, status, competição e identidade dos times.
- **Modo Retrô** com temporadas históricas, relógio de replay, detalhes, central de gols e controles de áudio.
- **Busca** por países, clubes e competições.
- **Onde assistir** com consulta de informações de transmissão disponíveis.
- **Highlights em vídeo** via integração server-side com YouTube quando configurada.
- **27 idiomas/locales**, detecção automática pelo navegador e suporte RTL para árabe.
- **Tema claro/escuro automático**, com preferência salva no navegador.
- **Responsivo** para celular e desktop.
- **Doações** via Pix no Brasil e criptomoedas quando as integrações são configuradas.
- **Segredos somente no servidor**: chaves privadas não precisam ser expostas ao frontend.

## Modo Retrô

O Modo Retrô transforma futebol histórico em uma experiência com sensação de tempo real. O FootGlobe consulta as temporadas disponíveis na FootGlobe API e reproduz uma rodada histórica com sincronização própria.

Inclui:

- partidas e placares históricos;
- estados simulados das partidas;
- painéis específicos para países e jogos retrô;
- central de gols sincronizada;
- controles opcionais de áudio de gol;
- assets históricos dos times quando disponíveis.

## Tecnologias

| Área | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS, componentes estilo shadcn |
| Runtime | Next.js 16 + Vinext/Vite |
| Globo 3D | Three.js, `react-globe.gl`, `world-atlas`, TopoJSON |
| Validação | Zod |
| Formulários | React Hook Form |
| Dados de futebol | FootGlobe API |
| Transmissões | TheSportsDB |
| Highlights | YouTube Data API (opcional) |
| Doações no Brasil | GoatPay / Pix (opcional) |
| Cripto | APIs da Binance (opcional) |
| Deploy atual | Site Node.js preparado para Discloud |

## Estrutura

```text
footglobe/
├── app/                    # Aplicação, metadata e rotas server-side
├── components/
│   ├── globe/              # Globo 3D
│   ├── matches/            # Interface do modo Hoje
│   ├── retro/              # Experiência Retrô
│   ├── donations/          # Interface de doações
│   └── ui/                 # Componentes reutilizáveis
├── i18n/                   # Configuração de internacionalização
├── locales/                # 27 arquivos de tradução
├── lib/                    # Clientes da FootGlobe API e utilitários
├── services/               # Futebol, transmissão, highlights e doações
├── public/                 # Marca, ícones e preview social
├── tests/                  # Testes de regressão e integrações
├── types/                  # Tipos TypeScript
├── .github/                # CI e templates do GitHub
└── discloud.config         # Configuração de deploy
```

## Rodando localmente

### Requisitos

- Node.js **22.13.0 ou superior**
- npm
- Linux recomendado para os scripts auxiliares do repositório

### 1. Instale as dependências

```bash
npm ci
```

### 2. Configure o ambiente

```bash
cp .env.example .env.local
```

| Variável | Obrigatória | Uso |
| --- | :---: | --- |
| `FOOTGLOBE_API_URL` | Não | Sobrescreve a URL padrão da FootGlobe API |
| `SPORTSDB_API_KEY` | Não | Chave opcional do TheSportsDB |
| `YOUTUBE_API_KEY` | Não | Ativa busca de highlights |
| `GOATPAY_API_KEY` | Não | Ativa criação/consulta de doações Pix |
| `BINANCE_API_KEY` | Não | Ativa recursos de doação em cripto |
| `BINANCE_API_SECRET` | Não | Segredo de assinatura da Binance |
| `PORT` | Não | Porta do servidor em produção |

> [!CAUTION]
> Nunca envie `.env`, `.env.local`, chaves de API, tokens ou credenciais de pagamento para o GitHub. Este pacote já remove o `.env` real e mantém somente `.env.example`.

### 3. Desenvolvimento

```bash
npm run dev
```

### 4. Produção

```bash
npm run build
npm run start
```

## Scripts

| Comando | Função |
| --- | --- |
| `npm run dev` | Inicia o ambiente local |
| `npm run build` | Gera a build de produção |
| `npm run start` | Inicia o servidor de produção |
| `npm run lint` | Executa ESLint |
| `npm test` | Faz a build e executa os testes |
| `npm run db:generate` | Gera migrations do Drizzle quando necessário |

## Segurança da arquitetura

O navegador chama rotas internas como:

```text
/api/matches
/api/live
/api/watch
/api/highlights
/api/retro/*
/api/donations/*
```

As integrações externas e credenciais privadas ficam no servidor. A principal fonte de dados de futebol é:

```text
https://footglobe-api-nu.vercel.app
```

## Deploy

O repositório já inclui `discloud.config` para o deploy atual. O projeto também pode ser adaptado para outro host compatível com Node.js, desde que as variáveis privadas sejam configuradas no ambiente da plataforma.

## Contribuindo

Bugs, ideias e pull requests são bem-vindos. Leia [`CONTRIBUTING.md`](./CONTRIBUTING.md) antes de enviar alterações.

---

<div align="center">
  <strong>FootGlobe</strong><br />
  Futebol mapeado no mundo.
  <br /><br />
  <a href="https://footglobe.online">Abrir FootGlobe</a> ·
  <a href="https://x.com/FootGlobeLive">@FootGlobeLive</a>
</div>
