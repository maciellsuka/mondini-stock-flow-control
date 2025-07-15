import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { Cliente, ProdutoComBags, Bag, Pedido, ProdutoNoPedido } from "@/models/firebaseModels";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, Timestamp, updateDoc } from "firebase/firestore";
import { calcularTotalPedido } from "@/models/firebaseModels";

interface Props {
  open: boolean;
  setOpen: (val: boolean) => void;
  clientes: Cliente[];
  produtos: ProdutoComBags[];
  pedidoParaEditar?: Pedido | null;
  onPedidoSalvo: () => void;
}

export default function ModalPedido({ open, setOpen, clientes, produtos, pedidoParaEditar, onPedidoSalvo }: Props) {
  const [clienteId, setClienteId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [status, setStatus] = useState<Pedido["status"]>("pendente");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ProdutoNoPedido[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [bagSelections, setBagSelections] = useState<Record<string, number>>({});

  useEffect(() => {
    if (pedidoParaEditar) {
      setClienteId(pedidoParaEditar.clienteId);
      setDataEntrega(pedidoParaEditar.dataEntrega || "");
      setStatus(pedidoParaEditar.status);
      setObservacoes(pedidoParaEditar.observacoes || "");
      setItens(pedidoParaEditar.produtos);
    } else {
      setClienteId("");
      setDataEntrega("");
      setStatus("pendente");
      setObservacoes("");
      setItens([]);
    }
  }, [pedidoParaEditar]);

  const adicionarProduto = () => {
    if (!produtoSelecionado) return;

    const produto = produtos.find(p => p.id === produtoSelecionado);
    if (!produto) return;

    const bagsSelecionadas = Object.entries(bagSelections).map(([bagId, peso]) => ({ bagId, peso: Number(peso) })).filter(b => b.peso > 0);

    const totalKg = bagsSelecionadas.reduce((sum, b) => sum + b.peso, 0);

    if (totalKg <= 0) return;

    const novoProduto: ProdutoNoPedido = {
      produtoId: produto.id,
      nomeProd: produto.nomeProd,
      precoPorKg: produto.precoPorKg,
      quantidadeKg: totalKg,
      bagsSelecionadas
    };

    setItens(prev => [...prev, novoProduto]);
    setProdutoSelecionado("");
    setBagSelections({});
  };

  const salvarPedido = async () => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente || itens.length === 0) return;

    const total = calcularTotalPedido(itens);

    const pedido: Omit<Pedido, "id"> = {
      clienteId,
      clienteNome: cliente.nome,
      dataPedido: Timestamp.now().toDate().toISOString(),
      dataEntrega,
      status,
      observacoes,
      produtos: itens,
      total,
    };

    const col = collection(db, "pedidos");
    await addDoc(col, pedido);

    setOpen(false);
    onPedidoSalvo();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pedidoParaEditar ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de entrega</Label>
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Pedido["status"]) }>
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
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <div className="border-t mt-6 pt-4">
          <h3 className="font-semibold mb-2">Adicionar Produto</h3>

          <Select value={produtoSelecionado} onValueChange={(v) => setProdutoSelecionado(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um produto" />
            </SelectTrigger>
            <SelectContent>
              {produtos.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nomeProd}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {produtoSelecionado && (
            <div className="mt-4">
              <Label>Bags disponíveis</Label>
              <div className="grid grid-cols-2 gap-2">
                {produtos.find(p => p.id === produtoSelecionado)?.bags.map(bag => (
                  <div key={bag.id} className="flex items-center gap-2">
                    <span className="text-sm font-medium">Bag {bag.identificador} ({bag.pesoKg}kg)</span>
                    <Input
                      type="number"
                      min={0}
                      max={bag.pesoKg}
                      step={0.01}
                      placeholder="Peso a retirar"
                      value={bagSelections[bag.id] || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setBagSelections(prev => ({ ...prev, [bag.id]: isNaN(value) ? 0 : value }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <Button className="mt-4" onClick={adicionarProduto}>Adicionar ao Pedido</Button>
            </div>
          )}
        </div>

        {itens.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Itens do Pedido</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.nomeProd}</TableCell>
                    <TableCell>{item.quantidadeKg.toFixed(2)} kg</TableCell>
                    <TableCell>R$ {(item.quantidadeKg * item.precoPorKg).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setItens(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvarPedido}>Salvar Pedido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
