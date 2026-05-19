// app/lib/ai/contextual-suggestions.ts
// Context-aware suggestions for the assistant based on the current page.

import React from 'react';
import {
  IconCart, IconAlertTriangle, IconClipboard, IconBarChart, IconTarget,
  IconTrendingUp, IconCheck, IconClock, IconCalendar, IconRefresh,
  IconPackage, IconDollarSign, IconTrophy, IconSettings, IconFileText,
  IconUsers, IconCreate, IconAlertCircle, IconCrosshair, IconEdit,
  IconSearch, IconShoppingBag, IconMonitor,
} from '../../components/icons';

export interface Suggestion {
  label: string;
  icon: React.ReactNode;
  query: string;
}

const PAGE_SUGGESTIONS: Record<string, Suggestion[]> = {
  '/': [
    { label: 'Pedidos de hoje', icon: React.createElement(IconCart, { size: 14 }), query: 'Quantos pedidos foram feitos hoje?' },
    { label: 'Estoque crítico', icon: React.createElement(IconAlertCircle, { size: 14, style: { color: 'var(--danger)' } }), query: 'Quais produtos estão com estoque crítico?' },
    { label: 'Orçamentos pendentes', icon: React.createElement(IconClipboard, { size: 14 }), query: 'Quantos orçamentos estão pendentes?' },
    { label: 'Resumo do sistema', icon: React.createElement(IconBarChart, { size: 14 }), query: 'Me dê um resumo geral do sistema' },
    { label: 'Ticket médio', icon: React.createElement(IconTarget, { size: 14 }), query: 'Qual é o ticket médio dos pedidos?' },
    { label: 'Previsão de demanda', icon: React.createElement(IconTrendingUp, { size: 14 }), query: 'Como está a previsão de demanda?' },
  ],
  '/sales': [
    { label: 'Criar novo pedido', icon: React.createElement(IconCreate, { size: 14 }), query: 'Como posso criar um novo pedido?' },
    { label: 'Pedidos pendentes', icon: React.createElement(IconClock, { size: 14 }), query: 'Quais pedidos estão pendentes?' },
    { label: 'Último pedido', icon: React.createElement(IconClock, { size: 14 }), query: 'Qual foi o último pedido feito?' },
    { label: 'Vendas da semana', icon: React.createElement(IconCalendar, { size: 14 }), query: 'Como foram as vendas da última semana?' },
    { label: 'Ticket médio', icon: React.createElement(IconTarget, { size: 14 }), query: 'Qual o ticket médio dos pedidos?' },
    { label: 'Entregas atrasadas', icon: React.createElement(IconAlertTriangle, { size: 14, style: { color: 'var(--warning)' } }), query: 'Existem entregas atrasadas?' },
  ],
  '/quotes': [
    { label: 'Novo orçamento', icon: React.createElement(IconCreate, { size: 14 }), query: 'Criar um novo orçamento' },
    { label: 'Orçamentos para converter', icon: React.createElement(IconRefresh, { size: 14 }), query: 'Quais orçamentos podem ser convertidos em pedidos?' },
    { label: 'Orçamentos vencidos', icon: React.createElement(IconAlertCircle, { size: 14 }), query: 'Existem orçamentos vencidos?' },
    { label: 'Taxa de conversão', icon: React.createElement(IconBarChart, { size: 14 }), query: 'Qual é a taxa de conversão dos orçamentos?' },
    { label: 'Orçamentos do mês', icon: React.createElement(IconCalendar, { size: 14 }), query: 'Quantos orçamentos foram criados este mês?' },
    { label: 'Gerar PDF', icon: React.createElement(IconFileText, { size: 14 }), query: 'Como gerar o PDF de um orçamento?' },
  ],
  '/inventory': [
    { label: 'Estoque baixo', icon: React.createElement(IconAlertTriangle, { size: 14 }), query: 'Quais produtos estão com estoque baixo?' },
    { label: 'Adicionar produto', icon: React.createElement(IconCreate, { size: 14 }), query: 'Como adicionar um novo produto?' },
    { label: 'Produtos mais vendidos', icon: React.createElement(IconTrophy, { size: 14 }), query: 'Quais são os produtos mais vendidos?' },
    { label: 'Estoque total', icon: React.createElement(IconPackage, { size: 14 }), query: 'Qual é o estoque total de todos os produtos?' },
    { label: 'Previsão de reposição', icon: React.createElement(IconTrendingUp, { size: 14 }), query: 'Quando preciso repor o estoque?' },
    { label: 'Variações', icon: React.createElement(IconEdit, { size: 14 }), query: 'Listar todas as variações de produtos' },
  ],
  '/finance': [
    { label: 'Receita do mês', icon: React.createElement(IconDollarSign, { size: 14 }), query: 'Qual foi a receita do mês atual?' },
    { label: 'Despesas pendentes', icon: React.createElement(IconAlertCircle, { size: 14 }), query: 'Quais despesas estão pendentes?' },
    { label: 'Lucro por produto', icon: React.createElement(IconBarChart, { size: 14 }), query: 'Qual é o lucro por produto?' },
    { label: 'Resumo financeiro', icon: React.createElement(IconTrendingUp, { size: 14 }), query: 'Me dê um resumo financeiro completo' },
    { label: 'Margem de lucro', icon: React.createElement(IconDollarSign, { size: 14 }), query: 'Qual é a margem de lucro atual?' },
    { label: 'Comparativo mensal', icon: React.createElement(IconCalendar, { size: 14 }), query: 'Comparar receita dos últimos meses' },
  ],
  '/purchases': [
    { label: 'Pedidos de compra', icon: React.createElement(IconShoppingBag, { size: 14 }), query: 'Quais são os pedidos de compra ativos?' },
    { label: 'Fornecedores', icon: React.createElement(IconPackage, { size: 14 }), query: 'Listar todos os fornecedores' },
    { label: 'Adicionar fornecedor', icon: React.createElement(IconCreate, { size: 14 }), query: 'Como adicionar um novo fornecedor?' },
    { label: 'Compras do mês', icon: React.createElement(IconCalendar, { size: 14 }), query: 'Quanto foi gasto em compras este mês?' },
  ],
  '/reports': [
    { label: 'Relatório de vendas', icon: React.createElement(IconTrendingUp, { size: 14 }), query: 'Gerar relatório de vendas do mês' },
    { label: 'Produtos mais vendidos', icon: React.createElement(IconTrophy, { size: 14 }), query: 'Quais produtos tiveram mais vendas?' },
    { label: 'Performance', icon: React.createElement(IconBarChart, { size: 14 }), query: 'Como está a performance de vendas?' },
    { label: 'Comparativo', icon: React.createElement(IconCalendar, { size: 14 }), query: 'Comparar vendas mês a mês' },
  ],
  '/demand-forecast': [
    { label: 'Itens em risco', icon: React.createElement(IconAlertCircle, { size: 14, style: { color: 'var(--danger)' } }), query: 'Quais itens têm risco de falta?' },
    { label: 'Tendência de demanda', icon: React.createElement(IconTrendingUp, { size: 14 }), query: 'Como está a tendência de demanda?' },
    { label: 'Sugestões de reposição', icon: React.createElement(IconRefresh, { size: 14 }), query: 'Quais produtos precisam de reposição?' },
    { label: 'Acurácia da previsão', icon: React.createElement(IconTarget, { size: 14 }), query: 'Qual é a acurácia da previsão de demanda?' },
  ],
  '/users': [
    { label: 'Listar usuários', icon: React.createElement(IconUsers, { size: 14 }), query: 'Listar todos os usuários' },
    { label: 'Performance por vendedor', icon: React.createElement(IconBarChart, { size: 14 }), query: 'Qual a performance de cada vendedor?' },
    { label: 'Top vendedor', icon: React.createElement(IconTrophy, { size: 14 }), query: 'Quem é o top vendedor?' },
  ],
  '/admin': [
    { label: 'Status do sistema', icon: React.createElement(IconMonitor, { size: 14 }), query: 'Como está o status do sistema?' },
    { label: 'Configurações', icon: React.createElement(IconSettings, { size: 14 }), query: 'Quais são as configurações atuais?' },
    { label: 'Logs recentes', icon: React.createElement(IconClipboard, { size: 14 }), query: 'Mostrar logs de atividade recentes' },
  ],
};

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: 'Resumo do sistema', icon: React.createElement(IconBarChart, { size: 14 }), query: 'Me dê um resumo geral do sistema' },
  { label: 'Produto mais vendido', icon: React.createElement(IconTrophy, { size: 14 }), query: 'Qual é o produto mais vendido?' },
  { label: 'Estoque baixo', icon: React.createElement(IconAlertTriangle, { size: 14 }), query: 'Quais produtos estão com estoque baixo?' },
  { label: 'Lucro total', icon: React.createElement(IconDollarSign, { size: 14 }), query: 'Qual é o lucro total?' },
  { label: 'Pedidos recentes', icon: React.createElement(IconCart, { size: 14 }), query: 'Mostrar pedidos recentes' },
  { label: 'Entregas urgentes', icon: React.createElement(IconAlertTriangle, { size: 14, style: { color: 'var(--warning)' } }), query: 'Existem entregas urgentes?' },
  { label: 'Previsão de demanda', icon: React.createElement(IconTrendingUp, { size: 14 }), query: 'Como está a previsão de demanda?' },
  { label: 'Orçamentos pendentes', icon: React.createElement(IconClipboard, { size: 14 }), query: 'Quantos orçamentos estão pendentes?' },
  { label: 'Ticket médio', icon: React.createElement(IconTarget, { size: 14 }), query: 'Qual é o ticket médio?' },
  { label: 'Vendas por período', icon: React.createElement(IconCalendar, { size: 14 }), query: 'Como foram as vendas por período?' },
  { label: 'Quanto custa 500 sacolas TNT?', icon: React.createElement(IconDollarSign, { size: 14 }), query: 'Quanto custa 500 sacolas TNT?' },
  { label: 'Fornecedores', icon: React.createElement(IconPackage, { size: 14 }), query: 'Listar fornecedores' },
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
