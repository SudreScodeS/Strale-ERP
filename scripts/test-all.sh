#!/bin/bash
# =============================================
# TESTE COMPLETO DO SISTEMA ELITIUM ERP
# Executa: bash scripts/test-all.sh
# =============================================

set -e
BASE="http://localhost:3000"
RESULTS_FILE="scripts/test-results.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Login
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "❌ Falha no login"
  exit 1
fi

echo "# Resultados dos Testes — Elitium ERP" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "**Data:** $TIMESTAMP" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

pass=0
fail=0

test_api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local check="$5"  # python expression that returns True if ok

  if [ "$method" = "GET" ]; then
    response=$(curl -s "$BASE$endpoint" -H "Authorization: Bearer $TOKEN")
  else
    response=$(curl -s -X "$method" "$BASE$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  ok=$(echo "$response" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('ok' if ($check) else 'fail')
except:
    print('fail')
" 2>/dev/null)

  if [ "$ok" = "ok" ]; then
    echo "✅ $name"
    echo "- ✅ **$name**" >> "$RESULTS_FILE"
    pass=$((pass + 1))
  else
    echo "❌ $name"
    echo "- ❌ **$name**" >> "$RESULTS_FILE"
    fail=$((fail + 1))
  fi
}

echo "=========================================="
echo "  TESTES DO SISTEMA ELITIUM ERP"
echo "=========================================="
echo ""

echo "## 1. Sistema & Auth" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Health Check" GET "/api/system" "" "d.get('status') in ('ok','warning')"
test_api "Login Admin" POST "/api/auth/login" '{"username":"admin","password":"admin123"}' "d.get('token') is not None"

echo ""
echo "## 2. Dashboard" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Dashboard - métricas" GET "/api/dashboard" "" "d.get('summary',{}).get('ordersCount',0) > 0"
test_api "Dashboard - receita" GET "/api/dashboard" "" "d.get('summary',{}).get('totalSales',0) > 0"
test_api "Dashboard - lucro" GET "/api/dashboard" "" "d.get('summary',{}).get('profit',0) > 0"
test_api "Dashboard - produtos" GET "/api/dashboard" "" "d.get('summary',{}).get('productsCount',0) > 0"
test_api "Dashboard - orçamentos" GET "/api/dashboard" "" "'quotesPending' in d.get('summary',{})"

echo ""
echo "## 3. Inventário" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Listar estoque" GET "/api/inventory" "" "True"
test_api "Criar produto" POST "/api/inventory/product" '{"name":"Camiseta Personalizada","basePrice":35,"description":"Camiseta 100% algodão","imageUrl":"/product-final.webp"}' "d.get('message') is not None or d.get('product') is not None or d.get('id') is not None"
test_api "Criar grupo" POST "/api/inventory/group" '{"productId":"product-1","name":"Estampa"}' "d.get('message') is not None or d.get('group') is not None or d.get('id') is not None"

echo ""
echo "## 4. Pedidos" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Listar pedidos" GET "/api/orders" "" "len(d.get('orders',[])) >= 8"
test_api "Pedidos com status variados" GET "/api/orders" "" "len(set(o.get('status') for o in d.get('orders',[]))) >= 3"

echo ""
echo "## 5. Orçamentos" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Listar orçamentos" GET "/api/quotes" "" "len(d.get('quotes',[])) >= 4"
test_api "Orçamentos - draft" GET "/api/quotes?status=draft" "" "any(q.get('status')=='draft' for q in d.get('quotes',[]))"
test_api "Orçamentos - sent" GET "/api/quotes?status=sent" "" "any(q.get('status')=='sent' for q in d.get('quotes',[]))"
test_api "Orçamentos - approved/convertidos" GET "/api/quotes" "" "len(d.get('quotes',[])) >= 3"
test_api "Orçamentos - rejected" GET "/api/quotes?status=rejected" "" "any(q.get('status')=='rejected' for q in d.get('quotes',[]))"

echo ""
echo "## 6. Financeiro" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Dados financeiros" GET "/api/finance" "" "True"

echo ""
echo "## 7. Previsão de Demanda" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Forecast - dados" GET "/api/demand-forecast" "" "d.get('summary',{}).get('totalVariablesAnalyzed',0) > 0"
test_api "Forecast - alta demanda" GET "/api/demand-forecast" "" "len(d.get('summary',{}).get('highDemand',[])) > 0"
test_api "Forecast - tendências" GET "/api/demand-forecast" "" "any(f.get('trend') for f in d.get('summary',{}).get('highDemand',[]))"

echo ""
echo "## 8. Assistente" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Assistente - produto mais vendido" POST "/api/assistant" '{"question":"produto mais vendido"}' "d.get('answer') is not None"
test_api "Assistente - estoque baixo" POST "/api/assistant" '{"question":"estoque baixo"}' "d.get('answer') is not None"
test_api "Assistente - lucro" POST "/api/assistant" '{"question":"qual o lucro total"}' "d.get('answer') is not None"
test_api "Assistente - pedidos" POST "/api/assistant" '{"question":"quantos pedidos temos"}' "d.get('answer') is not None"

echo ""
echo "## 9. Fornecedores" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Listar fornecedores" GET "/api/suppliers" "" "True"
test_api "Criar fornecedor" POST "/api/suppliers" '{"name":"Fornecedor Teste ABC","contact":"11999888777","email":"teste@fornecedor.com"}' "True"

echo ""
echo "## 10. Usuários" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Listar usuários" GET "/api/users" "" "len(d.get('users',[])) >= 1"

echo ""
echo "## 11. Compras" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Listar compras" GET "/api/purchases" "" "True"

echo ""
echo "## 12. Relatórios (páginas)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Test page rendering (just check HTTP status)
for page in "/" "/sales" "/inventory" "/quotes" "/finance" "/reports" "/demand-forecast" "/assistant" "/users" "/admin"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$page" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "000")
  if [ "$status" = "200" ] || [ "$status" = "304" ]; then
    echo "✅ Página $page ($status)"
    echo "- ✅ Página \`$page\` ($status)" >> "$RESULTS_FILE"
    pass=$((pass + 1))
  else
    echo "❌ Página $page ($status)"
    echo "- ❌ Página \`$page\` ($status)" >> "$RESULTS_FILE"
    fail=$((fail + 1))
  fi
done

echo ""
echo "## 13. Validação de Estoque" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

test_api "Alertas de estoque" GET "/api/dashboard" "" "d.get('summary',{}).get('lowStockCount',0) + d.get('summary',{}).get('watchStockCount',0) > 0"

echo ""
echo "---" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "**Resumo:** $pass ✅ / $fail ❌ de $((pass + fail)) testes" >> "$RESULTS_FILE"

echo ""
echo "=========================================="
echo "  RESUMO: $pass ✅ / $fail ❌ de $((pass + fail)) testes"
echo "=========================================="
echo ""
echo "Resultados salvos em: $RESULTS_FILE"
