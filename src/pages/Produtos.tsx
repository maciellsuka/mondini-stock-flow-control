import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { Produto as ProdutoModel, Bag } from "@/models/firebaseModels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { jsPDF } from "jspdf";

interface ProdutoComBags extends ProdutoModel {
  bags: Bag[];
}

interface EtiquetaBagProps {
  identificador: string;
  descricao: string;
  pesoKg: number;
  data: Date;
}

export default function Produtos() {
  const { toast } = useToast();

  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [novoProduto, setNovoProduto] = useState<Omit<ProdutoModel, "id">>({
    nomeProd: "",
    tipo: "moído",
    precoPorKg: 0,
    descricao: "",
  });

  const [editProduto, setEditProduto] = useState<ProdutoComBags | null>(null);
  const [editingBags, setEditingBags] = useState<Bag[]>([]);

  const [etiquetaSelecionada, setEtiquetaSelecionada] = useState<EtiquetaBagProps | null>(null);

  // Função atualizada e estilizada para gerar etiqueta PDF
  function gerarEtiquetaPDF({ identificador, descricao, pesoKg, data }: EtiquetaBagProps) {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [100, 50],
    });

    const dataFormatada = data.toLocaleDateString("pt-BR");

    // Fundo clarinho
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 100, 50, "F");

    // Logo ou título top centralizado
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#333");
    doc.text("MONDINI", 50, 10, { align: "center" });

    // Linha separadora
    doc.setDrawColor("#999");
    doc.setLineWidth(0.3);
    doc.line(10, 13, 90, 13);

    // Descrição (mais destaque)
    doc.setFontSize(24);  
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#222");
    const descricaoLines = doc.splitTextToSize(descricao, 80);
    doc.text(descricaoLines, 50, 25, {align: "center"});

    // Peso KG
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#007700");
    doc.text(`Peso: ${pesoKg.toFixed(2).replace(".", ",")} KG`, 50, 37, { align: "center" });

    // Número da Bag
    doc.setFontSize(14);
    doc.setFont("helvetica", "italic", "bold");
    doc.setTextColor("#555");
    doc.text(`Nº da Bag: ${identificador}`, 10, 45);

    // Data gerada no canto direito
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#555");
    doc.text(`Data: ${dataFormatada}`, 90, 45, { align: "right" });

    // Opcional: borda arredondada
    doc.setDrawColor("#007700");
    doc.setLineWidth(1);
    doc.roundedRect(1, 1, 98, 48, 3, 3);

    // Gera e abre em nova aba
    window.open(doc.output("bloburl"));
  }

  const fetchProdutos = async () => {
    try {
      const snapshot = await getDocs(collection(db, "produtos"));
      const produtosData: ProdutoComBags[] = [];

      for (const docSnap of snapshot.docs) {
        const produto = docSnap.data() as ProdutoModel;
        const bagsSnap = await getDocs(collection(db, `produtos/${docSnap.id}/bags`));
        const bags: Bag[] = bagsSnap.docs.map((b) => ({
          ...(b.data() as Omit<Bag, "criadoEm">),
          id: b.id,
          criadoEm: b.data().criadoEm?.toDate?.() || new Date(),
          produtoId: b.data().produtoId,
          identificador: b.data().identificador || "",
          status: b.data().status || "disponivel",
          pesoKg: b.data().pesoKg || 0,
        }));
        
        const bagsVisiveis = bags.filter((b) => b.status !== "vendido");
        produtosData.push({ ...produto, id: docSnap.id, bags: bagsVisiveis });

      }

      setProdutos(produtosData);
    } catch (error) {
      toast({ title: "Erro ao buscar produtos", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const handleDeleteProduto = async (id: string) => {
    try {
      await deleteDoc(doc(db, "produtos", id));
      toast({ title: "Produto excluído", variant: "destructive" });
      fetchProdutos();
    } catch {
      toast({ title: "Erro ao excluir produto", variant: "destructive" });
    }
  };

  const handleAdicionarProduto = async () => {
    if (!novoProduto.nomeProd.trim() || novoProduto.precoPorKg <= 0) {
      toast({ title: "Preencha o nome e o preço corretamente", variant: "destructive" });
      return;
    }

    try {
      await addDoc(collection(db, "produtos"), novoProduto);
      toast({ title: "Produto criado com sucesso" });
      setIsDialogOpen(false);
      setNovoProduto({ nomeProd: "", tipo: "moído", precoPorKg: 0, descricao: "" });
      fetchProdutos();
    } catch {
      toast({ title: "Erro ao criar produto", variant: "destructive" });
    }
  };

  const openEditDialog = (produto: ProdutoComBags) => {
    setEditProduto(produto);
    setEditingBags(produto.bags);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduto = async () => {
    if (!editProduto) return;

    if (!editProduto.nomeProd.trim() || editProduto.precoPorKg <= 0) {
      toast({ title: "Nome e preço inválidos", variant: "destructive" });
      return;
    }

    try {
      await updateDoc(doc(db, "produtos", editProduto.id), {
        nomeProd: editProduto.nomeProd,
        tipo: editProduto.tipo,
        precoPorKg: editProduto.precoPorKg,
        descricao: editProduto.descricao,
      });

      await Promise.all(
        editingBags.map(async (bag) => {
          const bagRef = doc(db, "produtos", editProduto.id, "bags", bag.id);

          const dataToSave = {
            pesoKg: bag.pesoKg,
            status: bag.status,
            criadoEm:
              bag.criadoEm instanceof Date
                ? Timestamp.fromDate(bag.criadoEm)
                : bag.criadoEm,
            produtoId: editProduto.id,
            identificador: bag.identificador || "",
          };

          if (!bag.id || bag.id.startsWith("temp-") || bag.id.length < 5) {
            await addDoc(collection(db, "produtos", editProduto.id, "bags"), dataToSave);
          } else {
            await updateDoc(bagRef, dataToSave);
          }
        })
      );

      toast({ title: "Produto atualizado com sucesso" });
      setIsEditDialogOpen(false);
      setEditProduto(null);
      fetchProdutos();
    } catch {
      toast({ title: "Erro ao atualizar produto", variant: "destructive" });
    }
  };

  const updateBagField = (id: string, field: keyof Omit<Bag, "id">, value: any) => {
    setEditingBags((prev) =>
      prev.map((bag) => (bag.id === id ? { ...bag, [field]: value } : bag))
    );
  };

  const handleAddBag = () => {
    if (!editProduto) return;
    const novaBag: Bag = {
      id: `temp-${Date.now()}`,
      pesoKg: 0,
      status: "disponivel",
      criadoEm: new Date(),
      produtoId: editProduto.id,
      identificador: "",
    };
    setEditingBags((prev) => [...prev, novaBag]);
  };

  const handleRemoveBag = async (id: string) => {
    if (!editProduto) return;

    if (id && !id.startsWith("temp-") && id.length > 5) {
      try {
        await deleteDoc(doc(db, "produtos", editProduto.id, "bags", id));
      } catch {
        toast({ title: "Erro ao excluir bag", variant: "destructive" });
      }
    }

    setEditingBags((prev) => prev.filter((b) => b.id !== id));
  };

  const produtosFiltrados = produtos.filter(
    (p) =>
      p.nomeProd.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calcularEstoqueTotal = (bags: Bag[]) =>
    bags.reduce((acc, bag) => (bag.status === "disponivel" ? acc + bag.pesoKg : acc), 0);

  const statusColors: Record<Bag["status"], string> = {
    disponivel: "bg-green-200 text-green-800",
    reservado: "bg-gray-200 text-gray-800",
    vendido: "bg-yellow-300 text-yellow-900",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Produto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={novoProduto.nomeProd}
                  onChange={(e) =>
                    setNovoProduto((p) => ({ ...p, nomeProd: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={novoProduto.descricao}
                  onChange={(e) =>
                    setNovoProduto((p) => ({ ...p, descricao: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  className="w-full border rounded px-3 py-2"
                  value={novoProduto.tipo}
                  onChange={(e) =>
                    setNovoProduto((p) => ({
                      ...p,
                      tipo: e.target.value as ProdutoModel["tipo"],
                    }))
                  }
                >
                  <option value="moído">Moído</option>
                  <option value="borra">Borra</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco">Preço por KG</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={novoProduto.precoPorKg}
                  onChange={(e) =>
                    setNovoProduto((p) => ({
                      ...p,
                      precoPorKg: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdicionarProduto}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Lista de produtos */}
      <div className="grid gap-4">
        {produtosFiltrados.map((produto) => {
          const estoqueTotal = calcularEstoqueTotal(produto.bags);
          return (
            <Card
              key={produto.id}
              className={estoqueTotal <= 0 ? "border-red-300 bg-red-50" : ""}
            >
              <CardContent className="p-6">
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{produto.nomeProd}</h2>
                    <p className="text-sm text-muted-foreground">{produto.descricao}</p>
                    <p className="text-sm mt-2">
                      Tipo: <strong>{produto.tipo}</strong>
                      <br />
                      Preço por KG:{" "}
                      <strong>
                        R$ {produto.precoPorKg.toFixed(2).replace(".", ",")}
                      </strong>
                      <br />
                      Estoque disponível:{" "}
                      <strong>{estoqueTotal.toFixed(2)} KG</strong>
                    </p>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(produto)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProduto(produto.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {produto.bags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Bags disponíveis:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {produto.bags.map((bag) => (
                        <div
                          key={bag.id}
                          className={`flex justify-between items-center border rounded px-2 py-1 shadow-sm ${
                            statusColors[bag.status]
                          }`}
                        >
                          <span className="font-semibold">{`Bag: ${
                            bag.identificador || bag.id
                          }`}</span>
                          <span>
                            {bag.pesoKg.toFixed(2)} KG -{" "}
                            <span className="capitalize">{bag.status}</span>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setEtiquetaSelecionada({
                                identificador: bag.identificador || bag.id,
                                descricao: produto.descricao || produto.nomeProd,
                                pesoKg: bag.pesoKg,
                                data: new Date(),
                              })
                            }
                            className="ml-2"
                          >
                            Imprimir Etiqueta
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {editProduto && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editProduto.nomeProd}
                  onChange={(e) =>
                    setEditProduto({ ...editProduto, nomeProd: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={editProduto.descricao}
                  onChange={(e) =>
                    setEditProduto({ ...editProduto, descricao: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={editProduto.tipo}
                  onChange={(e) =>
                    setEditProduto({
                      ...editProduto,
                      tipo: e.target.value as ProdutoModel["tipo"],
                    })
                  }
                >
                  <option value="moído">Moído</option>
                  <option value="borra">Borra</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Preço por KG</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editProduto.precoPorKg}
                  onChange={(e) =>
                    setEditProduto({
                      ...editProduto,
                      precoPorKg: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label>Bags</Label>
                {editingBags.map((bag, index) => (
                  <div
                    key={bag.id || index}
                    className={`flex gap-2 items-center ${statusColors[bag.status]} rounded p-2`}
                  >
                    <Input
                      placeholder="Nº"
                      value={bag.identificador || ""}
                      onChange={(e) =>
                        updateBagField(bag.id, "identificador", e.target.value)
                      }
                      className="w-24"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={bag.pesoKg}
                      onChange={(e) =>
                        updateBagField(bag.id, "pesoKg", parseFloat(e.target.value))
                      }
                      className="flex-1"
                    />
                    <select
                      value={bag.status}
                      onChange={(e) =>
                        updateBagField(bag.id, "status", e.target.value as Bag["status"])
                      }
                      className="border rounded px-2 py-1"
                    >
                      <option value="disponivel">Disponível</option>
                      <option value="reservado">Reservado</option>
                      <option value="vendido">Vendido</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveBag(bag.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddBag}>
                  Adicionar Bag
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateProduto}>Salvar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Etiqueta */}
      <Dialog open={!!etiquetaSelecionada} onOpenChange={() => setEtiquetaSelecionada(null)}>
        <DialogContent>
          {etiquetaSelecionada && (
            <>
            <p>Gerador de Etiquetas</p>
              <div className="p-4 border rounded mb-4 bg-gray-50">
                <p><strong>Descrição:</strong> {etiquetaSelecionada.descricao}</p>
                <p><strong>Peso:</strong> {etiquetaSelecionada.pesoKg.toFixed(2).replace(".", ",")} KG</p>
                <p><strong>Nº Bag:</strong> {etiquetaSelecionada.identificador}</p>
                <p><strong>Data:</strong> {etiquetaSelecionada.data.toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEtiquetaSelecionada(null)}>
                  Fechar
                </Button>
                <Button onClick={() => {
                  if (etiquetaSelecionada) gerarEtiquetaPDF(etiquetaSelecionada);
                }}>
                  Imprimir
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
