# Contribuindo com o Elitium ERP

## Como Contribuir

### 1. Reportar Problemas

Abra uma issue no GitHub com:
- Descricao clara do problema
- Passos para reproduzir
- Comportamento esperado vs atual
- Printscreens (se aplicavel)
- Versao do Node.js e do sistema operacional

### 2. Sugir Melhorias

Abra uma issue com tag `[feature]` no titulo, incluindo:
- Contexto do problema que a melhoria resolve
- Descricao da solucao proposta
- Impacto esperado no fluxo de trabalho

### 3. Enviar Codigo

1. Fork o repositorio
2. Crie uma branch para sua feature: `git checkout -b feature/nome-da-feature`
3. Faca suas alteracoes
4. Garanta que o codigo compila: `npm run build`
5. Faca commit com mensagem descritiva
6. Push para sua branch
7. Abra um Pull Request

### Padrao de Commits

Use o formato:
```
[tipo]: descricao curta

Detalhes opcionais do que foi feito e por que.
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Exemplos:
- `feat: adicionar calculo por dimensao na pagina de vendas`
- `fix: corrigir baixa de estoque ao clonar orcamento`
- `docs: atualizar README com instrucoes de instalacao`

### Estrutura do Projeto

```
app/
  api/          -> Endpoints REST (Next.js App Router)
  components/   -> Componentes React reutilizaveis
  lib/          -> Logica de negocio e utilitarios
  [pagina]/     -> Paginas do sistema (cada pasta e uma rota)
config/         -> Configuracoes globais do sistema
data/           -> Arquivos JSON (banco de dados local)
types/          -> Interfaces e tipos TypeScript
```

### Convencoes de Codigo

- TypeScript estrito (sem `any` quando possivel)
- Nomes de variaveis e funcoes em camelCase
- Nomes de componentes em PascalCase
- Comentarios explicando decisoes de arquitetura, nao o obvio
- Separar logica de negocio (`lib/`) da apresentacao (`components/`)
- Preferir composicao a heranca

### Areas do Sistema

| Modulo | Descricao |
|--------|-----------|
| `auth` | Autenticacao JWT + controle de acesso |
| `inventory` | Produtos, grupos e variaveis |
| `quotes` | Orcamentos (rascunho -> aprovacao -> pedido) |
| `orders` | Pedidos de venda |
| `finance` | Registro de vendas e despesas |
| `demand-forecast` | Previsao de demanda com regressao linear |
| `fraud` | Deteccao de fraude por score |
| `assistant` | Assistente inteligente (pattern matching + Ollama) |
| `pricing` | Motor de precos unificado |

### Duvidas

Abra uma issue com tag `[question]` ou entre em contato com os mantenedores.
