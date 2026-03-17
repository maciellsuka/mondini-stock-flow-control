import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { ProdutoComBags, ProdutoNoPedido } from "@/models/firebaseModels";

/**
 * Dá baixa no estoque das bags usadas em um pedido
 * - Subtrai o peso usado
 * - Atualiza status para "vendido" quando peso <= 0
 *
 * NÃO valida UI
 * NÃO calcula pedido
 * NÃO cria pedido
 */
export async function devolverEstoqueBags(produtosPedido: ProdutoNoPedido[]) {
  for (const produto of produtosPedido) {
    for (const bag of produto.bags) {
      const bagRef = doc(db, "produtos", produto.id, "bags", bag.bagId);

      await updateDoc(bagRef, {
        pesoKg: increment(bag.pesoKg),
        status: "disponivel",
      });
    }
  }
}

export async function baixarEstoqueBags(
  produtosPedido: ProdutoNoPedido[],
  produtosDisponiveis: ProdutoComBags[]
): Promise<void> {
  for (const produtoPedido of produtosPedido) {
    const produtoAtual = produtosDisponiveis.find(
      (p) => p.id === produtoPedido.id
    );

    if (!produtoAtual) continue;

    for (const bagUsada of produtoPedido.bags) {
      const bagAtual = produtoAtual.bags.find((b) => b.id === bagUsada.bagId);

      if (!bagAtual) continue;

      const novoPeso = Math.max(0, bagAtual.pesoKg - bagUsada.pesoKg);

      const bagRef = doc(
        db,
        "produtos",
        produtoPedido.id,
        "bags",
        bagUsada.bagId
      );

      await updateDoc(bagRef, {
        pesoKg: novoPeso,
        status: novoPeso <= 0 ? "vendido" : "disponivel",
      });
    }
  }
}
