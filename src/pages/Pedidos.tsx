// src/pages/Pedidos.tsx
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";

import { calcularParcelas } from "@/utils/financeiro"; // importa a função nova

import {
  buscarPedidos,
  criarPedido,
  atualizarPedido,
  deletarPedido,
} from "@/services/pedidoService";

import {
  baixarEstoqueBags,
  devolverEstoqueBags,
} from "@/services/estoqueService";

import {
  Pedido,
  Cliente,
  ProdutoComBags,
  ProdutoNoPedido,
  Bag,
  calcularTotalPedido,
} from "@/models/firebaseModels";

import { Plus, Search, Edit, Trash2, FileText, BadgeCheck } from "lucide-react";

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
import { calcularDataVencimentoPrazo } from "@/utils/financeiro";
import { formatarDataISOParaBrasil } from "@/utils/date";

export default function Pedidos() {
  // =====================
  // STATE
  // =====================
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

  const [formData, setFormData] = useState({
    clienteId: "",
    dataEntrega: "",
    status: "pendente" as Pedido["status"],
    observacoes: "",
    numeroPedido: "",
    formaPagamento: "",
    prazoPagamento: "",
  });

  const [produtosPedido, setProdutosPedido] = useState<ProdutoNoPedido[]>([]);
  const [novoItemProdutoId, setNovoItemProdutoId] = useState("");
  const [bagsSelecionadas, setBagsSelecionadas] = useState<
    { bagId: string; pesoKg: number; selecionada: boolean }[]
  >([]);

  // estado para parcelamento
  const [parcelas, setParcelas] = useState<
    { numero: number; valor: number; dataVencimento: string; pago?: boolean }[]
  >([]);
  const [numeroParcelasInput, setNumeroParcelasInput] = useState<number>(2);

  // =====================
  // FETCH / INIT
  // =====================
  const fetchClientes = async () => {
    const snapshot = await getDocs(collection(db, "clientes"));
    setClientes(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Cliente, "id">),
      }))
    );
  };

  const fetchProdutos = async () => {
    const snapshotProdutos = await getDocs(collection(db, "produtos"));
    const produtosData: ProdutoComBags[] = [];

    for (const prodDoc of snapshotProdutos.docs) {
      const prodData = prodDoc.data() as any;
      const bagsSnap = await getDocs(
        collection(db, `produtos/${prodDoc.id}/bags`)
      );

      const bags: Bag[] = bagsSnap.docs.map((b) => ({
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
        descricao: prodData.descricao,
        precoPorKg: prodData.precoPorKg,
        tipo: prodData.tipo || "moído",
        bags,
      });
    }

    setProdutos(produtosData);
  };

  const fetchPedidos = async () => {
    const data = await buscarPedidos();

    // Normaliza pedidos para garantir campo `produtos` como array de ProdutoNoPedido
    const normalized = data.map((p) => {
      const anyP = p as any;
      // if already has produtos as array, keep
      if (Array.isArray(anyP.produtos)) {
        return p;
      }

      // if has legacy itens, convert itens -> produtos
      if (Array.isArray(anyP.itens) && anyP.itens.length) {
        const produtosFromItens: ProdutoNoPedido[] = anyP.itens.reduce(
          (acc: ProdutoNoPedido[], it: any) => {
            const existing = acc.find((x) => x.id === it.produtoId);
            if (existing) {
              existing.bags.push(
                ...(it.bagsUsadas || []).map((b: any) => ({
                  bagId: b.bagId,
                  pesoKg: b.pesoUsado,
                  total: b.pesoUsado * it.precoUnitario || 0,
                }))
              );
            } else {
              acc.push({
                id: it.produtoId,
                nomeProd: it.produtoNome,
                precoPorKg: it.precoUnitario,
                bags: (it.bagsUsadas || []).map((b: any) => ({
                  bagId: b.bagId,
                  pesoKg: b.pesoUsado,
                  total: b.pesoUsado * it.precoUnitario || 0,
                })),
              });
            }
            return acc;
          },
          []
        );
        return { ...p, produtos: produtosFromItens } as Pedido;
      }

      // otherwise ensure produtos is at least an empty array
      return { ...p, produtos: [] } as Pedido;
    });

    setPedidos(normalized);
  };

  useEffect(() => {
    fetchClientes();
    fetchProdutos();
    fetchPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================
  // HELPERS
  // =====================
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
    setProdutosPedido([]);
    setNovoItemProdutoId("");
    setBagsSelecionadas([]);
    setEditingPedido(null);
  };

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
    setBagsSelecionadas(
      produto.bags
        .filter((b) => b.status === "disponivel" && b.pesoKg > 0)
        .map((b) => ({ bagId: b.id, pesoKg: 0, selecionada: false }))
    );
  }, [novoItemProdutoId, produtos]);

  // função para gerar automaticamente
  const gerarParcelasAutomaticas = () => {
    const n = Math.max(1, Math.floor(numeroParcelasInput));
    const dataBase = editingPedido?.dataPedido
      ? editingPedido.dataPedido
      : new Date().toISOString().split("T")[0];

    const newParcelas = calcularParcelas(
      calcularTotalPedido(produtosPedido),
      n,
      dataBase,
      30
    );
    setParcelas(newParcelas);
  };

  const toggleBagSelecionada = (bagId: string) => {
    setBagsSelecionadas((prev) =>
      prev.map((b) =>
        b.bagId === bagId
          ? {
              ...b,
              selecionada: !b.selecionada,
              pesoKg: !b.selecionada ? b.pesoKg || 0 : 0,
            }
          : b
      )
    );
  };

  const atualizarPesoBag = (bagId: string, pesoKg: number) => {
    setBagsSelecionadas((prev) =>
      prev.map((b) =>
        b.bagId === bagId ? { ...b, pesoKg, selecionada: pesoKg > 0 } : b
      )
    );
  };

  const totalPesoSelecionado = () =>
    bagsSelecionadas.reduce(
      (acc, b) => (b.selecionada ? acc + (b.pesoKg || 0) : acc),
      0
    );

  // Adicionar item (ProdutoNoPedido)
  const adicionarItem = () => {
    const produto = produtos.find((p) => p.id === novoItemProdutoId);
    if (!produto) return;

    const bagsValidas = bagsSelecionadas.filter(
      (b) => b.selecionada && b.pesoKg > 0
    );
    if (bagsValidas.length === 0) {
      alert("Selecione ao menos uma bag com peso.");
      return;
    }

    // valida se não excede estoque (segurança)
    for (const bSel of bagsValidas) {
      const bagInfo = produto.bags.find((b) => b.id === bSel.bagId);
      if (!bagInfo) {
        alert(`Bag ${bSel.bagId} não encontrada no produto.`);
        return;
      }
      if (bSel.pesoKg > bagInfo.pesoKg) {
        alert(
          `Peso selecionado para a bag ${bSel.bagId} excede o estoque (${bagInfo.pesoKg}kg).`
        );
        return;
      }
    }

    const novoProduto: ProdutoNoPedido = {
      id: produto.id,
      nomeProd: produto.nomeProd,
      precoPorKg: produto.precoPorKg,
      bags: bagsValidas.map((b) => ({
        bagId: b.bagId,
        pesoKg: b.pesoKg,
        total: b.pesoKg * produto.precoPorKg,
      })),
    };

    setProdutosPedido((prev) => {
      const existente = prev.find((p) => p.id === produto.id);
      if (!existente) return [...prev, novoProduto];

      // merge bags
      const map = new Map<string, number>();
      existente.bags.forEach((bg) => map.set(bg.bagId, bg.pesoKg));
      novoProduto.bags.forEach((bg) =>
        map.set(bg.bagId, (map.get(bg.bagId) || 0) + bg.pesoKg)
      );

      const bagsAtualizadas = Array.from(map.entries()).map(
        ([bagId, pesoKg]) => ({
          bagId,
          pesoKg,
          total: pesoKg * produto.precoPorKg,
        })
      );

      return prev.map((p) =>
        p.id === produto.id ? { ...p, bags: bagsAtualizadas } : p
      );
    });

    setNovoItemProdutoId("");
    setBagsSelecionadas([]);
  };

  const removerItem = (id: string) => {
    setProdutosPedido((prev) => prev.filter((p) => p.id !== id));
  };

  // transforma itens legado -> produtos (utilitário)
  const itensToProdutos = (itens: any[]) => {
    const produtosFromItens: ProdutoNoPedido[] = itens.reduce(
      (acc: ProdutoNoPedido[], it: any) => {
        const existing = acc.find((x) => x.id === it.produtoId);
        if (existing) {
          existing.bags.push(
            ...(it.bagsUsadas || []).map((b: any) => ({
              bagId: b.bagId,
              pesoKg: b.pesoUsado,
              total: b.pesoUsado * it.precoUnitario || 0,
            }))
          );
        } else {
          acc.push({
            id: it.produtoId,
            nomeProd: it.produtoNome,
            precoPorKg: it.precoUnitario,
            bags: (it.bagsUsadas || []).map((b: any) => ({
              bagId: b.bagId,
              pesoKg: b.pesoUsado,
              total: b.pesoUsado * it.precoUnitario || 0,
            })),
          });
        }
        return acc;
      },
      []
    );
    return produtosFromItens;
  };

  // =====================
  // SAVE
  // =====================
  const handleSave = async () => {
    if (!formData.clienteId || produtosPedido.length === 0) {
      alert("Selecione um cliente e adicione pelo menos um item.");
      return;
    }

    const cliente = clientes.find((c) => c.id === formData.clienteId);
    if (!cliente) {
      alert("Cliente inválido.");
      return;
    }

    try {
      // 1) Atualizar estoque das bags (serviço)
      await baixarEstoqueBags(produtosPedido, produtos);

      // 2) datas
      const dataBase = editingPedido?.dataPedido
        ? new Date(editingPedido.dataPedido + "T12:00:00")
        : new Date();
      const dataBaseISO = dataBase.toISOString().split("T")[0];

      const isPrazo = formData.formaPagamento === "A prazo";
      const dataVencimento =
        isPrazo && formData.prazoPagamento
          ? calcularDataVencimentoPrazo(dataBaseISO, formData.prazoPagamento)
          : undefined;

      // dentro do handleSave - antes de montar pedidoRaw
      // se formaPagamento === 'Parcelado' e não houver parcelas geradas, gerar automaticamente
      if (formData.formaPagamento === "Parcelado" && parcelas.length === 0) {
        // gera 2 parcelas padrão se o usuário não gerou manualmente
        setParcelas(
          calcularParcelas(
            calcularTotalPedido(produtosPedido),
            2,
            dataBaseISO,
            30
          )
        );
      }

      // 3) montar o objeto bruto (pode conter undefined)
      const pedidoRaw: Record<string, any> = {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        dataPedido: dataBaseISO,
        dataEntrega: formData.dataEntrega || undefined,
        numeroPedido: formData.numeroPedido || undefined,
        formaPagamento: formData.formaPagamento || undefined,
        prazoPagamento: isPrazo
          ? formData.prazoPagamento || undefined
          : undefined,
        observacoes: formData.observacoes?.trim() || undefined,
        status: formData.status,
        produtos: produtosPedido,
        total: calcularTotalPedido(produtosPedido),
        // só setamos statusPagamento automaticamente se "A prazo" (como definido)
        ...(formData.formaPagamento === "Parcelado" ? { parcelas } : {}),
        ...(isPrazo ? { statusPagamento: "Não Pago", dataVencimento } : {}),
      };

      // 4) limpar chaves com valor undefined (Firestore não aceita undefined)
      const pedidoData = Object.fromEntries(
        Object.entries(pedidoRaw).filter(([, v]) => v !== undefined)
      ) as Omit<Pedido, "id">;

      // 5) persistir
      if (editingPedido) {
        await atualizarPedido(editingPedido.id, pedidoData);
      } else {
        await criarPedido(pedidoData);
      }

      alert("Pedido salvo com sucesso!");
      setIsDialogOpen(false);
      resetForm();
      fetchProdutos();
      fetchPedidos();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar pedido.");
    }
  };

  // =====================
  // EDIT / VIEW
  // =====================
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

    // popula produtosPedido a partir do pedido (mantém o novo formato)
    if (
      Array.isArray((pedido as any).produtos) &&
      (pedido as any).produtos.length > 0
    ) {
      setProdutosPedido((pedido as any).produtos);
    } else if (
      Array.isArray((pedido as any).itens) &&
      (pedido as any).itens.length > 0
    ) {
      setProdutosPedido(itensToProdutos((pedido as any).itens));
    } else {
      setProdutosPedido([]);
    }
    // dentro do handleEdit
    if (
      Array.isArray((pedido as any).parcelas) &&
      (pedido as any).parcelas.length > 0
    ) {
      setParcelas((pedido as any).parcelas);
    } else {
      setParcelas([]);
    }

    // reset seleção de adicionar item
    setNovoItemProdutoId("");
    setBagsSelecionadas([]);
    setIsDialogOpen(true);
  };

  // mark as paid helper
  const marcarComoPago = async (pedido: Pedido) => {
    try {
      const pedidoRef = doc(db, "pedidos", pedido.id);
      await updateDoc(pedidoRef, { statusPagamento: "Pago" });
      fetchPedidos();
    } catch (error) {
      console.error(error);
      alert("Erro ao marcar como pago.");
    }
  };

  // deletar pedido helper
  const excluirPedido = async (pedido: Pedido) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esse pedido? Essa ação é irreversível."
      )
    )
      return;
    try {
      // 1) devolver estoque
      if (Array.isArray(pedido.produtos) && pedido.produtos.length > 0) {
        await devolverEstoqueBags(pedido.produtos);
      } else if (
        Array.isArray((pedido as any).itens) &&
        (pedido as any).itens.length > 0
      ) {
        const produtosFromItens = itensToProdutos((pedido as any).itens);
        if (produtosFromItens.length)
          await devolverEstoqueBags(produtosFromItens);
      }

      // 2) excluir pedido
      await deletarPedido(pedido.id);

      alert("Pedido excluído com sucesso!");
      fetchProdutos();
      fetchPedidos();
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir pedido.");
    }
  };

  // =====================
  // UI (render)
  // =====================
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <DialogTitle>
                {editingPedido ? "Editar Pedido" : "Novo Pedido"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Dados Gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select
                    value={formData.clienteId}
                    onValueChange={(v: string) =>
                      setFormData({ ...formData, clienteId: v })
                    }
                  >
                    <SelectTrigger className="w-full">
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
                    className="w-full"
                    type="date"
                    value={formData.dataEntrega}
                    onChange={(e) =>
                      setFormData({ ...formData, dataEntrega: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numeroPedido">Número do Pedido</Label>
                  <Input
                    className="w-full"
                    type="text"
                    placeholder="Ex: 2026-001"
                    value={formData.numeroPedido}
                    onChange={(e) =>
                      setFormData({ ...formData, numeroPedido: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
                  <Select
                    value={formData.formaPagamento}
                    onValueChange={(v: string) =>
                      setFormData({
                        ...formData,
                        formaPagamento: v,
                        prazoPagamento: "",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
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
                      onValueChange={(v: string) =>
                        setFormData({ ...formData, prazoPagamento: v })
                      }
                    >
                      <SelectTrigger className="w-full">
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

                {formData.formaPagamento === "A prazo" &&
                  formData.prazoPagamento && (
                    <div className="space-y-2">
                      <Label>Data de Vencimento</Label>
                      <Input
                        type="text"
                        readOnly
                        value={
                          editingPedido && editingPedido.dataVencimento
                            ? formatarDataISOParaBrasil(
                                editingPedido.dataVencimento!
                              )
                            : (() => {
                                const dias = parseInt(
                                  formData.prazoPagamento.replace(/\D/g, ""),
                                  10
                                );
                                const dataBase = new Date();
                                dataBase.setDate(dataBase.getDate() + dias);
                                return dataBase.toLocaleDateString("pt-BR");
                              })()
                        }
                      />
                    </div>
                  )}

                {formData.formaPagamento === "Parcelado" && (
                  <div className="space-y-2 col-span-2">
                    <Label>Parcelamento</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min={1}
                        value={numeroParcelasInput}
                        onChange={(e) =>
                          setNumeroParcelasInput(Number(e.target.value || 1))
                        }
                        className="w-32"
                      />
                      <Button onClick={gerarParcelasAutomaticas}>
                        Gerar parcelas
                      </Button>
                    </div>

                    {parcelas.length > 0 && (
                      <div className="mt-2 overflow-auto max-h-40 border rounded p-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Valor (R$)</th>
                              <th>Vencimento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelas.map((par, idx) => (
                              <tr key={par.numero}>
                                <td>{par.numero}</td>
                                <td>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={par.valor}
                                    onChange={(e) => {
                                      const v = Number(e.target.value || 0);
                                      setParcelas((prev) =>
                                        prev.map((p, i) =>
                                          i === idx ? { ...p, valor: v } : p
                                        )
                                      );
                                    }}
                                    className="w-28"
                                  />
                                </td>
                                <td>
                                  <Input
                                    type="date"
                                    value={par.dataVencimento}
                                    onChange={(e) =>
                                      setParcelas((prev) =>
                                        prev.map((p, i) =>
                                          i === idx
                                            ? {
                                                ...p,
                                                dataVencimento: e.target.value,
                                              }
                                            : p
                                        )
                                      )
                                    }
                                    className="w-40"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="mt-2 text-xs text-gray-500">
                          Ajuste valores/vencimentos se necessário. Soma atual:
                          R${" "}
                          {parcelas
                            .reduce((s, p) => s + Number(p.valor || 0), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v: string) =>
                      setFormData({
                        ...formData,
                        status: v as Pedido["status"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
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
                    onChange={(e) =>
                      setFormData({ ...formData, observacoes: e.target.value })
                    }
                    placeholder="Observações sobre o pedido"
                  />
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Itens do Pedido</h3>

                {/* Seleção do Produto e bags */}
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select
                      value={novoItemProdutoId}
                      onValueChange={setNovoItemProdutoId}
                    >
                      <SelectTrigger className="flex-1 w-full">
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((produto) => {
                          const estoqueDisponivel = produto.bags
                            .filter((b) => b.status === "disponivel")
                            .reduce((acc, b) => acc + b.pesoKg, 0);
                          return (
                            <SelectItem key={produto.id} value={produto.id}>
                              {produto.nomeProd} - R${" "}
                              {produto.precoPorKg.toFixed(2)} /kg -{" "}
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
                      className="w-full"
                      readOnly
                    />
                  </div>

                  {/* Listagem bags para seleção */}
                  {bagsSelecionadas.length > 0 && (
                    <div className="border rounded p-3 max-h-48 overflow-y-auto">
                      <p className="mb-2 font-medium">
                        Selecione as bags e informe o peso retirado:
                      </p>
                      {bagsSelecionadas.map((bag) => {
                        const bagInfo = produtos
                          .find((p) => p.id === novoItemProdutoId)
                          ?.bags.find((b) => b.id === bag.bagId);

                        return (
                          <div
                            key={bag.bagId}
                            className="flex items-center gap-3 mb-1"
                          >
                            <input
                              type="checkbox"
                              checked={bag.selecionada}
                              onChange={() => toggleBagSelecionada(bag.bagId)}
                              id={`checkbox-${bag.bagId}`}
                              className="h-4 w-4"
                            />

                            <label
                              htmlFor={`checkbox-${bag.bagId}`}
                              className="flex-1"
                            >
                              Bag #{bagInfo?.identificador || bag.bagId} -
                              Estoque: {bagInfo?.pesoKg.toFixed(2)} kg
                            </label>

                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={String(bag.pesoKg)}
                              onChange={(e) =>
                                atualizarPesoBag(
                                  bag.bagId,
                                  Number(e.target.value || 0)
                                )
                              }
                              className="w-28"
                            />
                          </div>
                        );
                      })}
                      <p className="mt-2 font-semibold">
                        Total selecionado: {totalPesoSelecionado().toFixed(2)}{" "}
                        kg
                      </p>
                    </div>
                  )}

                  {/* Botão adicionar item */}
                  <Button
                    onClick={adicionarItem}
                    disabled={!novoItemProdutoId || totalPesoSelecionado() <= 0}
                    className="self-start"
                  >
                    Adicionar Item
                  </Button>
                </div>

                {/* Lista dos itens adicionados no pedido */}
                {produtosPedido.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Bags</TableHead>
                          <TableHead>Quantidade (kg)</TableHead>
                          <TableHead>Preço Unitário</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtosPedido.map((item) => {
                          const produto = produtos.find(
                            (p) => p.id === item.id
                          );

                          const bagsIdentificadas = item.bags
                            .map((bagUso) => {
                              const bagInfo = produto?.bags.find(
                                (b) => b.id === bagUso.bagId
                              );
                              return `#${
                                bagInfo?.identificador || bagUso.bagId
                              }`;
                            })
                            .join(", ");

                          const quantidade = item.bags
                            .reduce((acc, b) => acc + b.pesoKg, 0)
                            .toFixed(2);

                          const subtotal = item.bags.reduce(
                            (acc, b) => acc + b.total,
                            0
                          );

                          return (
                            <TableRow key={item.id}>
                              <TableCell>{item.nomeProd}</TableCell>
                              <TableCell>{bagsIdentificadas}</TableCell>
                              <TableCell>{quantidade}</TableCell>
                              <TableCell>
                                R${" "}
                                {item.precoPorKg.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell>
                                R${" "}
                                {subtotal.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right flex flex-wrap gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removerItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow>
                          <TableCell colSpan={4} className="font-medium">
                            Total
                          </TableCell>
                          <TableCell className="font-bold">
                            R${" "}
                            {calcularTotalPedido(produtosPedido).toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
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
          <div className="relative max-w-sm mb-4">
            <Search className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4" />
            <Input
              type="search"
              placeholder="Buscar por cliente, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
              className="pl-8 w-full"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Pedido</TableHead>
                  <TableHead>Data Entrega</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status Envio</TableHead>
                  <TableHead>Status Pagamento</TableHead>
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
                        {pedido.formaPagamento === "A prazo" &&
                        pedido.dataVencimento
                          ? formatarDataISOParaBrasil(pedido.dataVencimento!)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            pedido.status === "concluido"
                              ? "bg-green-500 text-white"
                              : pedido.status === "pendente"
                              ? "bg-yellow-400 text-black"
                              : pedido.status === "processando"
                              ? "bg-blue-500 text-white"
                              : "bg-red-500 text-white"
                          }
                        >
                          {pedido.status.charAt(0).toUpperCase() +
                            pedido.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pedido.statusPagamento === "Pago" ? (
                          <Badge className="bg-green-600 text-white">
                            Pago
                          </Badge>
                        ) : pedido.statusPagamento === "Não Pago" ? (
                          <Badge className="bg-red-400 text-black">
                            Não Pago
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        R${" "}
                        {Number(pedido.total || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right flex gap-2 justify-end flex-wrap">
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
                        {pedido.statusPagamento !== "Pago" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (confirm("Marcar esse pedido como PAGO?")) {
                                marcarComoPago(pedido);
                              }
                            }}
                            title="Marcar como Pago"
                          >
                            <BadgeCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => excluirPedido(pedido)}
                          title="Excluir pedido"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
