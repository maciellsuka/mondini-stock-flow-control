
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, FileText, Phone, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  cnpj?: string;
  status: "Ativo" | "Inativo";
  totalPedidos: number;
  ultimoPedido: string;
}

export default function Clientes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dados mockados
  const [clientes, setClientes] = useState<Cliente[]>([
    {
      id: "CLI-001",
      nome: "Empresa ABC Ltda",
      email: "contato@empresaabc.com.br",
      telefone: "(11) 98765-4321",
      endereco: "Rua das Flores, 123",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01234-567",
      cnpj: "12.345.678/0001-90",
      status: "Ativo",
      totalPedidos: 45,
      ultimoPedido: "2024-01-05"
    },
    {
      id: "CLI-002",
      nome: "Indústria XYZ S/A",
      email: "comercial@industriaxyz.com.br",
      telefone: "(11) 87654-3210",
      endereco: "Av. Industrial, 456",
      cidade: "São Bernardo do Campo",
      estado: "SP",
      cep: "09876-543",
      cnpj: "98.765.432/0001-10",
      status: "Ativo",
      totalPedidos: 78,
      ultimoPedido: "2024-01-06"
    },
    {
      id: "CLI-003",
      nome: "Comercial 123",
      email: "vendas@comercial123.com.br",
      telefone: "(11) 76543-2109",
      endereco: "Rua do Comércio, 789",
      cidade: "Santo André",
      estado: "SP",
      cep: "09123-456",
      status: "Inativo",
      totalPedidos: 23,
      ultimoPedido: "2023-12-15"
    }
  ]);

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm)
  );

  const handleSaveClient = () => {
    toast({
      title: isEditing ? "Cliente atualizado" : "Cliente criado",
      description: `O cliente foi ${isEditing ? "atualizado" : "criado"} com sucesso.`,
    });
    setIsDialogOpen(false);
    setSelectedClient(null);
    setIsEditing(false);
  };

  const handleEditClient = (cliente: Cliente) => {
    setSelectedClient(cliente);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDeleteClient = (id: string) => {
    setClientes(clientes.filter(c => c.id !== id));
    toast({
      title: "Cliente excluído",
      description: "O cliente foi excluído com sucesso.",
      variant: "destructive",
    });
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e histórico de pedidos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? "Edite as informações do cliente" : "Cadastre um novo cliente no sistema"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome/Razão Social *</Label>
                  <Input id="nome" placeholder="Digite o nome ou razão social" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" placeholder="00.000.000/0000-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" placeholder="contato@empresa.com.br" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input id="telefone" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" placeholder="Rua, número, complemento" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" placeholder="São Paulo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input id="estado" placeholder="SP" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" placeholder="00000-000" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveClient}>
                {isEditing ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de pesquisa */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="grid gap-4">
        {filteredClientes.map((cliente) => (
          <Card key={cliente.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{cliente.nome}</h3>
                    <Badge variant={cliente.status === "Ativo" ? "default" : "secondary"}>
                      {cliente.status}
                    </Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {cliente.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {cliente.telefone}
                      </div>
                      {cliente.cnpj && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CNPJ: {cliente.cnpj}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {cliente.endereco}
                      </div>
                      <div className="text-xs">
                        {cliente.cidade} - {cliente.estado}, {cliente.cep}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">{cliente.totalPedidos}</span> pedidos realizados
                        <br />
                        Último pedido: {cliente.ultimoPedido}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClient(cliente)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClient(cliente.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClientes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Tente ajustar os termos de busca" : "Cadastre seu primeiro cliente para começar"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
