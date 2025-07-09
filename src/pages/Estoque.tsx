import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Produto, Bag, ProdutoComBags } from "@/models/firebaseModels";

export default function Estoque() {
  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoComBags | null>(null);
  const [bagEditando, setBagEditando] = useState<Bag | null>(null);
  const [pesoEdit, setPesoEdit] = useState("");
  const [statusEdit, setStatusEdit] = useState<Bag["status"]>("disponivel");

  const fetchProdutosComBags = async () => {
    const produtosCol = collection(db, "produtos");
    const snapshot = await getDocs(produtosCol);
    const produtosData: ProdutoComBags[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const bagsCol = collection(db, `produtos/${docSnap.id}/bags`);
      const bagsSnap = await getDocs(bagsCol);
      const bags: Bag[] = bagsSnap.docs.map((bagDoc) => ({
        id: bagDoc.id,
        produtoId: docSnap.id,
        pesoKg: bagDoc.data().pesoKg,
        status: bagDoc.data().status,
        criadoEm: bagDoc.data().criadoEm?.toDate() ?? new Date(),
      }));

      produtosData.push({
        id: docSnap.id,
        nomeProd: data.nomeProd,
        precoPorKg: data.precoPorKg,
        bags,
      });
    }

    setProdutos(produtosData);
  };

  useEffect(() => {
    fetchProdutosComBags();
  }, []);

  const getStatusBadge = (status: Bag["status"]) => {
    switch (status) {
      case "disponivel":
        return <Badge className="bg-green-100 text-green-800">Disponível</Badge>;
      case "reservado":
        return <Badge className="bg-yellow-100 text-yellow-800">Reservado</Badge>;
      case "vendido":
        return <Badge className="bg-red-100 text-red-800">Vendido</Badge>;
    }
  };

  const editarBag = (bag: Bag) => {
    setBagEditando(bag);
    setPesoEdit(bag.pesoKg.toString());
    setStatusEdit(bag.status);
  };

  const salvarBag = async () => {
    if (!bagEditando || !produtoSelecionado) return;
    const ref = doc(db, "produtos", bagEditando.produtoId, "bags", bagEditando.id);
    await updateDoc(ref, {
      pesoKg: parseFloat(pesoEdit),
      status: statusEdit,
    });
    await fetchProdutosComBags();
    setBagEditando(null);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
      <p className="text-gray-500">Visualize os produtos e suas bags em estoque</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {produtos.map((produto) => {
          const totalDisponivel = produto.bags
            .filter((b) => b.status === "disponivel")
            .reduce((acc, b) => acc + b.pesoKg, 0);

          const isLowStock = totalDisponivel < 10;

          return (
            <Dialog key={produto.id}>
              <DialogTrigger asChild>
                <Card
                  onClick={() => setProdutoSelecionado(produto)}
                  className={`cursor-pointer transition hover:shadow-md ${
                    isLowStock ? "border-red-500 border-2" : ""
                  }`}
                >
                  <CardHeader>
                    <CardTitle>{produto.nomeProd}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Preço: <strong>R$ {produto.precoPorKg.toFixed(2)}/kg</strong>
                    </p>
                    <p className={`text-sm ${isLowStock ? "text-red-600" : "text-gray-600"}`}>
                      Estoque disponível:{" "}
                      <strong>{totalDisponivel.toFixed(2)} kg</strong>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Total de bags: {produto.bags.length}
                    </p>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{produto.nomeProd} - Detalhes das Bags</DialogTitle>
                </DialogHeader>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Peso (kg)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtoSelecionado?.bags.map((bag) => (
                      <TableRow key={bag.id}>
                        <TableCell>{bag.id}</TableCell>
                        <TableCell>{bag.pesoKg.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(bag.status)}</TableCell>
                        <TableCell>{new Date(bag.criadoEm).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => editarBag(bag)}>
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {bagEditando && (
                  <div className="mt-6 space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-gray-700">Editando Bag: {bagEditando.id}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Peso (kg)</label>
                        <Input
                          type="number"
                          value={pesoEdit}
                          onChange={(e) => setPesoEdit(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Status</label>
                        <select
                          value={statusEdit}
                          onChange={(e) => setStatusEdit(e.target.value as Bag["status"])}
                          className="w-full border rounded px-3 py-2 text-sm"
                        >
                          <option value="disponivel">Disponível</option>
                          <option value="reservado">Reservado</option>
                          <option value="vendido">Vendido</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setBagEditando(null)}>Cancelar</Button>
                      <Button onClick={salvarBag}>Salvar</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </div>
  );
}
