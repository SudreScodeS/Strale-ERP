// app/lib/ai/tool-definitions.ts
// LLM tool definitions in OpenAI-compatible format for Ollama function calling.
// These are sent with every LLM request so the model knows what actions it can take.

export const TOOL_DEFINITIONS = [
  // ── Mutations (actions that change data) ─────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'create_quote',
      description: 'Cria um novo orçamento para um cliente com itens, preços e validade.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Nome do cliente' },
          name: { type: 'string', description: 'Nome/descrição do orçamento' },
          items: {
            type: 'array',
            description: 'Itens do orçamento',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'ID do produto' },
                quantity: { type: 'number', description: 'Quantidade' },
                variableId: { type: 'string', description: 'ID da variável (opcional)' },
              },
              required: ['productId', 'quantity'],
            },
          },
          validDays: { type: 'number', description: 'Dias de validade (padrão: 15)' },
        },
        required: ['customerName', 'items'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_order_status',
      description: 'Atualiza o status de um pedido existente.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'ID do pedido' },
          status: { type: 'string', description: 'Novo status do pedido', enum: ['pending', 'completed', 'cancelled'] },
          delivered: { type: 'boolean', description: 'Marcar como entregue' },
        },
        required: ['orderId', 'status'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_product',
      description: 'Cria um novo produto no catálogo do sistema.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do produto' },
          basePrice: { type: 'number', description: 'Preço base do produto em reais' },
          description: { type: 'string', description: 'Descrição do produto' },
        },
        required: ['name', 'basePrice'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_supplier',
      description: 'Cria um novo fornecedor no sistema.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do fornecedor' },
          contact: { type: 'string', description: 'Contato (telefone/email)' },
          notes: { type: 'string', description: 'Observações sobre o fornecedor' },
        },
        required: ['name'],
      },
    },
  },

  // ── Queries (read-only data access) ─────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'search_orders',
      description: 'Busca pedidos com filtros opcionais de status e cliente.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status', enum: ['pending', 'completed', 'cancelled'] },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão: 10)' },
          customerName: { type: 'string', description: 'Filtrar por nome do cliente' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_quotes',
      description: 'Busca orçamentos com filtros opcionais.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status', enum: ['draft', 'sent', 'approved', 'rejected', 'converted'] },
          customerName: { type: 'string', description: 'Filtrar por nome do cliente' },
          limit: { type: 'number', description: 'Quantidade máxima de resultados' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_pdf_quote',
      description: 'Gera PDF para um orçamento existente.',
      parameters: {
        type: 'object',
        properties: {
          quoteId: { type: 'string', description: 'ID do orçamento' },
        },
        required: ['quoteId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_low_stock',
      description: 'Retorna itens com estoque baixo (crítico) e em atenção, com quantidades e grupos.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_financial_summary',
      description: 'Retorna resumo financeiro: receita total, despesas, lucro e margem.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_sales_report',
      description: 'Retorna relatório de vendas por período (hoje, semana, mês, todos).',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Período do relatório', enum: ['today', 'week', 'month', 'all'] },
        },
        required: [],
      },
    },
  },

  // ── Existing query tools (from tools.ts) ────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'get_sales_summary',
      description: 'Retorna resumo de vendas: total, quantidade de pedidos, ticket médio, vendas por período (hoje, 7 dias, mês).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stock_alerts',
      description: 'Retorna itens com estoque baixo (crítico) e em atenção, com quantidades e grupos.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recent_orders',
      description: 'Retorna os últimos pedidos com nome, valor, status, data e criador.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Quantidade de pedidos (padrão: 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_products',
      description: 'Lista todos os produtos cadastrados com preços, grupos, variações e estoque.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_delivery_status',
      description: 'Retorna pedidos com entrega pendente, atrasados, e status de entrega.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_quotes',
      description: 'Retorna orçamentos: pendentes, enviados, convertidos, taxa de conversão.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_users',
      description: 'Lista usuários com quantidade de pedidos e total de vendas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_demand_forecast',
      description: 'Retorna previsão de demanda: risco de falta, tendência, sugestões de reposição.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_suppliers',
      description: 'Lista fornecedores cadastrados com contato.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_price',
      description: 'Calcula preço de uma venda. Use quando o usuário perguntar "quanto custa" ou pedir um orçamento.',
      parameters: {
        type: 'object',
        properties: {
          quantity: { type: 'number', description: 'Quantidade de unidades' },
          material: { type: 'string', description: 'Material (nylon, tnt, lona, algodao, ecobag)' },
          color: { type: 'string', description: 'Cor mencionada' },
          width: { type: 'number', description: 'Largura em cm' },
          height: { type: 'number', description: 'Altura em cm' },
          logoColors: { type: 'number', description: 'Quantidade de cores da logo (padrão: 1)' },
          printType: { type: 'string', description: 'Tipo de impressão: serigrafia, sublimacao, dtf' },
          printSize: { type: 'string', description: 'Tamanho: small, medium, large' },
          printPosition: { type: 'string', description: 'Posição: front, back, both' },
        },
        required: ['quantity'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_system_summary',
      description: 'Retorna resumo geral do sistema: contagens de produtos, pedidos, usuários, financeiro, alertas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];
