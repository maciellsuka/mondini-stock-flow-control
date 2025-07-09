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
    where,
    Timestamp,
    orderBy,
  } from "firebase/firestore";

  import {
    Plus,
    Search,
    Edit,
    Trash2,
    FileText,
    Calendar,
    User,
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
  }

  export default function Pedidos() {
    // States
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [pedidos, setPedidos] = useState<Pedido[]>([]);

    const [searchTerm, setSearchTerm] = useState("");

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

    const [formData, setFormData] = useState({
      clienteId: "",
      dataEntrega: "",
      status: "pendente" as StatusPedido,
      observacoes: "",
    });

    const [itens, setItens] = useState<ItemPedido[]>([]);
    const [novoItem, setNovoItem] = useState({
      produtoId: "",
      quantidade: 1,
    });

    // ========== Fetch dados ==========

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

    // Buscar produtos com bags do Firestore
    const fetchProdutos = async () => {
      const produtosCol = collection(db, "produtos");
      const snapshotProdutos = await getDocs(produtosCol);
      const produtosData: Produto[] = [];

      for (const prodDoc of snapshotProdutos.docs) {
        const prodData = prodDoc.data();
        // Buscar bags subcoleção
        const bagsCol = collection(db, `produtos/${prodDoc.id}/bags`);
        const bagsSnap = await getDocs(bagsCol);
        const bagsData: Bag[] = bagsSnap.docs.map((b) => ({
          id: b.id,
          pesoKg: b.data().pesoKg,
          status: b.data().status,
          criadoEm: b.data().criadoEm?.toDate() ?? new Date(),
          produtoId: prodDoc.id,
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
        };
      });
      setPedidos(pedidosData);
    };

    useEffect(() => {
      fetchClientes();
      fetchProdutos();
      fetchPedidos();
    }, []);

    // ======== Funções de manipulação do pedido ========

    // Resetar formulário
    const resetForm = () => {
      setFormData({
        clienteId: "",
        dataEntrega: "",
        status: "pendente",
        observacoes: "",
      });
      setItens([]);
      setNovoItem({ produtoId: "", quantidade: 1 });
      setEditingPedido(null);
    };

    // Verifica se tem peso suficiente disponível nas bags para o produto
    // Retorna { podeVender, bagsUsadas } com as bags e quanto de cada usar
    const verificarDisponibilidadeBags = (
      produtoId: string,
      quantidadeKg: number,
    ): { podeVender: boolean; bagsUsadas: { bagId: string; pesoUsado: number }[] } => {
      const produto = produtos.find((p) => p.id === produtoId);
      if (!produto) return { podeVender: false, bagsUsadas: [] };

      // Filtrar bags disponíveis e ordenar por criação (pra usar as mais antigas primeiro)
      const bagsDisponiveis = produto.bags
        .filter((b) => b.status === "disponivel" && b.pesoKg > 0)
        .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

      let restante = quantidadeKg;
      const bagsUsadas: { bagId: string; pesoUsado: number }[] = [];

      for (const bag of bagsDisponiveis) {
        if (restante <= 0) break;

        if (bag.pesoKg >= restante) {
          bagsUsadas.push({ bagId: bag.id, pesoUsado: restante });
          restante = 0;
          break;
        } else {
          bagsUsadas.push({ bagId: bag.id, pesoUsado: bag.pesoKg });
          restante -= bag.pesoKg;
        }
      }

      return { podeVender: restante === 0, bagsUsadas };
    };

    // Adicionar item no pedido (valida bags e atualiza itens)
    const adicionarItem = () => {
      if (!novoItem.produtoId) return;

      const produto = produtos.find((p) => p.id === novoItem.produtoId);
      if (!produto) return;

      const quantidade = novoItem.quantidade;
      if (quantidade <= 0) return;

      const { podeVender, bagsUsadas } = verificarDisponibilidadeBags(
        produto.id,
        quantidade,
      );

      if (!podeVender) {
        alert("Peso solicitado excede estoque disponível nas bags do produto.");
        return;
      }

      // Verifica se item já existe e atualiza quantidade
      const itemExistente = itens.find((item) => item.produtoId === produto.id);

      if (itemExistente) {
        const novaQtd = itemExistente.quantidade + quantidade;
        // Re-verifica disponibilidade para nova quantidade
        const { podeVender: podeVender2, bagsUsadas: bagsUsadas2 } =
          verificarDisponibilidadeBags(produto.id, novaQtd);

        if (!podeVender2) {
          alert(
            "Peso solicitado excede estoque disponível considerando o item já adicionado.",
          );
          return;
        }

        setItens((prev) =>
          prev.map((item) =>
            item.produtoId === produto.id
              ? {
                  ...item,
                  quantidade: novaQtd,
                  subtotal: novaQtd * item.precoUnitario,
                  bagsUsadas: bagsUsadas2,
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
          quantidade,
          precoUnitario: produto.precoPorKg,
          subtotal: quantidade * produto.precoPorKg,
          bagsUsadas,
        };
        setItens((prev) => [...prev, novoItemPedido]);
      }

      setNovoItem({ produtoId: "", quantidade: 1 });
    };

    // Remover item do pedido
    const removerItem = (id: string) => {
      setItens((prev) => prev.filter((item) => item.id !== id));
    };

    // Calcula total do pedido
    const calcularTotal = () => {
      return itens.reduce((total, item) => total + item.subtotal, 0);
    };

    // Salvar pedido no Firestore e ajustar bags
    const handleSave = async () => {
      if (!formData.clienteId || itens.length === 0) {
        alert("Selecione um cliente e adicione pelo menos um item.");
        return;
      }

      // Busca cliente real
      const cliente = clientes.find((c) => c.id === formData.clienteId);
      if (!cliente) {
        alert("Cliente inválido.");
        return;
      }

      try {
        // Ajustar bags no Firestore: subtrair peso vendido de cada bag usada
        for (const item of itens) {
          for (const bagUso of item.bagsUsadas) {
            const bagRef = doc(
              db,
              "produtos",
              item.produtoId,
              "bags",
              bagUso.bagId,
            );
            const bagDoc = await getDocs(collection(db, `produtos/${item.produtoId}/bags`));
            // Pra não fazer múltiplos reads vou só atualizar direto o peso
            // Melhor mesmo seria usar transactions pra evitar conflito - fica de boa fazer depois

            // Atualiza peso da bag
            const produtoBags = produtos.find((p) => p.id === item.produtoId)?.bags;
            const bagAtual = produtoBags?.find((b) => b.id === bagUso.bagId);
            if (!bagAtual) continue;

            const novoPeso = bagAtual.pesoKg - bagUso.pesoUsado;

            await updateDoc(bagRef, {
              pesoKg: novoPeso > 0 ? novoPeso : 0,
              status: novoPeso <= 0 ? "vendido" : "disponivel",
            });
          }
        }

        // Monta objeto pedido
        const pedidoData: Omit<Pedido, "id"> = {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          dataPedido: new Date().toISOString().split("T")[0],
          dataEntrega: formData.dataEntrega || undefined,
          status: formData.status,
          itens,
          total: calcularTotal(),
          observacoes: formData.observacoes,
        };

        if (editingPedido) {
          // Atualizar pedido
          const pedidoRef = doc(db, "pedidos", editingPedido.id);
          await updateDoc(pedidoRef, pedidoData);
        } else {
          // Criar novo pedido
          const pedidosCol = collection(db, "pedidos");
          await addDoc(pedidosCol, pedidoData);
        }

        alert("Pedido salvo com sucesso!");
        setIsDialogOpen(false);
        resetForm();
        fetchProdutos(); // Recarregar produtos (bags atualizadas)
        fetchPedidos(); // Recarregar pedidos
      } catch (error) {
        console.error(error);
        alert("Erro ao salvar pedido.");
      }
    };

    // Editar pedido
    const handleEdit = (pedido: Pedido) => {
      setEditingPedido(pedido);
      setFormData({
        clienteId: pedido.clienteId,
        dataEntrega: pedido.dataEntrega || "",
        status: pedido.status,
        observacoes: pedido.observacoes || "",
      });
      setItens(pedido.itens);
      setIsDialogOpen(true);
    };

    const handlePermanentDelete = async (id: string) => {
      if (!confirm("Tem certeza que quer excluir esse pedido permanentemente?")) return;

      try {
        await deleteDoc(doc(db, "pedidos", id));
        fetchPedidos();
      } catch (err) {
        alert("Erro ao excluir pedido.");
        console.error(err);
      }
    };

    // Gerar PDF do pedido
    const handleGeneratePDF = (pedido: Pedido) => {
      generatePedidoPDF(pedido);
    };

    // Filtros para lista
    const filteredPedidos = pedidos.filter(
      (pedido) =>
        pedido.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.id.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    // Helpers pra status visual
    const getStatusColor = (status: StatusPedido) => {
      switch (status) {
        case "pendente":
          return "bg-yellow-100 text-yellow-800";
        case "processando":
          return "bg-blue-100 text-blue-800";
        case "concluido":
          return "bg-green-100 text-green-800";
        case "cancelado":
          return "bg-red-100 text-red-800";
      }
    };

    const getStatusLabel = (status: StatusPedido) => {
      switch (status) {
        case "pendente":
          return "Pendente";
        case "processando":
          return "Processando";
        case "concluido":
          return "Concluído";
        case "cancelado":
          return "Cancelado";
      }
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
              <Button
                onClick={() => {
                  resetForm();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPedido ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Dados gerais */}
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

                {/* Itens */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-4">Itens do Pedido</h3>

                  <div className="flex gap-2 mb-4">
                    <Select
                      value={novoItem.produtoId}
                      onValueChange={(v) => setNovoItem({ ...novoItem, produtoId: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((produto) => {
                          // Calcular estoque disponível (soma das bags disponiveis)
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

                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={novoItem.quantidade === 0 ? "" : novoItem.quantidade}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNovoItem({
                          ...novoItem,
                          quantidade: val === "" ? 0 : parseFloat(val),
                        });
                      }}
                      placeholder="Peso (kg)"
                      className="w-32"
                    />


                    <Button onClick={adicionarItem} disabled={!novoItem.produtoId || novoItem.quantidade <= 0}>
                      Adicionar
                    </Button>
                  </div>

                  {/* Lista itens */}
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
                            <TableCell>R$ {item.precoUnitario.toFixed(2)}</TableCell>
                            <TableCell>R$ {item.subtotal.toFixed(2)}</TableCell>
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
                          <TableCell className="font-bold">R$ {calcularTotal().toFixed(2)}</TableCell>
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
                <Button
                  onClick={handleSave}
                  disabled={!formData.clienteId || itens.length === 0}
                >
                  {editingPedido ? "Atualizar" : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pedidos.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pedidos.filter((p) => p.status === "pendente").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pedidos.filter((p) => p.status === "processando").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {pedidos.reduce((acc, p) => acc + p.total, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca e listagem dos pedidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <Input
                placeholder="Buscar por cliente ou número do pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">#{pedido.id}</TableCell>
                    <TableCell>{pedido.clienteNome}</TableCell>
                    <TableCell>
                      {new Date(pedido.dataPedido).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(pedido.status)}>
                        {getStatusLabel(pedido.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>R$ {pedido.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGeneratePDF(pedido)}
                          title="Gerar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(pedido)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handlePermanentDelete(pedido.id)}
                          title="Excluir permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
