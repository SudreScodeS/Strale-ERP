# Nota Fiscal Eletrônica (NF-e) — Plano de Implementação

## Visão Geral

Este documento descreve como o Elitium ERP pode emitir **Notas Fiscais Eletrônicas (NF-e)** oficialmente no Brasil, integrando com a SEFAZ (Secretaria da Fazenda) via Web Services.

---

## 1. Pré-requisitos

### 1.1 Certificado Digital A1
- **O que é:** Certificado digital no formato arquivo (`.pfx`/`.p12`), válido para autenticação junto à SEFAZ.
- **Onde obter:** Autoridades Certificadoras como AC Serasa, AC Certisign, AC Fenacon, etc.
- **Custo:** R$ 150–400/ano dependendo da AC.
- **Formato:** A1 (arquivo) — necessário para ambientes web (o A3 em token USB não funciona em servidor).

### 1.2 Inscrição Estadual
- A empresa precisa ter Inscrição Estadual ativa.
- Cadastro na SEFAZ do estado como contribuinte ICMS.

### 1.3 Habilitação para Emissão de NF-e
- Acessar o portal da SEFAZ do estado e solicitar habilitação para emissão de NF-e.
- Definir o **Ambiente de Homologação** (testes) primeiro, depois **Produção**.

---

## 2. Arquitetura Técnica

### 2.1 Fluxo de Emissão

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  Elitium    │────▶│  API NF-e    │────▶│  SEFAZ      │────▶│  PDF/DANFE│
│  ERP        │     │  (Backend)   │     │  Web Service│     │  + XML   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
```

1. **Elitium ERP** coleta dados do pedido (cliente, itens, valores, impostos).
2. **API NF-e** (backend Node.js) monta o XML da NF-e conforme schema da SEFAZ.
3. O XML é **assinado digitalmente** com o certificado A1.
4. O XML assinado é **transmitido** ao Web Service da SEFAZ.
5. SEFAZ retorna **Autorização** ou **Rejeição**.
6. Se autorizada: gerar **DANFE** (PDF da nota) e armazenar XML.

### 2.2 Tecnologias Recomendadas

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Biblioteca NF-e | **node-nfe** ou **nfe.js** | Bibliotecas Node.js para montagem, assinatura e transmissão de NF-e |
| Certificado | `node-forge` ou `pki.js` | Leitura e uso do certificado A1 (.pfx) |
| XML | `xml2js` + `xmldsig` | Montagem e assinatura digital do XML |
| PDF (DANFE) | `pdfmake` ou `puppeteer` | Geração do DANFE (Documento Auxiliar da NF-e) |
| Comunicação SEFAZ | HTTPS + SOAP/XML | Web Services da SEFAZ (produção e homologação) |
| Armazenamento | PostgreSQL / Supabase | XML autorizado + metadados da NF-e |

---

## 3. Schema da NF-e (Campos Obrigatórios)

### 3.1 Identificação
```
- cUF (código da UF) — ex: 35 (SP)
- cNF (código numérico aleatório)
- natOp (natureza da operação) — ex: "Venda de Mercadoria"
- mod (modelo) — 55 (NF-e) ou 65 (NFC-e)
- serie (série da nota)
- nNF (número da nota)
- dhEmi (data/hora emissão)
- tpNF (tipo) — 0=Entrada, 1=Saída
- idDest (destino) — 1=Operação interna, 2=Interestadual, 3=Exterior
- cMunFG (município de ocorrência do fato gerador)
- tpImp (formato DANFE) — 1=Retrato, 2=Paisagem
- tpEmis (tipo de emissão) — 1=Normal
- finNFe (finalidade) — 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
```

### 3.2 Emitente (Sua Empresa)
```
- CNPJ
- xNome (razão social)
- xFant (nome fantasia)
- enderEmit (endereço completo)
- IE (inscrição estadual)
- CRT (regime tributário) — 1=Simples Nacional, 2=Excesso, 3=Normal
```

### 3.3 Destinatário (Cliente)
```
- CPF ou CNPJ
- xNome (razão social / nome)
- enderDest (endereço completo)
- indIEDest (indicador IE) — 1=Contribuinte, 2=Isento, 9=Não Contribuinte
```

### 3.4 Itens / Produtos
```
- cProd (código do produto)
- xProd (descrição)
- NCM (Nomenclatura Comum do Mercosul)
- CEST (se aplicável)
- CFOP (Código Fiscal de Operações e Prestações)
  - Exemplos: 5102 (venda dentro do estado), 6102 (venda interestadual)
