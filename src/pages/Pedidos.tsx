import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  deleteDoc,
  orderBy,
} from "firebase/firestore";

import {
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  Calendar,
  Package,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { generatePedidoPDF } from "@/utils/pdfGenerator";

type StatusPedido = "pendente" | "processando" | "concluido" | "cancelado";

interface Cliente {
  id: string;
  nome: string;
}

interface Bag {
  id: string;
  pesoKg: number;
  status: "disponivel" | "reservado" | "vendido";
  criadoEm: Date;
  produtoId: string;
  identificador: string;
}

interface Produto {
  id: string;
  nomeProd: string;
  precoPorKg: number;
  bags: Bag[];
}

interface ItemPedido {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number; // em KG
  precoUnitario: number;
  subtotal: number;
  bagsUsadas: { bagId: string; pesoUsado: number }[];
}

interface Pedido {
  id: string;
  clienteId: string;
  clienteNome: string;
  dataPedido: string;
  dataEntrega?: string;
  status: StatusPedido;
  itens: ItemPedido[];
  total: number;
  observacoes?: string;
  numeroPedido?: string;
  formaPagamento?: string;
  prazoPagamento?: string; // Corrigido para existir
}

export default function Pedidos() {
  // States
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

  // Estado com prazoPagamento incluído para evitar erro de tipagem
  const [formData, setFormData] = useState({
    clienteId: "",
    dataEntrega: "",
    status: "pendente" as StatusPedido,
    observacoes: "",
    numeroPedido: "",
    formaPagamento: "",
    prazoPagamento: "",
  });

  const [itens, setItens] = useState<ItemPedido[]>([]);

  // Para seleção de novo item produto, quantidade e bags
  const [novoItemProdutoId, setNovoItemProdutoId] = useState<string>("");
  const [novoItemQuantidade, setNovoItemQuantidade] = useState<number>(0);

  const [bagsSelecionadas, setBagsSelecionadas] = useState<
    { bagId: string; pesoUsado: number; selecionada: boolean }[]
  >([]);

  // === Fetch dados ===

  // Buscar clientes do Firestore
  const fetchClientes = async () => {
    const clientesCol = collection(db, "clientes");
    const snapshot = await getDocs(clientesCol);
    const clientesData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Cliente, "id">),
    }));
    setClientes(clientesData);
  };

  // Buscar produtos com bags
  const fetchProdutos = async () => {
    const produtosCol = collection(db, "produtos");
    const snapshotProdutos = await getDocs(produtosCol);
    const produtosData: Produto[] = [];

    for (const prodDoc of snapshotProdutos.docs) {
      const prodData = prodDoc.data();
      const bagsCol = collection(db, `produtos/${prodDoc.id}/bags`);
      const bagsSnap = await getDocs(bagsCol);
      const bagsData: Bag[] = bagsSnap.docs.map((b) => ({
        id: b.id,
        pesoKg: b.data().pesoKg,
        status: b.data().status,
        criadoEm: b.data().criadoEm?.toDate() ?? new Date(),
        produtoId: prodDoc.id,
        identificador: b.data().identificador || "",
      }));

      produtosData.push({
        id: prodDoc.id,
        nomeProd: prodData.nomeProd,
        precoPorKg: prodData.precoPorKg,
        bags: bagsData,
      });
    }
    setProdutos(produtosData);
  };

  // Buscar pedidos do Firestore
  const fetchPedidos = async () => {
    const pedidosCol = collection(db, "pedidos");
    const pedidosSnap = await getDocs(query(pedidosCol, orderBy("dataPedido", "desc")));

    const pedidosData: Pedido[] = pedidosSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        clienteId: d.clienteId,
        clienteNome: d.clienteNome,
        dataPedido: d.dataPedido,
        dataEntrega: d.dataEntrega || undefined,
        status: d.status,
        itens: d.itens,
        total: d.total,
        observacoes: d.observacoes || "",
        numeroPedido: d.numeroPedido || "",
        formaPagamento: d.formaPagamento || "",
        prazoPagamento: d.prazoPagamento || "",
      };
    });
    setPedidos(pedidosData);
  };

  useEffect(() => {
    fetchClientes();
    fetchProdutos();
    fetchPedidos();
  }, []);

  const resetForm = () => {
    setFormData({
      clienteId: "",
      dataEntrega: "",
      status: "pendente",
      observacoes: "",
      numeroPedido: "",
      formaPagamento: "",
      prazoPagamento: "",
    });
    setItens([]);
    setNovoItemProdutoId("");
    setNovoItemQuantidade(0);
    setBagsSelecionadas([]);
    setEditingPedido(null);
  };

  // Quando o produto para novo item mudar, carregar bags disponíveis
  useEffect(() => {
    if (!novoItemProdutoId) {
      setBagsSelecionadas([]);
      return;
    }
    const produto = produtos.find((p) => p.id === novoItemProdutoId);
    if (!produto) {
      setBagsSelecionadas([]);
      return;
    }
    // Bags disponíveis (status "disponivel" e peso > 0)
    const bagsDisp = produto.bags
      .filter((b) => b.status === "disponivel" && b.pesoKg > 0)
      .map((b) => ({ bagId: b.id, pesoUsado: 0, selecionada: false }));
    setBagsSelecionadas(bagsDisp);
  }, [novoItemProdutoId, produtos]);

  // Alternar seleção da bag e definir peso usado igual ao peso original quando selecionada
  const toggleBagSelecionada = (bagId: string) => {
    setBagsSelecionadas((prev) =>
      prev.map((bag) => {
        if (bag.bagId === bagId) {
          const produto = produtos.find((p) => p.id === novoItemProdutoId);
          const bagInfo = produto?.bags.find((b) => b.id === bagId);
          const pesoOriginal = bagInfo?.pesoKg ?? 0;
          return {
            ...bag,
            selecionada: !bag.selecionada,
            pesoUsado: !bag.selecionada ? pesoOriginal : 0,
          };
        }
        return bag;
      }),
    );
  };

  // Atualizar peso da bag e marca como selecionada se peso > 0
  const atualizarPesoBag = (bagId: string, peso: number) => {
    setBagsSelecionadas((prev) =>
      prev.map((bag) =>
        bag.bagId === bagId ? { ...bag, pesoUsado: peso > 0 ? peso : 0, selecionada: peso > 0 } : bag,
      ),
    );
  };

  // Calcular peso total selecionado nas bags
  const totalPesoSelecionado = () =>
    bagsSelecionadas.reduce((acc, bag) => (bag.selecionada ? acc + bag.pesoUsado : acc), 0);

  // Adicionar item no pedido com bags selecionadas manualmente
  const adicionarItem = () => {
    if (!novoItemProdutoId) return;

    const produto = produtos.find((p) => p.id === novoItemProdutoId);
    if (!produto) return;

    const pesoTotalSelecionado = totalPesoSelecionado();
    if (pesoTotalSelecionado <= 0) {
      alert("Selecione pelo menos uma bag com peso para adicionar o item.");
      return;
    }

    // Validar se peso usado em cada bag não ultrapassa estoque disponível
    for (const bagSel of bagsSelecionadas) {
      if (bagSel.selecionada) {
        const bagProduto = produto.bags.find((b) => b.id === bagSel.bagId);
        if (!bagProduto) {
          alert("Bag não encontrada no produto.");
          return;
        }
        if (bagSel.pesoUsado > bagProduto.pesoKg) {
          alert(
            `Peso selecionado para a bag ${bagSel.bagId} excede o estoque disponível (${bagProduto.pesoKg}kg).`,
          );
          return;
        }
      }
    }

    // Verificar se já existe item para esse produto no pedido
    const itemExistente = itens.find((item) => item.produtoId === produto.id);

    if (itemExistente) {
      // Atualiza quantidade e bags usadas (somando os pesos)
      const novaQtd = itemExistente.quantidade + pesoTotalSelecionado;

      // Combinar bags antigas e novas em um mapa para somar pesos
      const bagsUsadasMap = new Map<string, number>();
      for (const b of itemExistente.bagsUsadas) {
        bagsUsadasMap.set(b.bagId, (bagsUsadasMap.get(b.bagId) ?? 0) + b.pesoUsado);
      }
      for (const b of bagsSelecionadas) {
        if (b.selecionada) {
          bagsUsadasMap.set(b.bagId, (bagsUsadasMap.get(b.bagId) ?? 0) + b.pesoUsado);
        }
      }

      // Novo array de bags usadas
      const bagsUsadasAtualizadas = Array.from(bagsUsadasMap.entries()).map(([bagId, pesoUsado]) => ({
        bagId,
        pesoUsado,
      }));

      setItens((prev) =>
        prev.map((item) =>
          item.produtoId === produto.id
            ? {
                ...item,
                quantidade: novaQtd,
                subtotal: novaQtd * item.precoUnitario,
                bagsUsadas: bagsUsadasAtualizadas,
              }
            : item,
        ),
      );
    } else {
      // Novo item
      const novoItemPedido: ItemPedido = {
        id: Date.now().toString(),
        produtoId: produto.id,
        produtoNome: produto.nomeProd,
        quantidade: pesoTotalSelecionado,
        precoUnitario: produto.precoPorKg,
        subtotal: pesoTotalSelecionado * produto.precoPorKg,
        bagsUsadas: bagsSelecionadas
          .filter((b) => b.selecionada)
          .map((b) => ({ bagId: b.bagId, pesoUsado: b.pesoUsado })),
      };
      setItens((prev) => [...prev, novoItemPedido]);
    }

    // Resetar seleção
    setNovoItemProdutoId("");
    setNovoItemQuantidade(0);
    setBagsSelecionadas([]);
  };

  // Remover item do pedido
  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  // Calcular total do pedido
  const calcularTotal = () => {
    return itens.reduce((total, item) => total + item.subtotal, 0);
  };

  // Salvar pedido no Firestore e ajustar bags
  const handleSave = async () => {
    if (!formData.clienteId || itens.length === 0) {
      alert("Selecione um cliente e adicione pelo menos um item.");
      return;
    }

    // Buscar cliente válido
    const cliente = clientes.find((c) => c.id === formData.clienteId);
    if (!cliente) {
      alert("Cliente inválido.");
      return;
    }

    try {
      // Atualizar bags: subtrair peso usado e ajustar status
      for (const item of itens) {
        for (const bagUso of item.bagsUsadas) {
          const bagRef = doc(db, "produtos", item.produtoId, "bags", bagUso.bagId);

          const produtoBags = produtos.find((p) => p.id === item.produtoId)?.bags;
          const bagAtual = produtoBags?.find((b) => b.id === bagUso.bagId);
          if (!bagAtual) continue;

          const novoPeso = bagAtual.pesoKg - bagUso.pesoUsado;

          await updateDoc(bagRef, {
            pesoKg: novoPeso,
            status: novoPeso <= 0 ? "vendido" : "disponivel",
          });
        }
      }

      // Montar pedido para salvar
      const pedidoDataBase: Omit<Pedido, "id"> = {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        dataPedido: new Date().toISOString().split("T")[0],
        dataEntrega: formData.dataEntrega || undefined,
        status: formData.status,
        itens,
        total: calcularTotal(),
        observacoes: formData.observacoes,
        numeroPedido: formData.numeroPedido || undefined,
        formaPagamento: formData.formaPagamento,
      };

      const pedidoData = { ...pedidoDataBase };

      if (formData.formaPagamento === "A prazo" && formData.prazoPagamento.trim() !== "") {
        pedidoData.prazoPagamento = formData.prazoPagamento;
      } else {
        delete pedidoData.prazoPagamento;
      }

    if (editingPedido) {
      const pedidoRef = doc(db, "pedidos", editingPedido.id);
      await updateDoc(pedidoRef, pedidoData);
    } else {
      const pedidosCol = collection(db, "pedidos");
      await addDoc(pedidosCol, pedidoData);
    }

    alert("Pedido salvo com sucesso!");
    setIsDialogOpen(false);
    resetForm();
    fetchProdutos(); // Atualizar bags
    fetchPedidos(); // Atualizar lista
  } catch (error) {
    console.error(error);
    alert("Erro ao salvar pedido.");
  }
};

  // Editar pedido - popular formulário e itens
  const handleEdit = (pedido: Pedido) => {
    setEditingPedido(pedido);
    setFormData({
      clienteId: pedido.clienteId,
      dataEntrega: pedido.dataEntrega || "",
      status: pedido.status,
      observacoes: pedido.observacoes || "",
      numeroPedido: pedido.numeroPedido || "",
      formaPagamento: pedido.formaPagamento || "",
      prazoPagamento: pedido.prazoPagamento || "",
    });
    setItens(pedido.itens);
    setIsDialogOpen(true);
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 mt-1">Gerencie os pedidos dos clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPedido ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Dados Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select
                    value={formData.clienteId}
                    onValueChange={(v) => setFormData({ ...formData, clienteId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataEntrega">Data de Entrega</Label>
                  <Input
                    type="date"
                    value={formData.dataEntrega}
                    onChange={(e) => setFormData({ ...formData, dataEntrega: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numeroPedido">Número do Pedido</Label>
                  <Input
                    type="text"
                    placeholder="Ex: 2025-001"
                    value={formData.numeroPedido}
                    onChange={(e) => setFormData({ ...formData, numeroPedido: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
                  <Select
                    value={formData.formaPagamento}
                    onValueChange={(v) =>
                      setFormData({ ...formData, formaPagamento: v, prazoPagamento: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="À vista">À vista</SelectItem>
                      <SelectItem value="Parcelado">Parcelado</SelectItem>
                      <SelectItem value="A prazo">A prazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.formaPagamento === "A prazo" && (
                  <div className="space-y-2">
                    <Label htmlFor="prazoPagamento">Prazo</Label>
                    <Select
                      value={formData.prazoPagamento}
                      onValueChange={(v) => setFormData({ ...formData, prazoPagamento: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o prazo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="14 dias">14 dias</SelectItem>
                        <SelectItem value="21 dias">21 dias</SelectItem>
                        <SelectItem value="28 dias">28 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: StatusPedido) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="processando">Processando</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre o pedido"
                  />
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Itens do Pedido</h3>

                {/* Seleção do Produto e bags */}
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex gap-2 items-center">
                    <Select value={novoItemProdutoId} onValueChange={setNovoItemProdutoId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((produto) => {
                          const estoqueDisponivel = produto.bags
                            .filter((b) => b.status === "disponivel")
                            .reduce((acc, b) => acc + b.pesoKg, 0);
                          return (
                            <SelectItem key={produto.id} value={produto.id}>
                              {produto.nomeProd} - R$ {produto.precoPorKg.toFixed(2)} /kg -{" "}
                              <span className="font-bold text-green-600">
                                Disponível: {estoqueDisponivel.toFixed(2)} kg
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {/* Mostrar total peso selecionado (não editável) */}
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={totalPesoSelecionado().toFixed(2)}
                      onChange={() => {}}
                      placeholder="Peso total (kg)"
                      className="w-32"
                      readOnly
                    />
                  </div>

                  {/* Listagem bags para seleção */}
                  {bagsSelecionadas.length > 0 && (
                    <div className="border rounded p-3 max-h-48 overflow-y-auto">
                      <p className="mb-2 font-medium">Selecione as bags e informe o peso retirado:</p>
                      {bagsSelecionadas.map((bag) => {
                        const bagInfo = produtos
                          .find((p) => p.id === novoItemProdutoId)
                          ?.bags.find((b) => b.id === bag.bagId);

                        return (
                          <div key={bag.bagId} className="flex items-center gap-3 mb-1">
                            <input
                              type="checkbox"
                              checked={bag.selecionada}
                              onChange={() => toggleBagSelecionada(bag.bagId)}
                              id={`checkbox-${bag.bagId}`}
                            />
                            <label htmlFor={`checkbox-${bag.bagId}`} className="flex-1">
                              Bag #{bagInfo?.identificador || bag.bagId} - Estoque:{" "}
                              {bagInfo?.pesoKg.toFixed(2)} kg
                            </label>
                          </div>
                        );
                      })}
                      <p className="mt-2 font-semibold">
                        Total selecionado: {totalPesoSelecionado().toFixed(2)} kg
                      </p>
                    </div>
                  )}

                   {/* Botão adicionar item */}
                  <Button
                    onClick={adicionarItem}
                    disabled={
                      !novoItemProdutoId || totalPesoSelecionado() <= 0
                    }
                    className="self-start"
                  >
                    Adicionar Item
                  </Button>
                </div>

                {/* Lista dos itens adicionados no pedido */}
                {itens.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade (kg)</TableHead>
                        <TableHead>Preço Unitário</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.produtoNome}</TableCell>
                          <TableCell>{item.quantidade.toFixed(2)}</TableCell>
                          <TableCell>R$ {item.precoUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>R$ {item.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removerItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="font-medium">
                          Total
                        </TableCell>
                        <TableCell className="font-bold">
                          R$ {calcularTotal().toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar Pedido</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
          <Search className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4"/>
            <Input
              type="search"
              placeholder="Buscar por cliente, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
              className="pl-8"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data Pedido</TableHead>
                <TableHead>Data Entrega</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos
                .filter((pedido) => {
                  if (!searchTerm) return true;
                  const clienteLower = pedido.clienteNome.toLowerCase();
                  const statusLower = pedido.status.toLowerCase();
                  return (
                    clienteLower.includes(searchTerm) ||
                    statusLower.includes(searchTerm)
                  );
                })
                .map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell>{pedido.numeroPedido}</TableCell>
                    <TableCell>{pedido.clienteNome}</TableCell>
                    <TableCell>{pedido.dataPedido}</TableCell>
                    <TableCell>{pedido.dataEntrega || "-"}</TableCell>
                    <TableCell>
                      <Badge className={
                        pedido.status === "concluido" ? "bg-green-500 text-white" :
                        pedido.status === "pendente" ? "bg-yellow-400 text-black" :
                        pedido.status === "processando" ? "bg-blue-500 text-white" :
                        "bg-red-500 text-white"
                      }>
                        {pedido.status.charAt(0).toUpperCase() + pedido.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      R$ {pedido.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(pedido)}
                        title="Editar pedido"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generatePedidoPDF(pedido)}
                        title="Gerar PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (
                            confirm(
                              "Tem certeza que deseja excluir esse pedido? Essa ação é irreversível."
                            )
                          ) {
                            try {
                              await deleteDoc(doc(db, "pedidos", pedido.id));
                              alert("Pedido excluído com sucesso!");
                              fetchPedidos();
                            } catch (error) {
                              console.error(error);
                              alert("Erro ao excluir pedido.");
                            }
                          }
                        }}
                        title="Excluir pedido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}