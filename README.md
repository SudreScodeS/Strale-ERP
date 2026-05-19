# Elitium ERP

> Sistema ERP completo para gestão de vendas, estoque, financeiro e orçamentos.

## 🚀 Features

- **Dashboard** — Visão geral do negócio com métricas customizáveis
- **Vendas (Orders)** — Criação e gestão de pedidos de venda
- **Orçamentos (Quotes)** — Propostas comerciais com conversão em pedidos
- **Estoque (Inventory)** — Produtos com grupos e variáveis configuráveis
- **Compras (Purchases)** — Pedidos de compra para fornecedores
- **Financeiro** — Controle de receitas, despesas e lucros
- **Faturamento** — Relatórios de faturamento por produto
- **Assistente IA** — Chat com inteligência artificial integrada (Ollama)
- **Previsão de Demanda** — Análise preditiva de vendas
- **Usuários & Permissões** — Controle de acesso por roles (admin/seller)
- **Orçamentos com PDF** — Geração de PDF profissionais
- **Análise de Logo** — Detecção automática de cores para personalização

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Ollama (opcional, para IA local)

## 🛠️ Instalação

```bash
# Clone o repositório
git clone https://github.com/SudreScodeS/Elitium-ERP.git
cd Elitium-ERP

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas configurações

# Inicie o servidor de desenvolvimento
npm run dev
```

## ⚙️ Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|:-----------:|
| `JWT_SECRET` | Chave secreta para assinatura JWT | ✅ |
| `NEXT_PUBLIC_APP_URL` | URL base da aplicação | ❌ |
| `OLLAMA_BASE_URL` | URL do servidor Ollama | ❌ |

## 📁 Estrutura do Projeto

```
├── app/
│   ├── api/              # API Routes
│   │   ├── v1/           # API v1 (padronizada)
│   │   └── ...           # Rotas legadas
│   ├── components/       # Componentes React
│   │   ├── ui.tsx        # Componentes base
│   │   └── ...
│   ├── lib/              # Lógica de negócio e utilitários
│   │   ├── auth.ts       # Autenticação JWT
│   │   ├── data.ts       # Camada de dados
│   │   ├── business.ts   # Regras de negócio
│   │   └── ...
│   ├── (pages)/          # Páginas da aplicação
│   └── layout.tsx        # Layout raiz
├── types/                # Tipos TypeScript centralizados
├── config/               # Configurações globais
└── middleware.ts          # Middleware Next.js
```

## 🔐 Autenticação

O sistema utiliza JWT (JSON Web Tokens) com:
- Access tokens de curta duração (1h)
- Refresh tokens com rotação automática
- Cookies HttpOnly para refresh tokens
- Proteção CSRF em rotas de mutação
- Rate limiting por IP/usuário

## 📡 API

Todas as rotas da API v1 seguem o padrão:

```json
{
  "success": true,
  "message": "Operação realizada com sucesso.",
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Endpoints Principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/register` | Cadastro |
| POST | `/api/v1/auth/refresh` | Renovar token |
| GET | `/api/v1/dashboard` | Resumo do dashboard |
| GET/POST | `/api/v1/orders` | Listar/Criar pedidos |
| GET/POST | `/api/v1/quotes` | Listar/Criar orçamentos |
| GET/POST | `/api/v1/inventory` | Listar/Criar produtos |
| GET/POST | `/api/v1/purchases` | Listar/Criar compras |
| GET/POST | `/api/v1/suppliers` | Listar/Criar fornecedores |
| GET | `/api/v1/finance` | Registros financeiros |
| GET | `/api/v1/reports/faturamento` | Faturamento por produto |
| POST | `/api/v1/assistant` | Chat com IA |

> 📖 Documentação completa da API: [`docs/API.md`](docs/API.md) ou [`/api-docs.html`](public/api-docs.html)

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes com cobertura
npm run test:coverage

# Testes E2E
npm run test:e2e
```

### Infraestrutura de Testes

- **Jest** — Testes unitários e de integração
- **Testing Library** — Testes de componentes React
- **Playwright** — Testes E2E (configuração separada)

Para instalar as dependências de teste:

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

## 🚀 Deploy

```bash
# Build para produção
npm run build

# Iniciar em produção
npm start
```

### CI/CD

O projeto utiliza GitHub Actions para CI/CD:

- **CI** (`.github/workflows/ci.yml`) — Lint, testes e build em cada push/PR
- **Staging** (`.github/workflows/deploy-staging.yml`) — Deploy automático da branch `develop`
- **Produção** (`.github/workflows/deploy-production.yml`) — Deploy automático da branch `main`

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit (`git commit -m 'feat: nova feature'`)
4. Push (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado. Todos os direitos reservados.