- uCom (unidade comercial)
- qCom (quantidade)
- vUnCom (valor unitário)
- vProd (valor total do produto)
```

### 3.5 Impostos (por item)
```
- ICMS (Imposto sobre Circulação de Mercadorias)
  - CST (código de situação tributária)
  - pICMS (alíquota)
  - vICMS (valor)
- PIS (Programa de Integração Social)
- COFINS (Contribuição para Financiamento da Seguridade Social)
- IPI (se aplicável — industrialização)
```

### 3.6 Totais
```
- vNF (valor total da NF-e)
- vProd (valor total dos produtos)
- vFrete, vSeg, vDesc, vOutro (frete, seguro, desconto, outras despesas)
- vTotTrib (total de tributos — aproximação)
```

---

## 4. Integração com o Elitium ERP

### 4.1 Novos Models/Tabelas

```typescript
// Tabela: invoices
interface Invoice {
  id: string;
  orderId: string;           // Referência ao pedido
  number: number;            // Número da NF-e
  series: number;            // Série (padrão: 1)
  accessKey: string;         // Chave de acesso (44 dígitos)
  status: 'pending' | 'authorized' | 'cancelled' | 'denied';
  protocol: string;          // Protocolo de autorização SEFAZ
  xmlAuthorized: string;     // XML autorizado (armazenar)
  xmlPath: string;           // Caminho do XML no storage
  pdfPath: string;           // Caminho do DANFE PDF
  totalValue: number;
  taxValue: number;
  issuedAt: Date;
  cancelledAt?: Date;
  cancelProtocol?: string;
  sefazMessage: string;      // Mensagem de retorno da SEFAZ
  environment: 'homologation' | 'production';
  createdAt: Date;
}
```

### 4.2 Novas Rotas de API

```
POST   /api/invoices              → Emitir NF-e para um pedido
GET    /api/invoices/:id          → Consultar NF-e
GET    /api/invoices/:id/xml      → Download do XML
GET    /api/invoices/:id/pdf      → Download do DANFE PDF
POST   /api/invoices/:id/cancel   → Cancelar NF-e
GET    /api/invoices              → Listar NF-e emitidas
```

### 4.3 Nova Página no ERP

**`/invoices`** — Tela de Notas Fiscais:
- Listagem de NF-e emitidas com status (autorizada, cancelada, pendente)
- Botão "Emitir NF-e" no detalhe do pedido (quando status = completed)
- Visualização do DANFE inline
- Download de XML e PDF
- Fluxo de cancelamento (dentro do prazo de 24h)

### 4.4 Configurações Necessárias

No painel Admin, adicionar seção **"Nota Fiscal"**:
- Upload do Certificado A1 (`.pfx`) — armazenar criptografado
- Senha do certificado
- Ambiente (Homologação / Produção)
- Série padrão
- Natureza da operação padrão
- Regime tributário (CRT)
- Alíquotas padrão por NCM (ou usar tabela de alíquotas do Simples Nacional)

---

## 5. Biblioteca Recomendada: `node-nfe`

```bash
npm install node-nfe
```

### Exemplo de Uso (Pseudocódigo)

```typescript
import { NFe, WebService } from 'node-nfe';
import fs from 'fs';

// Carregar certificado
const certificado = fs.readFileSync('./certificado.pfx');
const senha = process.env.CERTIFICATE_PASSWORD;

// Configurar ambiente
const nfe = new NFe({
  ambiente: 'homologação', // ou 'produção'
  certificado,
  senha,
  uf: 'SP',
});

// Montar NF-e
const nota = nfe.criarNota({
  emitente: {
    cnpj: '12345678000199',
    razaoSocial: 'Elitium LTDA',
    nomeFantasia: 'Elitium',
    ie: '123456789',
    crt: 1, // Simples Nacional
    endereco: { ... },
  },
  destinatario: {
    cpf: '12345678901',
    nome: 'Cliente Exemplo',
    endereco: { ... },
  },
  itens: [
    {
      codigo: 'SACOLA-001',
      descricao: 'Sacola Personalizada TNT',
      ncm: '63052000',
      cfop: '5102',
      unidade: 'UN',
      quantidade: 100,
      valorUnitario: 25.00,
      impostos: {
        icms: { cst: '01', aliquota: 18, valor: 450.00 },
        pis: { cst: '01', aliquota: 1.65, valor: 41.25 },
        cofins: { cst: '01', aliquota: 7.60, valor: 190.00 },
      },
    },
  ],
  pagamento: { forma: '01', valor: 2500.00 }, // 01=Dinheiro
});

// Enviar para SEFAZ
const resultado = await nfe.autorizar(nota);

