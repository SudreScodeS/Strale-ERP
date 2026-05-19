# Elitium ERP — Documentação da API

> Base URL: `http://localhost:3000/api/v1`

## Autenticação

Todas as rotas protegidas requerem um Bearer Token no header `Authorization`:

```
Authorization: Bearer <token>
```

Obtenha o token via `/api/v1/auth/login`.

### Roles

- **admin** — Acesso total ao sistema
- **seller** — Acesso a vendas, orçamentos e relatórios

---

## Resposta Padrão

### Sucesso

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

### Erro

```json
{
  "success": false,
  "message": "Descrição do erro.",
  "errorCode": "BAD_REQUEST",
  "details": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Códigos de Erro

| Código HTTP | errorCode | Descrição |
|-------------|-----------|-----------|
| 400 | `BAD_REQUEST` | Dados inválidos ou validação falhou |
| 401 | `UNAUTHORIZED` | Token ausente ou inválido |
| 403 | `FORBIDDEN` | Sem permissão para esta ação |
| 404 | `NOT_FOUND` | Recurso não encontrado |
| 409 | `CONFLICT` | Conflito (ex: username já existe) |
| 500 | `INTERNAL_ERROR` | Erro interno do servidor |

---

## Endpoints

### Autenticação

#### POST `/api/v1/auth/login`

Realiza login e retorna um JWT.

**Request:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "senha123"}'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login realizado com sucesso.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-do-usuario",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

**Erros:**
- `400` — Username e senha são obrigatórios
- `401` — Credenciais inválidas

---

#### POST `/api/v1/auth/register`

Cria um novo usuário (apenas admin).

**Request:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"username": "vendedor1", "email": "v1@email.com", "password": "senha123", "role": "seller"}'
```

**Response (201):**

```json
{
  "success": true,
  "message": "Usuário criado com sucesso.",
  "data": {
    "id": "uuid-do-usuario",
    "username": "vendedor1",
    "role": "seller"
  }
}
```

**Erros:**
- `400` — Dados obrigatórios ausentes
- `403` — Apenas admins podem criar usuários
- `409` — Username já existe

---

#### POST `/api/v1/auth/refresh`

Renova o token de acesso.

**Request:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "token-de-refresh"}'
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "token": "novo-jwt-token"
  }
}
```

---

### Dashboard

#### GET `/api/v1/dashboard`

Retorna resumo do dashboard (requer autenticação).

**Request:**

```bash
curl http://localhost:3000/api/v1/dashboard \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalOrders": 42,
    "totalRevenue": 15000.00,
    "pendingOrders": 5,
    "lowStockProducts": 3
  }
}
```

---

### Pedidos (Orders)

#### GET `/api/v1/orders`

Lista todos os pedidos.

**Request:**

```bash
curl http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "order-uuid",
      "name": "Pedido #001",
      "status": "pending",
      "totalPrice": 350.00,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### POST `/api/v1/orders`

Cria um novo pedido.

**Request:**

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Pedido Personalizado",
    "items": [{
      "productId": "prod-uuid",
      "selectedVariables": [{"groupId": "g1", "variableId": "v1", "quantity": 10}],
      "quantity": 5
    }]
  }'
```

**Response (201):**

```json
{
  "success": true,
  "message": "Pedido criado com sucesso.",
  "data": { "id": "novo-order-uuid", ... }
}
```

---

### Orçamentos (Quotes)

#### GET `/api/v1/quotes`

Lista todos os orçamentos.

```bash
curl http://localhost:3000/api/v1/quotes \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/v1/quotes`

Cria um novo orçamento.

```bash
curl -X POST http://localhost:3000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "customerName": "Cliente Exemplo",
    "name": "Orçamento Camisetas",
    "items": [{
      "productId": "prod-uuid",
      "productName": "Camiseta Básica",
      "selectedVariables": [],
      "quantity": 100,
      "unitCost": 15.00,
      "unitPrice": 25.00
    }],
    "totalCost": 1500.00,
    "totalPrice": 2500.00
  }'
```

---

### Estoque (Inventory)

#### GET `/api/v1/inventory`

Lista todos os produtos com grupos e variáveis.

```bash
curl http://localhost:3000/api/v1/inventory \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/v1/inventory`

Cria um novo produto.

```bash
curl -X POST http://localhost:3000/api/v1/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Camiseta Premium",
    "basePrice": 20.00,
    "description": "Camiseta 100% algodão"
  }'
```

---

### Compras (Purchases)

#### GET `/api/v1/purchases`

Lista pedidos de compra.

```bash
curl http://localhost:3000/api/v1/purchases \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/v1/purchases`

Cria um pedido de compra.

```bash
curl -X POST http://localhost:3000/api/v1/purchases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "supplierId": "supplier-uuid",
    "items": [{"variableId": "var-uuid", "quantity": 100, "unitCost": 5.00}]
  }'
```

---

### Fornecedores (Suppliers)

#### GET `/api/v1/suppliers`

Lista fornecedores.

```bash
curl http://localhost:3000/api/v1/suppliers \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/v1/suppliers`

Cria um fornecedor.

```bash
curl -X POST http://localhost:3000/api/v1/suppliers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Fornecedor ABC", "contact": "contato@abc.com"}'
```

---

### Financeiro

#### GET `/api/v1/finance`

Lista registros financeiros.

```bash
curl http://localhost:3000/api/v1/finance \
  -H "Authorization: Bearer <token>"
```

---

### Relatórios

#### GET `/api/v1/reports/faturamento`

Relatório de faturamento por produto.

```bash
curl http://localhost:3000/api/v1/reports/faturamento \
  -H "Authorization: Bearer <token>"
```

---

### Assistente IA

#### POST `/api/v1/assistant`

Envia mensagem para o assistente IA.

```bash
curl -X POST http://localhost:3000/api/v1/assistant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "Qual o produto mais vendido?"}'
```

---

### Sistema

#### GET `/api/v1/system`

Informações do sistema (admin only).

```bash
curl http://localhost:3000/api/v1/system \
  -H "Authorization: Bearer <admin-token>"
```

---

## Paginação

Endpoints que retornam listas suportam paginação via query params:

```
GET /api/v1/orders?page=1&pageSize=20
```

**Response com paginação:**

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "timestamp": "...",
    "requestId": "...",
    "page": 1,
    "pageSize": 20,
    "total": 42
  }
}
```
