import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

import { ProdutoComBags, Bag } from "@/models/firebaseModels";

export default function Estoque() {
  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<ProdutoComBags | null>(null);
  const [mostrarVendidas, setMostrarVendidas] = useState(false);
  const [bagEditando, setBagEditando] = useState<Bag | null>(null);
  const [pesoEdit, setPesoEdit] = useState("");
  const [statusEdit, setStatusEdit] = useState<Bag["status"]>("disponivel");
  const [editBagDialogOpen, setEditBagDialogOpen] = useState(false);

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
        identificador: bagDoc.data().identificador || "",
        pesoKg: bagDoc.data().pesoKg || 0,
        status: bagDoc.data().status || "disponivel",
        criadoEm: bagDoc.data().criadoEm?.toDate?.() ?? new Date(),
      }));

      produtosData.push({
        id: docSnap.id,
        nomeProd: data.nomeProd,
        precoPorKg: data.precoPorKg,
        bags,
        tipo: data.tipo,
        descricao: data.descricao || "",
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
        return (
          <Badge className="bg-green-100 text-green-800">Disponível</Badge>
        );
      case "reservado":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">Reservado</Badge>
        );
      case "vendido":
        return <Badge className="bg-red-100 text-red-800">Vendido</Badge>;
      default:
        return <Badge>Status desconhecido</Badge>;
    }
  };

  const getUltimaBagCriada = (bags: Bag[]) => {
    if (!bags.length) return null;

    return [...bags].sort((a, b) => {
      const dataA =
        a.criadoEm instanceof Date
          ? a.criadoEm.getTime()
          : new Date(a.criadoEm).getTime();

      const dataB =
        b.criadoEm instanceof Date
          ? b.criadoEm.getTime()
          : new Date(b.criadoEm).getTime();

      return dataB - dataA;
    })[0];
  };

  const editarBag = (bag: Bag) => {
    setBagEditando(bag);
    setPesoEdit(bag.pesoKg.toString());
    setStatusEdit(bag.status);
    setEditBagDialogOpen(true);
  };

  const salvarBag = async () => {
    if (!bagEditando || !produtoSelecionado) return;

    const peso = parseFloat(pesoEdit);

    if (isNaN(peso) || peso <= 0) return;

    const ref = doc(
      db,
      "produtos",
      bagEditando.produtoId,
      "bags",
      bagEditando.id,
    );

    await updateDoc(ref, {
      pesoKg: peso,
      status: statusEdit,
    });

    await fetchProdutosComBags();

    const produtosAtualizadosSnapshot = await getDocs(
      collection(db, "produtos"),
    );
    const produtosAtualizados: ProdutoComBags[] = [];

    for (const docSnap of produtosAtualizadosSnapshot.docs) {
      const data = docSnap.data();
      const bagsCol = collection(db, `produtos/${docSnap.id}/bags`);
      const bagsSnap = await getDocs(bagsCol);

      const bags: Bag[] = bagsSnap.docs.map((bagDoc) => ({
        id: bagDoc.id,
        produtoId: docSnap.id,
        identificador: bagDoc.data().identificador || "",
        pesoKg: bagDoc.data().pesoKg || 0,
        status: bagDoc.data().status || "disponivel",
        criadoEm: bagDoc.data().criadoEm?.toDate?.() ?? new Date(),
      }));

      produtosAtualizados.push({
        id: docSnap.id,
        nomeProd: data.nomeProd,
        precoPorKg: data.precoPorKg,
        bags,
        tipo: data.tipo,
        descricao: data.descricao || "",
      });
    }

    const produtoAtualizado =
      produtosAtualizados.find((p) => p.id === produtoSelecionado.id) || null;

    setProdutos(produtosAtualizados);
    setProdutoSelecionado(produtoAtualizado);
    setBagEditando(null);
    setEditBagDialogOpen(false);
  };

  const abrirModal = (produto: ProdutoComBags, vendido: boolean) => {
    setProdutoSelecionado(produto);
    setMostrarVendidas(vendido);
    setBagEditando(null);
  };

  const produtosDisponiveis = produtos.filter((p) =>
    p.bags.some((b) => b.status === "disponivel" || b.status === "reservado"),
  );

  const produtosVendidos = produtos.filter((p) =>
    p.bags.some((b) => b.status === "vendido"),
  );

  const bagsFiltradas =
    produtoSelecionado?.bags.filter((bag) =>
      mostrarVendidas
        ? bag.status === "vendido"
        : bag.status === "disponivel" || bag.status === "reservado",
    ) || [];

  const ultimaBagProdutoSelecionado = produtoSelecionado
    ? getUltimaBagCriada(produtoSelecionado.bags)
    : null;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
      <p className="text-gray-500">
        Visualize os produtos e suas bags em estoque
      </p>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Estoque Disponível</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {produtosDisponiveis.map((produto) => {
            const bagsDisponiveis = produto.bags.filter(
              (b) => b.status === "disponivel" || b.status === "reservado",
            );

            const totalDisponivel = bagsDisponiveis.reduce(
              (acc, b) => acc + b.pesoKg,
              0,
            );

            const isLowStock = totalDisponivel < 10;
            const ultimaBagCriada = getUltimaBagCriada(produto.bags);

            return (
              <Dialog key={produto.id}>
                <DialogTrigger asChild>
                  <Card
                    onClick={() => abrirModal(produto, false)}
                    className={`cursor-pointer transition hover:shadow-md ${
                      isLowStock ? "border-red-500 border-2" : ""
                    }`}
                  >
                    <CardHeader>
                      <CardTitle>{produto.nomeProd}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">
                        Preço:{" "}
                        <strong>R$ {produto.precoPorKg.toFixed(2)}/kg</strong>
                      </p>
                      <p
                        className={`text-sm ${
                          isLowStock ? "text-red-600" : "text-gray-600"
                        }`}
                      >
                        Estoque disponível:{" "}
                        <strong>{totalDisponivel.toFixed(2)} kg</strong>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Total de bags: {bagsDisponiveis.length}
                      </p>

                      {ultimaBagCriada && (
                        <div className="mt-3 rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="font-medium text-gray-800">
                            Última bag criada
                          </p>
                          <p className="text-gray-600">
                            <strong>Nº:</strong>{" "}
                            {ultimaBagCriada.identificador ||
                              ultimaBagCriada.id}
                          </p>
                          <p className="text-gray-600">
                            <strong>Peso:</strong>{" "}
                            {ultimaBagCriada.pesoKg.toFixed(2)} kg
                          </p>
                          <p className="text-gray-600">
                            <strong>Data:</strong>{" "}
                            {new Date(
                              ultimaBagCriada.criadoEm,
                            ).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </DialogTrigger>

                <DialogContent className="max-w-3xl max-h-[600px] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {produtoSelecionado?.nomeProd} - Bags Disponíveis
                    </DialogTitle>
                  </DialogHeader>

                  {produtoSelecionado &&
                    !mostrarVendidas &&
                    ultimaBagProdutoSelecionado && (
                      <div className="rounded-md border bg-muted/40 p-4 text-sm">
                        <p className="font-semibold mb-2">Última bag criada</p>
                        <p>
                          <strong>Nº:</strong>{" "}
                          {ultimaBagProdutoSelecionado.identificador ||
                            ultimaBagProdutoSelecionado.id}
                        </p>
                        <p>
                          <strong>Peso:</strong>{" "}
                          {ultimaBagProdutoSelecionado.pesoKg.toFixed(2)} kg
                        </p>
                        <p>
                          <strong>Data:</strong>{" "}
                          {new Date(
                            ultimaBagProdutoSelecionado.criadoEm,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Peso (kg)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bagsFiltradas.map((bag) => (
                        <TableRow key={bag.id}>
                          <TableCell>{bag.identificador || bag.id}</TableCell>
                          <TableCell>{bag.pesoKg.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(bag.status)}</TableCell>
                          <TableCell>
                            {new Date(bag.criadoEm).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editarBag(bag)}
                            >
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">Bags Vendidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {produtosVendidos.map((produto) => {
            const bagsVendidas = produto.bags.filter(
              (b) => b.status === "vendido",
            );

            const totalVendido = bagsVendidas.reduce(
              (acc, b) => acc + b.pesoKg,
              0,
            );

            const ultimaBagCriada = getUltimaBagCriada(produto.bags);

            return (
              <Dialog key={produto.id}>
                <DialogTrigger asChild>
                  <Card
                    onClick={() => abrirModal(produto, true)}
                    className="cursor-pointer transition hover:shadow-md border border-gray-300"
                  >
                    <CardHeader>
                      <CardTitle>{produto.nomeProd}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">
                        Preço:{" "}
                        <strong>R$ {produto.precoPorKg.toFixed(2)}/kg</strong>
                      </p>
                      <p className="text-sm text-gray-600">
                        Total vendido:{" "}
                        <strong>{totalVendido.toFixed(2)} kg</strong>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Total de bags: {bagsVendidas.length}
                      </p>

                      {ultimaBagCriada && (
                        <div className="mt-3 rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="font-medium text-gray-800">
                            Última bag criada
                          </p>
                          <p className="text-gray-600">
                            <strong>Nº:</strong>{" "}
                            {ultimaBagCriada.identificador ||
                              ultimaBagCriada.id}
                          </p>
                          <p className="text-gray-600">
                            <strong>Peso:</strong>{" "}
                            {ultimaBagCriada.pesoKg.toFixed(2)} kg
                          </p>
                          <p className="text-gray-600">
                            <strong>Data:</strong>{" "}
                            {new Date(
                              ultimaBagCriada.criadoEm,
                            ).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </DialogTrigger>

                <DialogContent className="max-w-3xl max-h-[600px] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {produtoSelecionado?.nomeProd} - Bags Vendidas
                    </DialogTitle>
                  </DialogHeader>

                  {produtoSelecionado &&
                    mostrarVendidas &&
                    ultimaBagProdutoSelecionado && (
                      <div className="rounded-md border bg-muted/40 p-4 text-sm">
                        <p className="font-semibold mb-2">Última bag criada</p>
                        <p>
                          <strong>Nº:</strong>{" "}
                          {ultimaBagProdutoSelecionado.identificador ||
                            ultimaBagProdutoSelecionado.id}
                        </p>
                        <p>
                          <strong>Peso:</strong>{" "}
                          {ultimaBagProdutoSelecionado.pesoKg.toFixed(2)} kg
                        </p>
                        <p>
                          <strong>Data:</strong>{" "}
                          {new Date(
                            ultimaBagProdutoSelecionado.criadoEm,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Peso (kg)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bagsFiltradas.map((bag) => (
                        <TableRow key={bag.id}>
                          <TableCell>{bag.identificador || bag.id}</TableCell>
                          <TableCell>{bag.pesoKg.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(bag.status)}</TableCell>
                          <TableCell>
                            {new Date(bag.criadoEm).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editarBag(bag)}
                            >
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </section>

      <Dialog open={editBagDialogOpen} onOpenChange={setEditBagDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar Bag {bagEditando?.identificador || bagEditando?.id}
            </DialogTitle>
          </DialogHeader>

          {bagEditando && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Peso (kg)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={pesoEdit}
                  onChange={(e) => setPesoEdit(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Status</label>
                <select
                  value={statusEdit}
                  onChange={(e) =>
                    setStatusEdit(e.target.value as Bag["status"])
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="disponivel">Disponível</option>
                  <option value="reservado">Reservado</option>
                  <option value="vendido">Vendido</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setBagEditando(null);
                    setEditBagDialogOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={salvarBag}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
