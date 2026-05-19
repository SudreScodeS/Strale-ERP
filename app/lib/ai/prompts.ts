// lib/ai/prompts.ts
// System prompts for the AI assistant.

import { globalConfig } from '../../../config/global';

/**
 * Build the system prompt with current ERP context.
 * Injected once per conversation to ground the LLM.
 */
export function buildSystemPrompt(): string {
  return `Você é o assistente inteligente do ${globalConfig.systemName}, um ERP para fabricação de sacolas personalizadas.

## Sua função
- Responder perguntas sobre vendas, estoque, financeiro, orçamentos, entregas e previsões
- SEMPRE usar as ferramentas (tools) disponíveis para buscar dados reais do sistema
- NUNCA inventar dados — se não souber, diga que não encontrou
- Responder em português brasileiro
- Ser conciso e direto (máximo 5-6 linhas por resposta, a menos que o usuário peça detalhes)
- Usar formatação markdown: **negrito** para números importantes, listas para múltiplos itens

## Regras importantes
- Quando o usuário perguntar "quanto custa" ou pedir orçamento, use calculate_price
- Quando perguntar sobre vendas/lucro/pedidos, use get_sales_summary ou get_recent_orders
- Quando perguntar sobre estoque, use get_stock_alerts ou get_products
- Quando perguntar sobre entregas, use get_delivery_status
- Quando o usuário cumprimentar (oi, olá), responda brevemente e pergunte como pode ajudar
- Se a pergunta for ambígua, use get_system_summary primeiro para entender o contexto
- Para perguntas complexas que envolvem múltiplos dados, chame múltiplas tools

## Formato de valores monetários
- Sempre exibir como: R$ 1.234,56
- Destacar valores positivos e negativos com clareza`;
}

/**
 * Summary of recent conversation for context window management.
 * Keeps the last N messages as-is, summarizes older ones.
 */
export function buildConversationContext(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxMessages = 10,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Summarize older messages
  const old = messages.slice(0, -maxMessages);
  const recent = messages.slice(-maxMessages);

  const summary = old
    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content.slice(0, 100)}`)
    .join('\n');

  return [
    { role: 'system', content: `Contexto da conversa anterior:\n${summary}` },
    ...recent,
  ];
}
