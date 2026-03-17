import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Pedido } from "@/models/firebaseModels";

// =========================
// BUSCAR PEDIDOS (NORMALIZADO)
// =========================
export const buscarPedidos = async (): Promise<Pedido[]> => {
  const pedidosRef = collection(db, "pedidos");
  const q = query(pedidosRef, orderBy("dataPedido", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any;

    return {
      id: docSnap.id,
      ...data,
      produtos: Array.isArray(data.produtos) ? data.produtos : [], // 🔥 BLINDAGEM DEFINITIVA
    } as Pedido;
  });
};

// =========================
// CRIAR PEDIDO
// =========================
export const criarPedido = async (
  pedido: Omit<Pedido, "id">
): Promise<void> => {
  const pedidosRef = collection(db, "pedidos");
  await addDoc(pedidosRef, pedido);
};

// =========================
// ATUALIZAR PEDIDO
// =========================
export const atualizarPedido = async (
  pedidoId: string,
  pedido: Omit<Pedido, "id">
): Promise<void> => {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await updateDoc(pedidoRef, pedido);
};

// =========================
// DELETAR PEDIDO
// =========================
export const deletarPedido = async (pedidoId: string): Promise<void> => {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await deleteDoc(pedidoRef);
};
