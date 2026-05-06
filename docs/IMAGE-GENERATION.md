# Shtar ERP — Documentação de Problemas e Soluções

> Resumo completo dos problemas encontrados e soluções aplicadas durante a restauração e melhoria do sistema de geração de imagem de produto.

---

## 📋 Índice

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

O projeto **Shtar ERP** é um sistema de gestão que inclui geração de imagens de produto via IA (sacolas, camisetas, canecas). O usuário reportou que após diversas alterações recentes, o sistema de geração de imagem estava inconsistente — gerando imagens com problemas de logo, cor e renderização.

**Repositório**: https://github.com/SudreScodeS/Shtar-ERP

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
Restauramos para a abordagem Shtars do commit `738dc65`:
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
| `2058263` | 2026-05-06 | Restauração do estado funcional (base Shtars) |
| `d425f4c` | 2026-05-06 | Adicionado grupo de cores (azul, amarelo, preto, vermelho) |
| `949a46f` | 2026-05-06 | Prompt detalhado com variáveis + logo via img2img |
| `7babdca` | 2026-05-06 | Remoção robusta de fundo da logo (gradiente) |
| `e5dc6b3` | 2026-05-06 | Forma consistente com base neutra cacheada |
| `09b0239` | 2026-05-06 | Recolor via sharp + logo posicionada corretamente |

---

## 10. Arquivos Modificados

### `app/api/product-image/route.ts`
API de geração de imagem de produto. Responsável por:
- Gerar base neutra via FLUX.1-schnell
- Recolorir via sharp (luminância × cor)
- Remover fundo da logo
- Compor logo na posição correta

### `app/components/product-preview.tsx`
Componente de prévia do produto. Responsável por:
- Chamar a API com cor, estilo e variáveis
- Exibir a imagem gerada
- Canvas fallback quando IA não está configurada
- Não aplica overlays quando API já processou a imagem

### `app/sales/page.tsx`
Página de vendas. Passa para o ProductPreview:
- `selectedColorHex` / `selectedColorName`
- `selectedMaterialName`
- `selectedVariables` (array com nomes de todas as variáveis selecionadas)
- `logoDataUrl`

### `data/groups.json`
Grupo "Cor" adicionado com ID `group-color`.

### `data/variables.json`
4 variáveis de cor: Azul, Amarelo, Preto, Vermelho.

### `app/lib/logo-compositor.ts`
Engine de composição de logo (Canvas client-side). **Não é mais usado** pelo product-preview (foi substituído pela composição server-side). Existe como dead code.

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

1. **Base neutra é compartilhada entre todos os produtos do mesmo estilo**
   - Se houver dois produtos "Sacola Personalizada" diferentes, compartilham a mesma base
   - Solução futura: cache por produto (não apenas por estilo)

2. **Recolor via sharp é uma aproximação**
   - Multiplica luminância × cor → resultado é uma "versão colorida" da base cinza
   - Para cores muito escuras (preto), a luminância pode não ser ideal
   - Para cores muito claras (branco), o produto pode ficar invisível

3. **Posição da logo é fixa por estilo**
   - Não detecta automaticamente onde está o produto na imagem
   - Se a base neutra gerar uma sacola deslocada, a logo acompanha o deslocamento

4. **Logo com fundo complexo pode não ser removida perfeitamente**
   - A detecção funciona bem para fundos escuros/gradientes
   - Fundos com cores vivas ou padrões podem não ser detectados

### Melhorias futuras possíveis:

1. **Gerar base por produto** (não apenas por estilo) — cache key incluiria productId
2. **Detecção automática do produto** na imagem (bounding box) para posicionamento dinâmico da logo
3. **Suporte a múltiplas logos** (frente + costas + laterais)
4. **Preview em tempo real** — gerar miniatura rápida antes da imagem final
5. **Queue de geração** — evitar múltiplas gerações simultâneas sobrecarregarem a API

---

*Documento gerado em 2026-05-06. Última atualização: commit `09b0239`.*
