# Changelog

## [1.3.0] - 2026-05-08

### Adicionado
- Calculo por dimensao (largura x altura) na pagina de vendas
- Configuracao de impressao da logo (tipo, tamanho, posicao) na pagina de vendas
- Constantes de tipos de impressao, tamanhos e posicoes na pagina de vendas
- Documentacao: CONTRIBUTING.md, CHANGELOG.md, LICENSE

### Corrigido
- Removidos emojis de toda a interface e documentacao para visual profissional
- Padronizacao de textos na interface (sem caracteres decorativos)

### Alterado
- README.md reescrito com estrutura profissional e sem emojis
- DOCUMENTACAO.md atualizada com novas funcionalidades

## [1.2.0] - 2026-05-06

### Adicionado
- Modulo de orcamentos completo (backend + frontend + API)
- Motor de precos avancado com tabelas por volume
- Calculo por dimensao (preco por cm²)
- Regras de impressao detalhadas (serigrafia, sublimacao, DTF)
- Clonagem de orcamentos
- Ciclo de vida de orcamento: rascunho -> enviado -> aprovado/rejeitado -> convertido
- Integracao com Ollama para IA local em portugues
- Dashboard expandido com metricas de orcamentos
- Configuracoes expandidas no admin (validade do orcamento, preco por cm²)

## [1.1.0] - 2026-04-20

### Adicionado
- Previsao de demanda com regressao linear
- Deteccao de fraude com score 0-100
- Assistente inteligente com pattern matching local
- Analise de logo via sharp (processamento local)
- Detecao de cores dominantes
- Google Cloud Vision opcional

## [1.0.0] - 2026-03-01

### Adicionado
- Sistema de produtos com grupos e variaveis
- Gestao de estoque com alertas automaticos
- Fluxo de vendas com carrinho de compras
- Calculo automatico de preco (base + variaveis + markup)
- Baixa automatica de estoque ao finalizar pedido
- Geracao de nota fiscal
- Registro financeiro automatico
- Autenticacao JWT com dois perfis (admin/seller)
- Dashboard com metricas consolidadas
- Gestao de fornecedores e pedidos de compra
