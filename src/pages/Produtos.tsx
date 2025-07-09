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
import { Search, Trash2, Edit, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProdutoComBags extends ProdutoModel {
  bags: Bag[];
}

export default function Produtos() {
  const { toast } = useToast();

  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Dados para criar novo produto
  const [novoProduto, setNovoProduto] = useState<Omit<ProdutoModel, "id">>({
    nomeProd: "",
    tipo: "moído",
    precoPorKg: 0,
    descricao: "",
  });

  // Edição de produto
  const [editProduto, setEditProduto] = useState<ProdutoComBags | null>(null);

  // Bags em edição (peso, status)
  const [editingBags, setEditingBags] = useState<Bag[]>([]);

  // Dialog controle - se está em modo edição ou criação
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Buscar produtos com suas bags
  const fetchProdutos = async () => {
    const produtosSnapshot = await getDocs(collection(db, "produtos"));
    const produtosData: ProdutoComBags[] = [];

    for (const docSnap of produtosSnapshot.docs) {
      const produto = docSnap.data() as ProdutoModel;
      const bagsSnap = await getDocs(collection(db, `produtos/${docSnap.id}/bags`));
      const bags: Bag[] = bagsSnap.docs.map((b) => ({
        ...(b.data() as Omit<Bag, "criadoEm">),
        id: b.id,
        criadoEm: b.data().criadoEm?.toDate?.() || new Date(),
        produtoId: b.data().produtoId,
      }));
      produtosData.push({ ...produto, id: docSnap.id, bags });
    }

    setProdutos(produtosData);
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  // Deletar produto (e suas bags)
  const handleDeleteProduto = async (id: string) => {
    await deleteDoc(doc(db, "produtos", id));
    toast({
      title: "Produto excluído",
      description: "Produto removido com sucesso.",
      variant: "destructive",
    });
    fetchProdutos();
  };

  // Criar novo produto
  const handleAdicionarProduto = async () => {
    if (!novoProduto.nomeProd || novoProduto.precoPorKg <= 0) return;

    try {
      const docRef = await addDoc(collection(db, "produtos"), novoProduto);
      toast({ title: "Produto criado com sucesso" });
      setIsDialogOpen(false);
      setNovoProduto({ nomeProd: "", tipo: "moído", precoPorKg: 0, descricao: "" });
      fetchProdutos();
    } catch {
      toast({ title: "Erro ao criar produto", variant: "destructive" });
    }
  };

  // Abrir diálogo para editar produto e suas bags
  const openEditDialog = (produto: ProdutoComBags) => {
    setEditProduto(produto);
    setEditingBags(produto.bags);
    setIsEditDialogOpen(true);
  };

  // Atualizar produto no Firestore
  const handleUpdateProduto = async () => {
    if (!editProduto) return;
    try {
      // Atualiza dados do produto
      await updateDoc(doc(db, "produtos", editProduto.id), {
        nomeProd: editProduto.nomeProd,
        tipo: editProduto.tipo,
        precoPorKg: editProduto.precoPorKg,
        descricao: editProduto.descricao,
      });

      // Atualiza bags: para cada bag, se tem id real no Firestore, updateDoc; senão addDoc
      await Promise.all(
        editingBags.map(async (bag) => {
          const bagRef = doc(db, "produtos", editProduto.id, "bags", bag.id);

          if (bag.id.startsWith("temp-") || bag.id.length < 10) {
            await addDoc(collection(db, "produtos", editProduto.id, "bags"), {
              pesoKg: bag.pesoKg,
              status: bag.status,
              criadoEm:
                bag.criadoEm instanceof Date
                  ? Timestamp.fromDate(bag.criadoEm)
                  : bag.criadoEm,
              produtoId: editProduto.id,
            });
          } else {
            await updateDoc(bagRef, {
              pesoKg: bag.pesoKg,
              status: bag.status,
              criadoEm:
                bag.criadoEm instanceof Date
                  ? Timestamp.fromDate(bag.criadoEm)
                  : bag.criadoEm,
              produtoId: editProduto.id,
            });
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

  // Atualizar campo bag localmente
  const updateBagField = (id: string, field: keyof Omit<Bag, "id">, value: any) => {
    setEditingBags((prev) =>
      prev.map((bag) =>
        bag.id === id
          ? {
              ...bag,
              [field]: value,
              produtoId: bag.produtoId,
            }
          : bag
      )
    );
  };

  // Adicionar bag nova no estado local
  const handleAddBag = () => {
    if (!editProduto) return;

    const novaBag: Bag = {
      id: `temp-${Math.random().toString(36).substring(2, 9)}`,
      pesoKg: 0,
      status: "disponivel",
      criadoEm: new Date(),
      produtoId: editProduto.id,
    };
    setEditingBags((prev) => [...prev, novaBag]);
  };

  // Remover bag localmente e no firestore se já existe lá
  const handleRemoveBag = async (id: string) => {
    if (!editProduto) return;
    const bagExisteNoFirestore = !id.startsWith("temp-") && !id.includes(".");

    if (bagExisteNoFirestore) {
      await deleteDoc(doc(db, "produtos", editProduto.id, "bags", id));
    }

    setEditingBags((prev) => prev.filter((b) => b.id !== id));
  };

  // Filtrar produtos
  const produtosFiltrados = produtos.filter(
    (p) =>
      p.nomeProd.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular estoque total
  const calcularEstoqueTotal = (bags: Bag[]) =>
    bags.reduce((acc, bag) => (bag.status === "disponivel" ? acc + bag.pesoKg : acc), 0);

  // Cores para status das bags
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
            {/* Scroll para o form */}
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

      {/* Lista produtos */}
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
                      <strong>R$ {produto.precoPorKg.toFixed(2).replace(".", ",")}</strong>
                      <br />
                      Estoque disponível: <strong>{estoqueTotal.toFixed(2)} KG</strong>
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
                      {produto.bags.map((bag, index) => (
                        <div
                          key={bag.id}
                          className={`flex justify-between items-center border rounded px-2 py-1 shadow-sm ${statusColors[bag.status]}`}
                        >
                          <span className="font-semibold">{`Bag ${String(index + 1).padStart(2, "0")}`}</span>
                          <span>
                            {bag.pesoKg.toFixed(2)} KG -{" "}
                            <span className="capitalize">{bag.status}</span>
                          </span>
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

      {/* Dialog edição produto + bags */}
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
                    setEditProduto({ ...editProduto, tipo: e.target.value as ProdutoModel["tipo"] })
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
                    setEditProduto({ ...editProduto, precoPorKg: parseFloat(e.target.value) })
                  }
                />
              </div>

              {/* Edição bags */}
              <div className="space-y-2 mt-4">
                <Label>Bags</Label>
                {editingBags.map((bag, index) => (
                  <div
                    key={bag.id}
                    className={`flex gap-2 items-center ${statusColors[bag.status]} rounded p-2`}
                  >
                    <span className="font-semibold min-w-[70px]">{`Bag ${String(index + 1).padStart(2, "0")}`}</span>
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
    </div>
  );
}
