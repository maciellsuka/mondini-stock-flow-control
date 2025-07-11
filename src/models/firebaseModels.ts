// 🔥 FIRESTORE MODELS COM BAGS POR PESO 🔥

// ==========================
// 📦 Produto principal
// ==========================
export interface Produto {
  id: string;
  nomeProd: string;
  descricao?: string;
  precoPorKg: number;
  tipo: "moído" | "borra" | "outro";
}

// ==========================
// 🧊 Bag individual (subcoleção dentro de produto)
// ==========================
export interface Bag {
  produtoId: string;
  id: string;
  pesoKg: number;
  status: "disponivel" | "reservado" | "vendido";
  criadoEm: Date;
}

// ==========================
// 🧍 Cliente
// ==========================
export interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

// ==========================
// 🧾 Produto dentro do Pedido
// ==========================
export interface ProdutoNoPedido {
  id: string;
  nomeProd: string;
  precoPorKg: number;
  bags: {
    bagId: string;
    pesoKg: number;
    total: number;
  }[];
}

// ==========================
// 📑 Pedido
// ==========================
export interface Pedido {
  id: string;
  clienteId: string;
  clienteNome: string;
  condicaoPagamento: string;
  criadoEm: Date;
  numeroPedido: string;
  observacao?: string;
  transportadora?: string;
  vencimento?: Date;
  produtos: ProdutoNoPedido[];
  total: number;

    // ✅ Adicione isso:
  status: "pendente" | "processando" | "concluido" | "cancelado";
}

export interface ProdutoComBags extends Produto {
  bags: Bag[];
}

// ==========================
// 🧮 Função para calcular o total do pedido
// ==========================
export const calcularTotalPedido = (produtos: ProdutoNoPedido[]): number => {
  return produtos.reduce((acc, prod) => {
    const totalBags = prod.bags.reduce((soma, b) => soma + b.total, 0);
    return acc + totalBags;
  }, 0);
};
