// app/lib/ai/contextual-suggestions.ts
// Context-aware suggestions for the assistant based on the current page.

export interface Suggestion {
  label: string;
  icon: string;
  query: string;
}

const PAGE_SUGGESTIONS: Record<string, Suggestion[]> = {
  '/': [
    { label: 'Pedidos de hoje', icon: '🛒', query: 'Quantos pedidos foram feitos hoje?' },
    { label: 'Estoque crítico', icon: '🔴', query: 'Quais produtos estão com estoque crítico?' },
    { label: 'Orçamentos pendentes', icon: '📋', query: 'Quantos orçamentos estão pendentes?' },
    { label: 'Resumo do sistema', icon: '📊', query: 'Me dê um resumo geral do sistema' },
    { label: 'Ticket médio', icon: '🎯', query: 'Qual é o ticket médio dos pedidos?' },
    { label: 'Previsão de demanda', icon: '📈', query: 'Como está a previsão de demanda?' },
  ],
  '/sales': [
    { label: 'Criar novo pedido', icon: '➕', query: 'Como posso criar um novo pedido?' },
    { label: 'Pedidos pendentes', icon: '⏳', query: 'Quais pedidos estão pendentes?' },
    { label: 'Último pedido', icon: '🕐', query: 'Qual foi o último pedido feito?' },
    { label: 'Vendas da semana', icon: '📅', query: 'Como foram as vendas da última semana?' },
    { label: 'Ticket médio', icon: '🎯', query: 'Qual o ticket médio dos pedidos?' },
    { label: 'Entregas atrasadas', icon: '🚚', query: 'Existem entregas atrasadas?' },
  ],
  '/quotes': [
    { label: 'Novo orçamento', icon: '➕', query: 'Criar um novo orçamento' },
    { label: 'Orçamentos para converter', icon: '🔄', query: 'Quais orçamentos podem ser convertidos em pedidos?' },
    { label: 'Orçamentos vencidos', icon: '⏰', query: 'Existem orçamentos vencidos?' },
    { label: 'Taxa de conversão', icon: '📊', query: 'Qual é a taxa de conversão dos orçamentos?' },
    { label: 'Orçamentos do mês', icon: '📅', query: 'Quantos orçamentos foram criados este mês?' },
    { label: 'Gerar PDF', icon: '📄', query: 'Como gerar o PDF de um orçamento?' },
  ],
  '/inventory': [
    { label: 'Estoque baixo', icon: '⚠️', query: 'Quais produtos estão com estoque baixo?' },
    { label: 'Adicionar produto', icon: '➕', query: 'Como adicionar um novo produto?' },
    { label: 'Produtos mais vendidos', icon: '🏆', query: 'Quais são os produtos mais vendidos?' },
    { label: 'Estoque total', icon: '📦', query: 'Qual é o estoque total de todos os produtos?' },
    { label: 'Previsão de reposição', icon: '📈', query: 'Quando preciso repor o estoque?' },
    { label: 'Variações', icon: '🎨', query: 'Listar todas as variações de produtos' },
  ],
  '/finance': [
    { label: 'Receita do mês', icon: '💰', query: 'Qual foi a receita do mês atual?' },
    { label: 'Despesas pendentes', icon: '📤', query: 'Quais despesas estão pendentes?' },
    { label: 'Lucro por produto', icon: '📊', query: 'Qual é o lucro por produto?' },
    { label: 'Resumo financeiro', icon: '📈', query: 'Me dê um resumo financeiro completo' },
    { label: 'Margem de lucro', icon: '💹', query: 'Qual é a margem de lucro atual?' },
    { label: 'Comparativo mensal', icon: '📅', query: 'Comparar receita dos últimos meses' },
  ],
  '/purchases': [
    { label: 'Pedidos de compra', icon: '🛒', query: 'Quais são os pedidos de compra ativos?' },
    { label: 'Fornecedores', icon: '🏭', query: 'Listar todos os fornecedores' },
    { label: 'Adicionar fornecedor', icon: '➕', query: 'Como adicionar um novo fornecedor?' },
    { label: 'Compras do mês', icon: '📅', query: 'Quanto foi gasto em compras este mês?' },
  ],
  '/reports': [
    { label: 'Relatório de vendas', icon: '📈', query: 'Gerar relatório de vendas do mês' },
    { label: 'Produtos mais vendidos', icon: '🏆', query: 'Quais produtos tiveram mais vendas?' },
    { label: 'Performance', icon: '📊', query: 'Como está a performance de vendas?' },
    { label: 'Comparativo', icon: '📅', query: 'Comparar vendas mês a mês' },
  ],
  '/demand-forecast': [
    { label: 'Itens em risco', icon: '🔴', query: 'Quais itens têm risco de falta?' },
    { label: 'Tendência de demanda', icon: '📈', query: 'Como está a tendência de demanda?' },
    { label: 'Sugestões de reposição', icon: '🔄', query: 'Quais produtos precisam de reposição?' },
    { label: 'Acurácia da previsão', icon: '🎯', query: 'Qual é a acurácia da previsão de demanda?' },
  ],
  '/users': [
    { label: 'Listar usuários', icon: '👥', query: 'Listar todos os usuários' },
    { label: 'Performance por vendedor', icon: '📊', query: 'Qual a performance de cada vendedor?' },
    { label: 'Top vendedor', icon: '🏆', query: 'Quem é o top vendedor?' },
  ],
  '/admin': [
    { label: 'Status do sistema', icon: '🖥️', query: 'Como está o status do sistema?' },
    { label: 'Configurações', icon: '⚙️', query: 'Quais são as configurações atuais?' },
    { label: 'Logs recentes', icon: '📋', query: 'Mostrar logs de atividade recentes' },
  ],
};

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: 'Resumo do sistema', icon: '📊', query: 'Me dê um resumo geral do sistema' },
  { label: 'Produto mais vendido', icon: '🏆', query: 'Qual é o produto mais vendido?' },
  { label: 'Estoque baixo', icon: '⚠️', query: 'Quais produtos estão com estoque baixo?' },
  { label: 'Lucro total', icon: '💰', query: 'Qual é o lucro total?' },
  { label: 'Pedidos recentes', icon: '🛒', query: 'Mostrar pedidos recentes' },
  { label: 'Entregas urgentes', icon: '🚚', query: 'Existem entregas urgentes?' },
  { label: 'Previsão de demanda', icon: '📈', query: 'Como está a previsão de demanda?' },
  { label: 'Orçamentos pendentes', icon: '📋', query: 'Quantos orçamentos estão pendentes?' },
  { label: 'Ticket médio', icon: '🎯', query: 'Qual é o ticket médio?' },
  { label: 'Vendas por período', icon: '📅', query: 'Como foram as vendas por período?' },
  { label: 'Quanto custa 500 sacolas TNT?', icon: '💲', query: 'Quanto custa 500 sacolas TNT?' },
  { label: 'Fornecedores', icon: '🏭', query: 'Listar fornecedores' },
];

/**
 * Get contextual suggestions based on the current page path.
 * Falls back to default suggestions for unknown pages.
 */
export function getContextualSuggestions(currentPath: string): Suggestion[] {
  // Exact match first
  if (PAGE_SUGGESTIONS[currentPath]) {
    return PAGE_SUGGESTIONS[currentPath];
  }

  // Try prefix match (e.g., /sales/123 → /sales)
  const basePath = '/' + currentPath.split('/').filter(Boolean)[0];
  if (PAGE_SUGGESTIONS[basePath]) {
    return PAGE_SUGGESTIONS[basePath];
  }

  return DEFAULT_SUGGESTIONS;
}

export { DEFAULT_SUGGESTIONS };
