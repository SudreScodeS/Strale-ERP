// lib/inventory.ts
// Operações de leitura do módulo de estoque dinâmico
// Separar consultas específicas do inventário em um arquivo dedicado

import { productData, groupData, variableData } from './data';

export function getInventoryState() {
  const products = productData.getAll();
  const groups = groupData.getAll();
  const variables = variableData.getAll();

  return products.map((product) => ({
    ...product,
    groups: groups
      .filter((group) => group.productId === product.id)
      .map((group) => ({
        ...group,
        variables: variables.filter((variable) => variable.groupId === group.id),
      })),
  }));
}
