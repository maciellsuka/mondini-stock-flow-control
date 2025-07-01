
import { useState } from "react";
import { Plus, Search, Edit, Trash2, FileText, Calendar, User, Package } from "lucide-react";
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

interface ItemPedido {
  id: number;
  produtoId: number;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

interface Pedido {
  id: number;
  clienteId: number;
  clienteNome: string;
  dataPedido: string;
  dataEntrega?: string;
  status: "pendente" | "processando" | "concluido" | "cancelado";
  itens: ItemPedido[];
  total: number;
  observacoes?: string;
}

const mockClientes = [
  { id: 1, nome: "João Silva" },
  { id: 2, nome: "Maria Santos" },
  { id: 3, nome: "Pedro Costa" }
];

const mockProdutos = [
  { id: 1, nome: "Farinha de Trigo", preco: 4.50 },
  { id: 2, nome: "Açúcar Cristal", preco: 3.20 },
  { id: 3, nome: "Café Moído", preco: 12.90 },
  { id: 4, nome: "Arroz Branco", preco: 6.80 }
];

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([
    {
      id: 1,
      clienteId: 1,
      clienteNome: "João Silva",
      dataPedido: "2024-01-15",
      dataEntrega: "2024-01-18",
      status: "concluido",
      itens: [
        {
          id: 1,
          produtoId: 1,
          produtoNome: "Farinha de Trigo",
          quantidade: 10,
          precoUnitario: 4.50,
          subtotal: 45.00
        }
      ],
      total: 45.00,
      observacoes: "Entregar no período da manhã"
    },
    {
      id: 2,
      clienteId: 2,
      clienteNome: "Maria Santos",
      dataPedido: "2024-01-16",
      status: "processando",
      itens: [
        {
          id: 2,
          produtoId: 2,
          produtoNome: "Açúcar Cristal",
          quantidade: 5,
          precoUnitario: 3.20,
          subtotal: 16.00
        },
        {
          id: 3,
          produtoId: 3,
          produtoNome: "Café Moído",
          quantidade: 2,
          precoUnitario: 12.90,
          subtotal: 25.80
        }
      ],
      total: 41.80
    }
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [formData, setFormData] = useState({
    clienteId: "",
    dataEntrega: "",
    status: "pendente" as const,
    observacoes: ""
  });
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [novoItem, setNovoItem] = useState({
    produtoId: "",
    quantidade: 1
  });

  const filteredPedidos = pedidos.filter(pedido =>
    pedido.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pedido.id.toString().includes(searchTerm)
  );

  const resetForm = () => {
    setFormData({
      clienteId: "",
      dataEntrega: "",
      status: "pendente",
      observacoes: ""
    });
    setItens([]);
    setNovoItem({ produtoId: "", quantidade: 1 });
    setEditingPedido(null);
  };

  const adicionarItem = () => {
    if (!novoItem.produtoId) return;
    
    const produto = mockProdutos.find(p => p.id === parseInt(novoItem.produtoId));
    if (!produto) return;

    const itemExistente = itens.find(item => item.produtoId === parseInt(novoItem.produtoId));
    
    if (itemExistente) {
      setItens(prev => prev.map(item =>
        item.produtoId === parseInt(novoItem.produtoId)
          ? {
              ...item,
              quantidade: item.quantidade + novoItem.quantidade,
              subtotal: (item.quantidade + novoItem.quantidade) * item.precoUnitario
            }
          : item
      ));
    } else {
      const novoItemPedido: ItemPedido = {
        id: Date.now(),
        produtoId: parseInt(novoItem.produtoId),
        produtoNome: produto.nome,
        quantidade: novoItem.quantidade,
        precoUnitario: produto.preco,
        subtotal: novoItem.quantidade * produto.preco
      };
      setItens(prev => [...prev, novoItemPedido]);
    }
    
    setNovoItem({ produtoId: "", quantidade: 1 });
  };

  const removerItem = (id: number) => {
    setItens(prev => prev.filter(item => item.id !== id));
  };

  const calcularTotal = () => {
    return itens.reduce((total, item) => total + item.subtotal, 0);
  };

  const handleSave = () => {
    if (!formData.clienteId || itens.length === 0) return;

    const cliente = mockClientes.find(c => c.id === parseInt(formData.clienteId));
    if (!cliente) return;

    if (editingPedido) {
      setPedidos(prev => prev.map(pedido =>
        pedido.id === editingPedido.id
          ? {
              ...pedido,
              clienteId: parseInt(formData.clienteId),
              clienteNome: cliente.nome,
              dataEntrega: formData.dataEntrega,
              status: formData.status,
              itens: itens,
              total: calcularTotal(),
              observacoes: formData.observacoes
            }
          : pedido
      ));
    } else {
      const novoPedido: Pedido = {
        id: Date.now(),
        clienteId: parseInt(formData.clienteId),
        clienteNome: cliente.nome,
        dataPedido: new Date().toISOString().split('T')[0],
        dataEntrega: formData.dataEntrega,
        status: formData.status,
        itens: itens,
        total: calcularTotal(),
        observacoes: formData.observacoes
      };
      setPedidos(prev => [...prev, novoPedido]);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (pedido: Pedido) => {
    setEditingPedido(pedido);
    setFormData({
      clienteId: pedido.clienteId.toString(),
      dataEntrega: pedido.dataEntrega || "",
      status: pedido.status,
      observacoes: pedido.observacoes || ""
    });
    setItens(pedido.itens);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setPedidos(prev => prev.filter(pedido => pedido.id !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente": return "bg-yellow-100 text-yellow-800";
      case "processando": return "bg-blue-100 text-blue-800";
      case "concluido": return "bg-green-100 text-green-800";
      case "cancelado": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendente": return "Pendente";
      case "processando": return "Processando";
      case "concluido": return "Concluído";
      case "cancelado": return "Cancelado";
      default: return status;
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select
                    value={formData.clienteId}
                    onValueChange={(value) => setFormData({ ...formData, clienteId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockClientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id.toString()}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataEntrega">Data de Entrega</Label>
                  <Input
                    id="dataEntrega"
                    type="date"
                    value={formData.dataEntrega}
                    onChange={(e) => setFormData({ ...formData, dataEntrega: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
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
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre o pedido"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Itens do Pedido</h3>
                
                <div className="flex gap-2 mb-4">
                  <Select
                    value={novoItem.produtoId}
                    onValueChange={(value) => setNovoItem({ ...novoItem, produtoId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockProdutos.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id.toString()}>
                          {produto.nome} - R$ {produto.preco.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={novoItem.quantidade}
                    onChange={(e) => setNovoItem({ ...novoItem, quantidade: parseInt(e.target.value) || 1 })}
                    className="w-24"
                    placeholder="Qtd"
                  />
                  <Button onClick={adicionarItem} disabled={!novoItem.produtoId}>
                    Adicionar
                  </Button>
                </div>

                {itens.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.produtoNome}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
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
                        <TableCell colSpan={3} className="font-medium">Total</TableCell>
                        <TableCell className="font-bold">R$ {calcularTotal().toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!formData.clienteId || itens.length === 0}>
                {editingPedido ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pedidos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pedidos.filter(p => p.status === "pendente").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pedidos.filter(p => p.status === "processando").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {pedidos.reduce((total, pedido) => total + pedido.total, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <TableCell>{new Date(pedido.dataPedido).toLocaleDateString()}</TableCell>
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
                        onClick={() => handleEdit(pedido)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(pedido.id)}
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