if (resultado.autorizada) {
  // Salvar XML autorizado
  fs.writeFileSync(`./nf-e/${resultado.chaveAcesso}.xml`, resultado.xml);

  // Gerar DANFE (PDF)
  const pdf = await nfe.gerarDANFE(resultado.xml);
  fs.writeFileSync(`./nf-e/${resultado.chaveAcesso}.pdf`, pdf);

  console.log(`NF-e autorizada! Protocolo: ${resultado.protocolo}`);
}
```

---

## 6. Impostos — Simplificação para Começar

### 6.1 Simples Nacional (CRT = 1)
Se a empresa é do Simples Nacional, os impostos são mais simples:
- **ICMS:** Alíquota conforme faixa do Simples (geralmente 4%–18%)
- **PIS/COFINS:** Dentro do DAS (não precisa calcular separado)
- **IPI:** Geralmente não se aplica para comércio

### 6.2 Tabela de Alíquotas Padrão
Para começar, criar uma tabela de alíquotas por NCM:

```typescript
const taxTable: Record<string, { icms: number; pis: number; cofins: number }> = {
  '63052000': { icms: 18, pis: 1.65, cofins: 7.60 }, // Sacolas TNT
  '39232990': { icms: 18, pis: 1.65, cofins: 7.60 }, // Sacolas plásticas
  '48194000': { icms: 18, pis: 1.65, cofins: 7.60 }, // Sacolas papel
};
```

### 6.3 CFOP Comuns
| CFOP | Descrição |
|------|-----------|
| 5102 | Venda de mercadoria dentro do estado |
| 6102 | Venda de mercadoria para outro estado |
| 5405 | Venda de mercadoria sujeita a ST dentro do estado |
| 6405 | Venda de mercadoria sujeita a ST para outro estado |

---

## 7. Cronograma Sugerido

| Fase | Duração | Descrição |
|------|---------|-----------|
| **Fase 1** | 2 semanas | Configuração: certificado, homologação, models, rotas base |
| **Fase 2** | 3 semanas | Emissão NF-e: montagem XML, assinatura, transmissão SEFAZ |
| **Fase 3** | 1 semana | DANFE: geração do PDF com layout oficial |
| **Fase 4** | 1 semana | Integração UI: botão emitir no pedido, tela de NF-e |
| **Fase 5** | 1 semana | Cancelamento, carta de correção, inutilização |
| **Fase 6** | 2 semanas | Testes em homologação com SEFAZ, ajustes finais |
| **Total** | ~10 semanas | |

---

## 8. Custos Estimados

| Item | Custo |
|------|-------|
| Certificado A1 | R$ 150–400/ano |
| Consulta SEFAZ | Gratuito (emissão própria) |
| Servidor (se adicionar processamento XML) | R$ 0–50/mês extra |
| Horas de desenvolvimento | ~160h (estimativa) |

---

## 9. Alternativas: APIs de Terceiros (mais rápido)

Se quiser lançar mais rápido sem lidar diretamente com a SEFAZ:

| Serviço | Preço | Vantagem |
|---------|-------|----------|
| **Tiny ERP** | R$ 100–300/mês | API REST pronta, emite NF-e/NFC-e/NFSe |
| **Bluesoft ERP** | R$ 150+/mês | API completa, integração fácil |
| **Focus NFe** | R$ 0,50–2,00/NF-e | API REST, sem mensalidade, paga por nota |
| **Emites** | R$ 1,00–3,00/NF-e | API simples, bom para baixo volume |
| **TinyNF-e** (via Tiny) | Incluso no plano Tiny | Se já usar Tiny para estoque |

### Exemplo com Focus NFe (API REST):

```typescript
// Emissão via API de terceiros — muito mais simples
const response = await fetch('https://api.focusnfe.com.br/v2/nfe', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa('TOKEN:'),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    natureza_operacao: 'Venda',
    serie: 1,
    emitente: { ... },
    destinatario: { ... },
    itens: [{ ... }],
  }),
});
```

---

## 10. Recomendação

**Para começar rápido:** Usar **Focus NFe** ou **Emites** como API intermediária.
- Não precisa de certificado digital próprio (o serviço gerencia)
- API REST simples, integra em dias ao invés de semanas
- Custo baixo (paga por nota emitida)
- Depois, se o volume justificar, migrar para emissão própria com certificado

**Para controle total:** Implementar com `node-nfe` + certificado A1.
- Sem dependência de terceiros
- Custo menor em alto volume
- Mais complexo de manter

---

## Próximos Passos Imediatos

1. [ ] Definir se usará API terceira ou emissão própria
2. [ ] Obter Certificado Digital A1 (se emissão própria)
3. [ ] Criar tabela `invoices` no banco de dados
4. [ ] Criar model e rotas `/api/invoices`
5. [ ] Implementar tela de configuração NF-e no Admin
6. [ ] Testar emissão em homologação
