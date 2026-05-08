# Elitium — Documentação de Problemas e Soluções

> Resumo completo dos problemas encontrados e soluções aplicadas durante a restauração e melhoria do sistema de geração de imagem de produto.

---

## Indice

1. [Contexto Inicial](#1-contexto-inicial)
2. [Problema 1: Sistema de Imagem Quebrado](#2-problema-1-sistema-de-imagem-quebrado)
3. [Problema 2: Cor Não Mudava](#3-problema-2-cor-não-mudava)
4. [Problema 3: Logo com Fundo Retangular](#4-problema-3-logo-com-fundo-retangular)
5. [Problema 4: Sacola Mudava de Tamanho](#5-problema-4-sacola-mudava-de-tamanho)
6. [Problema 5: Logo Mal Posicionada](#6-problema-5-logo-mal-posicionada)
7. [Problema 6: Logo Distorcida pelo img2img](#7-problema-6-logo-distorcida-pelo-img2img)
8. [Arquitetura Final](#8-arquitetura-final)
9. [Commits Relevantes](#9-commits-relevantes)
10. [Arquivos Modificados](#10-arquivos-modificados)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Limitações e Notas](#12-limitações-e-notas)

---

## 1. Contexto Inicial

O projeto **Elitium** é um sistema de gestão que inclui geração de imagens de produto via IA (sacolas, camisetas, canecas). O usuário reportou que após diversas alterações recentes, o sistema de geração de imagem estava inconsistente — gerando imagens com problemas de logo, cor e renderização.

**Repositório**: https://github.com/SudreScodeS/Elitium-ERP

### Commits analisados (do mais antigo para o mais recente):
```
738dc65  feat: geração de imagem por IA + composição Canvas em tempo real
9da51ae  fix: endpoint correto do Hugging Face Inference API
a450866  fix: SEMPRE gerar imagem por IA — estoque é opcional
627ebd8  feat: professional logo compositing engine
1d56009  fix: voltar para geração de imagem por IA com suporte a img2img
f7ae016  fix: logo não aparecia na prévia + img2img mais fiel ao produto
a46393d  fix: logo compositing - stale closure, realistic integration
010e299  fix: logo tamanho e posicionamento — maior, centralizada
de6bb59  fix: logo opaca e fantasma de sacola — ajustes compositor
461eb6a  feat: IA gera sacola COM logo integrada (não apenas overlay)
1a0601b  fix: remover fundo da logo antes de compor com sharp
a70e1ad  fix: realistic logo integration via improved img2img prompts
4b7cef0  fix: consistent product shape across colors + remove white gaps
e94376d  fix: use sharp-based recolor instead of unreliable img2img
ffbb696  fix: recolor only product (not background) + use stock photo directly
```

---

## 2. Problema 1: Sistema de Imagem Quebrado

### Situação
O código em `HEAD` (`ffbb696`) tinha um pipeline complexo e frágil:
- Usava foto de estoque como referência (img2img)
- Recoloria com sharp + refinava com img2img
- Compositava logo com sharp
- Integrava logo com img2img (SDXL refiner)

### Causa raiz
O pipeline tinha **6 pontos de falha** diferentes:
1. Fetch da foto de estoque podia falhar
2. img2img de recolor podia falhar (modelo carregando)
3. Composição da logo com sharp
4. img2img de integração da logo podia falhar
5. Múltiplas chamadas de API = latência alta
6. Cache complexo com muitas variáveis

### Solução
Restauramos para a abordagem Elitium do commit `738dc65`:
- API gera imagem via text-to-image (FLUX.1-schnell)
- Frontend compõe cor e logo via Canvas

**Commit**: `2058263` — `chore: restore stable image generation state`

---

## 3. Problema 2: Cor Não Mudava

### Situação
Quando o usuário selecionava uma cor diferente (ex: amarelo), a sacola continuava cinza.

### Causa raiz
A abordagem usava **img2img (SDXL refiner)** para mudar a cor de uma base neutra. O modelo SDXL:
- Não estava acessível com a token HF fornecida
- Ou não recoloria corretamente (strength inadequado)
- Resultado: fallback para a base neutra cinza

### Solução
Substituímos img2img por **sharp recolor** (100% confiável, sem dependência de API externa):

```
1. Extrair luminância da base neutra (tons de cinza)
2. Criar camada de cor sólida com a cor desejada
3. Multiplicar: cor × luminância → produto colorido
4. Criar máscara: pixels não-brancos = produto
5. Compor: fundo branco + produto colorido (via máscara)
```

**Resultado**: APENAS o produto muda de cor. Fundo branco permanece intacto.

**Commit**: `09b0239` — `fix: recolor via sharp (confiável) + logo posicionada corretamente`

---

## 4. Problema 3: Logo com Fundo Retangular

### Situação
A logo FIAP tinha um fundo retangular escuro (gradiente de #101828 a #3B4B5C) que não era removido. A logo aparecia como um "adesivo" colado na sacola.

### Causa raiz
A remoção de fundo anterior:
- Amostrava apenas **8 pontos** das bordas (insuficiente para gradientes)
- Usava threshold baseado em **distância de cor** (não funcionava para gradientes)
- O fundo da logo era um gradiente escuro → cor variava ao longo do retângulo

### Solução
Reescrevemos completamente a função `removeLogoBackground`:

1. **Amostra TODOS os pixels das bordas** (5% da dimensão) — centenas de pontos
2. **Calcula luminância média** das bordas (detecta se fundo é escuro ou claro)
3. **Para fundos escuros** (luminância < 80):
   - Usa luminância como critério principal
   - Combina com distância de cor
   - Threshold adaptativo baseado na luminância do fundo
4. **Auto-crop** com `sharp.trim()` — remove bordas transparentes
5. **Feathering suave** (blur 1.5px) nas bordas de transição

**Commit**: `7babdca` — `fix: remoção robusta de fundo da logo (gradiente escuro)`

---

## 5. Problema 4: Sacola Mudava de Tamanho

### Situação
A cada geração, a sacola mudava de forma/tamanho. A posição da logo ficava inconsistente.

### Causa raiz
O FLUX.1-schnell gera uma **imagem nova** a cada chamada de text-to-image. Mesmo com o mesmo prompt, a forma do produto varia levemente.

### Solução
**Base neutra cacheada** — gerada UMA VEZ e reusada:

```
1. FLUX txt2img → base neutra (cinza) → CACHEADA no servidor
2. Sharp recolor → muda SÓ a cor (mesma forma sempre)
3. Logo composta na posição fixa (calculada sobre a forma consistente)
```

**Resultado**: Todas as cores usam a MESMA base. A forma é idêntica.

**Commit**: `e5dc6b3` — `feat: forma consistente com img2img para cor + logo integrada`

---

## 6. Problema 5: Logo Mal Posicionada

### Situação
A logo aparecia na **dobra da boca** da sacola (parte superior), não no centro do painel frontal.

### Causa raiz
O cálculo da posição usava **22% da altura total** da imagem. Mas a sacola não ocupa 100% da imagem — tem espaço em cima (alças) e embaixo (sombra). 22% do topo = dobra da boca.

### Solução
Recalculamos a posição baseada na **área útil do produto**:

| Produto | Posição Y | Justificativa |
|---------|-----------|---------------|
| Sacola | 38% do topo | Centro do corpo (entre 25% e 85% da altura) |
| Camiseta | 30% do topo | Área do peito |
| Caneca | 30% do topo | Centro da face frontal |

**Commit**: `09b0239` — `fix: recolor via sharp (confiável) + logo posicionada corretamente`

---

## 7. Problema 6: Logo Distorcida pelo img2img

### Situação
Após a composição da logo com sharp, um passo de img2img (SDXL refiner) era usado para "integrar" a logo no material. O resultado:
- Logo borrada e desfocada
- Texto "derretido" ou deformado
- Cores fantasmas (ciano/magenta) ao redor das letras

### Causa raiz
O img2img com strength 0.40 **modificava a logo** junto com o produto. O modelo tentava "reinterpretar" a logo como parte do material, distorcendo o texto.

### Solução
**Removemos o img2img de integração**. A logo é composta apenas com sharp:
- Fundo removido (detecção de gradiente)
- Composta com `blend: 'over'` (usa alpha channel)
- Sem processamento adicional que distorça

**Resultado**: Logo limpa, nítida, com fundo transparente.

**Commit**: `09b0239`

---

## 8. Arquitetura Final

### Fluxo de geração de imagem:

```
┌─────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. BASE NEUTRA (cached, gerada UMA VEZ)                │
│     FLUX.1-schnell txt2img → sacola cinza 512×640       │
│     └→ Cacheado no servidor (neutralBaseCache)           │
│                                                          │
│  2. RECOLOR VIA SHARP (100% confiável)                  │
│     Base cinza → extrai luminância                       │
│     → multiplica pela cor desejada                       │
│     → máscara: só o produto muda de cor                  │
│     → resultado: sacola amarela/vermelha/azul/etc        │
│                                                          │
│  3. LOGO (se fornecida)                                  │
│     a. Remove fundo (gradiente escuro detectado)         │
│     b. Auto-crop + feathering                            │
│     c. Redimensiona (40% largura, 30% altura)           │
│     d. Posiciona a 38% do topo (centro do corpo)        │
│     e. Compõe com sharp blend 'over'                     │
│                                                          │
│  RESULTADO: imagem final (WebP)                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Modelos utilizados:

| Modelo | Uso | Quando |
|--------|-----|--------|
| FLUX.1-schnell | Text-to-image | Base neutra (uma vez por estilo) |
| ~~SDXL refiner~~ | ~~img2img recolor~~ | Removido — sharp é mais confiável |
| ~~SDXL refiner~~ | ~~img2img logo integration~~ | Removido — distorcia a logo |

### Chamadas por geração:

| Cenário | Chamadas HF | Chamadas Sharp |
|---------|-------------|----------------|
| Sem logo, 1ª vez | 1 (base) | 1 (recolor) |
| Sem logo, cache | 0 | 1 (recolor) |
| Com logo, 1ª vez | 1 (base) | 3 (recolor + remove bg + composite) |
| Com logo, cache | 0 | 3 (recolor + remove bg + composite) |

---

## 9. Commits Relevantes

| Hash | Data | Descrição |
|------|------|-----------|
| `2058263` | 2026-05-06 | Restauração do estado funcional (base Elitium) |
| `d425f4c` | 2026-05-06 | Adicionado grupo de cores (azul, amarelo, preto, vermelho) |
| `949a46f` | 2026-05-06 | Prompt detalhado com variáveis + logo via img2img |
| `7babdca` | 2026-05-06 | Remoção robusta de fundo da logo (gradiente) |
| `e5dc6b3` | 2026-05-06 | Forma consistente com base neutra cacheada |
| `09b0239` | 2026-05-06 | Recolor via sharp + logo posicionada corretamente |
| `ed7dbc0` | 2026-05-09 | Blue brand theme + logo bg removal + product compositing |
| `9e4536c` | 2026-05-09 | Sacola azul realista com logo branca (referência) |
| `2068b98` | 2026-05-09 | Sacola fotorrealista via FLUX.1-schnell |
| `669186e` | 2026-05-09 | Recolor do produto cadastrado + logo proeminente |
| `11daa1d` | 2026-05-09 | Smart pipeline: análise de referência + detecção de logo |
| `1fc67a1` | 2026-05-09 | Pipeline completo: material, cor, posição, tamanho |
| `70fcf35` | 2026-05-09 | Fix: previne composição dupla da logo |
| `e554477` | 2026-05-09 | Fix: logo impressa na sacola (não sobreposta) |
| `497f98c` | 2026-05-09 | Fix crítico: remoção de fundo da logo (threshold bug) |

---

## 10. Arquivos Modificados

### `app/api/product-image/route.ts`
API de geração de imagem de produto. Pipeline completo:
- Analisa imagem de referência → detecta região do produto e da logo (grid 20x20)
- Gera sacola fotorrealista via FLUX.1-schnell com descrição do material
- Recoloreia para a cor selecionada via algoritmo de luminância
- Remove fundo da logo com detecção adaptativa (mediana + tolerância)
- Compõe logo na posição detectada com efeitos de impressão
- Suporte a printPosition (frente/verso/ambos) e printSize (pequeno/médio/grande)

### `app/components/product-preview.tsx`
Componente de prévia do produto:
- Envia material, printPosition, printSize para a API
- Canvas não desenha logo quando API já compôs (`Boolean(apiImage)`)
- Previne composição dupla via verificação `+logo` no imageSource

### `app/sales/page.tsx`
Página de vendas:
- PreviewConfig agora inclui printPosition e printSize
- Passa material, cor, posição e tamanho para a API

### SVG Logos (public/)
Tema atualizado de roxo para azul:
- `LogoE.svg` — "E" em gradiente azul sobre fundo escuro
- `LogoC.svg` — "E" em azul sobre fundo claro
- `logo.svg` — texto "Elitium" com acento azul
- `logo-product.svg` — logo azul para uso em produtos

---

## 11. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `HUGGINGFACE_API_TOKEN` | Sim | Token da Hugging Face para FLUX.1-schnell |

**Onde configurar**: `.env.local` na raiz do projeto

**Como obter**: https://huggingface.co/settings/tokens (gratuito)

---

## 12. Limitações e Notas

### Limitações atuais:

1. **FLUX.1-schnell é assíncrono** — primeira geração pode demorar 15-30s (modelo carregando)
2. **Detecção de região da logo via grid** — funciona bem para logos centrais, mas pode errar para logos em posições excêntricas
3. **Recolor é uma aproximação** — para cores muito claras/escuras o resultado pode não ser ideal
4. **Textura de impressão é sutil** — o efeito multiply pode não ser visível em todas as imagens

### Melhorias futuras possíveis:

1. **Cache por produto** — incluir productId na cache key
2. **Detecção de produto com ML** — usar modelo de segmentação em vez de grid de luminância
3. **Múltiplas logos** — frente + costas + laterais
4. **Preview em tempo real** — gerar miniatura rápida antes da imagem final
5. **Queue de geração** — evitar múltiplas gerações simultâneas
6. **img2img com referência** — usar a imagem de referência como input para FLUX img2img

---

## 13. Pipeline Inteligente (v2 — 2026-05-09)

### Fluxo completo:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE INTELIGENTE v2                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ANÁLISE DA REFERÊNCIA                                        │
│     Imagem cadastrada → detecta produto + região da logo          │
│     └→ Grid 20x20 de luminância → cluster mais brilhante = logo  │
│                                                                  │
│  2. GERAÇÃO FOTORREALISTA                                        │
│     FLUX.1-schnell → sacola com textura do material               │
│     └→ Prompt inclui: cor + material (nylon/TNT/lona/etc)        │
│                                                                  │
│  3. RECOLORAÇÃO                                                  │
│     Base FLUX → algoritmo de luminância → cor selecionada         │
│     └→ Preserva highlights e sombras originais                    │
│                                                                  │
│  4. REMOÇÃO DE FUNDO DA LOGO                                     │
│     Mediana das bordas → tolerância adaptativa                    │
│     └→ Fundo claro: remove > bgLum - tol                         │
│     └→ Fundo escuro: remove < bgLum + tol (capped 255)           │
│                                                                  │
│  5. COMPOSIÇÃO DA LOGO                                           │
│     Logo branca (sacolas escuras) ou escura (sacolas claras)      │
│     └→ Shadow (over) + Logo (over) + Texture (multiply)          │
│     └→ Posição mapeada da referência → imagem gerada              │
│     └→ Suporte frente/verso/ambos                                │
│                                                                  │
│  6. SAÍDA                                                        │
│     WebP 92% qualidade + cache 1h                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Detecção automática:

| Parâmetro | Como é detectado |
|-----------|-----------------|
| Região do produto | Pixels não-brancos na referência |
| Região da logo | Cluster de pixels brancos (grid 20x20) |
| Material | Variável selecionada pelo usuário |
| Cor | Variável de cor selecionada |
| Posição da logo | printPosition (front/back/both) |
| Tamanho da logo | printSize (small/medium/large) |
| Cor da logo | Automática: branca em fundo escuro, escura em fundo claro |

---

*Documento gerado em 2026-05-06. Última atualização: commit `497f98c` (2026-05-09).*
