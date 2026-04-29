// config/global.ts
// Arquivo de configurações globais do sistema ERP
// Todas as regras de negócio configuráveis estão aqui
// Decisão arquitetural: Centralizar configurações para fácil alteração sem modificar código
// IMPORTANTE: Alterações aqui afetam todo o sistema - testar thoroughly após mudanças

import { GlobalConfig } from '../types';

// ==========================================
// CONFIGURAÇÕES GLOBAIS DO SISTEMA
// ==========================================

// OBJETO CENTRAL DE CONFIGURAÇÃO
// Todas as regras de negócio ajustáveis estão aqui
// Modificar valores aqui afeta cálculos em todo o sistema
export const globalConfig: GlobalConfig = {
  // MARGEM DE LUCRO PADRÃO (PERCENTUAL)
  // Define quanto % acima do custo o produto será vendido
  // Exemplo: Se custo = R$ 100 e margem = 20%, preço de venda = R$ 120
  // Modificar: Aumentar para lucros maiores, diminuir para preços mais competitivos
  profitMargin: 20, // 20% de margem de lucro

  // PREÇO POR COR NO LOGO PERSONALIZADO
  // Custo adicional por cor na personalização de logo
  // Exemplo: Logo com 3 cores = 3 × R$ 10 = R$ 30 adicional
  // Modificar: Ajustar baseado no custo real de produção/material
  logoPricePerColor: 10, // R$ 10 por cor na logo

  // LIMITE PARA ALERTA DE ESTOQUE BAIXO
  // Quando estoque <= este valor, sistema gera alertas de reposição
  // Exemplo: minStockAlert = 5 significa alertar quando <= 5 unidades
  // Modificar: Aumentar para produtos de baixo giro, diminuir para produtos críticos
  minStockAlert: 5, // Alerta quando estoque <= 5

  // NOME DO SISTEMA (EXIBIDO NA INTERFACE)
  // Aparece em títulos, cabeçalhos e relatórios
  // Modificar: Personalizar para diferentes clientes/empresas
  systemName: 'Simple ERP', // Nome do sistema, editável

  // NOME DA EMPRESA (PARA NOTAS FISCAIS E RELATÓRIOS)
  // Usado em documentos oficiais e cabeçalhos
  // Modificar: Alterar quando implantar em empresa diferente
  companyName: 'North Bag', // Nome da empresa
};

// ==========================================
// FUNÇÕES DE CÁLCULO BASEADAS NAS CONFIGURAÇÕES
// ==========================================

// CALCULA PREÇO DE VENDA APLICANDO MARGEM DE LUCRO
// Fórmula: Preço de Venda = Custo Total + (Custo Total × Margem/100)
// Exemplo: custo = 100, margem = 20% → preço = 100 + (100 × 0.20) = 120
// Usado em: Finalização de pedidos, orçamentos, relatórios de preço
export function calculateSalePrice(totalCost: number): number {
  return totalCost + (totalCost * globalConfig.profitMargin / 100);
}

// CALCULA CUSTO ADICIONAL DA PERSONALIZAÇÃO DE LOGO
// Fórmula: Custo Logo = Número de Cores × Preço por Cor
// Exemplo: 3 cores × R$ 10 = R$ 30
// Usado em: Análise de logo, cálculo de preço total do pedido
export function calculateLogoCost(colors: number): number {
  return colors * globalConfig.logoPricePerColor;
}

// VERIFICA SE ESTOQUE ESTÁ EM NÍVEL CRÍTICO
// Retorna true se estoque <= limite configurado
// Usado em: Alertas de reposição, relatórios de estoque, sugestões de compra
export function isLowStock(stock: number): boolean {
  return stock <= globalConfig.minStockAlert;
}

// ==========================================
// GUIA PARA MODIFICAÇÃO DAS CONFIGURAÇÕES
// ==========================================

// COMO ALTERAR CONFIGURAÇÕES:
//
// 1. MARGEM DE LUCRO:
//    - Aumentar: Lucro maior, preços mais altos
//    - Diminuir: Preços mais competitivos, lucro menor
//    - Considerar: Concorrência, demanda, custos operacionais
//
// 2. PREÇO DO LOGO:
//    - Basear no custo real de produção/material
//    - Considerar complexidade da personalização
//    - Avaliar impacto no volume de vendas
//
// 3. ALERTA DE ESTOQUE:
//    - Produtos críticos: valor menor (ex: 2-3)
//    - Produtos comuns: valor maior (ex: 10-20)
//    - Considerar: Tempo de reposição, demanda diária
//
// 4. NOMES DO SISTEMA:
//    - Personalizar para cada cliente/empresa
//    - Manter consistência em toda a interface
//
// TESTES APÓS ALTERAÇÃO:
// - Verificar cálculos de preço em pedidos
// - Testar alertas de estoque
// - Validar geração de notas fiscais
// - Executar testes automatizados se existirem
