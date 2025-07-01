
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Produto {
  id: string;
  nome: string;
  categoria: "Produto Final" | "Material Moído" | "MCOLOR";
  descricao: string;
  preco: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  unidade: string;
  status: "Ativo" | "Inativo";
  dataCadastro: string;
  // Campos específicos para Material Moído
  pesoSaco?: number; // em KG
  tipoMaterial?: string;
  quantidadeSacos?: number;
}

export default function Produtos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dados mockados com exemplos de material moído
  const [produtos, setProdutos] = useState<Produto[]>([
    {
      id: "PROD-001",
      nome: "Produto Final Alpha",
      categoria: "Produto Final",
      descricao: "Produto finalizado pronto para venda",
      preco: 45.90,
      estoqueAtual: 150,
      estoqueMinimo: 50,
      unidade: "UN",
      status: "Ativo",
      dataCadastro: "2024-01-01"
    },
    {
      id: "MAT-001",
      nome: "Material Moído Premium",
      categoria: "Material Moído",
      descricao: "Material processado de alta qualidade",
      preco: 12.50,
      estoqueAtual: 240,
      estoqueMinimo: 100,
      unidade: "KG",
      status: "Ativo",
      dataCadastro: "2024-01-02",
      pesoSaco: 25,
      tipoMaterial: "Premium Grade A",
      quantidadeSacos: 10
    },
    {
      id: "MAT-002",
      nome: "Material Moído Standard",
      categoria: "Material Moído",
      descricao: "Material processado padrão",
      preco: 8.75,
      estoqueAtual: 150,
      estoqueMinimo: 80,
      unidade: "KG",
      status: "Ativo",
      dataCadastro: "2024-01-03",
      pesoSaco: 20,
      tipoMaterial: "Standard Grade B",
      quantidadeSacos: 8
    },
    {
      id: "PROD-003",
      nome: "MCOLOR Verde Fluorescente",
      categoria: "MCOLOR",
      descricao: "Pigmento verde fluorescente",
      preco: 78.00,
      estoqueAtual: 8,
      estoqueMinimo: 20,
      unidade: "LT",
      status: "Ativo",
      dataCadastro: "2024-01-03"
    }
  ]);

  const filteredProdutos = produtos.filter(produto => {
    const matchesSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         produto.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || produto.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const isLowStock = (produto: Produto) => produto.estoqueAtual <= produto.estoqueMinimo;

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "Produto Final": return "bg-green-100 text-green-800";
      case "Material Moído": return "bg-orange-100 text-orange-800";
      case "MCOLOR": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleSaveProduct = () => {
    toast({
      title: isEditing ? "Produto atualizado" : "Produto criado",
      description: `O produto foi ${isEditing ? "atualizado" : "criado"} com sucesso.`,
    });
    setIsDialogOpen(false);
    setSelectedProduct(null);
    setIsEditing(false);
  };

  const handleEditProduct = (produto: Produto) => {
    setSelectedProduct(produto);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
    toast({
      title: "Produto excluído",
      description: "O produto foi excluído com sucesso.",
      variant: "destructive",
    });
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de produtos por categoria
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? "Edite as informações do produto" : "Cadastre um novo produto no sistema"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Produto *</Label>
                  <Input id="nome" placeholder="Digite o nome do produto" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Produto Final">Produto Final</SelectItem>
                      <SelectItem value="Material Moído">Material Moído</SelectItem>
                      <SelectItem value="MCOLOR">MCOLOR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" placeholder="Descreva o produto" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preco">Preço (R$) *</Label>
                  <Input id="preco" type="number" step="0.01" placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoqueMinimo">Estoque Mínimo *</Label>
                  <Input id="estoqueMinimo" type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidade">Unidade *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UN">Unidade (UN)</SelectItem>
                      <SelectItem value="KG">Quilograma (KG)</SelectItem>
                      <SelectItem value="LT">Litro (LT)</SelectItem>
                      <SelectItem value="M">Metro (M)</SelectItem>
                      <SelectItem value="M2">Metro² (M²)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campos específicos para Material Moído */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Configurações de Material Moído
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pesoSaco">Peso por Saco (KG)</Label>
                    <Input id="pesoSaco" type="number" placeholder="25" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipoMaterial">Tipo de Material</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Premium Grade A">Premium Grade A</SelectItem>
                        <SelectItem value="Standard Grade B">Standard Grade B</SelectItem>
                        <SelectItem value="Economy Grade C">Economy Grade C</SelectItem>
                        <SelectItem value="Especial Fino">Especial Fino</SelectItem>
                        <SelectItem value="Especial Grosso">Especial Grosso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantidadeSacos">Quantidade de Sacos</Label>
                    <Input id="quantidadeSacos" type="number" placeholder="10" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  * Campos específicos para produtos da categoria "Material Moído"
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct}>
                {isEditing ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="Produto Final">Produto Final</SelectItem>
            <SelectItem value="Material Moído">Material Moído</SelectItem>
            <SelectItem value="MCOLOR">MCOLOR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de produtos */}
      <div className="grid gap-4">
        {filteredProdutos.map((produto) => (
          <Card key={produto.id} className={isLowStock(produto) ? "border-amber-200 bg-amber-50" : ""}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{produto.nome}</h3>
                    <Badge className={getCategoryColor(produto.categoria)}>
                      {produto.categoria}
                    </Badge>
                    {isLowStock(produto) && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Estoque Baixo
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="space-y-2">
                      <p>{produto.descricao}</p>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Código: {produto.id}
                      </div>
                      
                      {/* Informações específicas para Material Moído */}
                      {produto.categoria === "Material Moído" && produto.pesoSaco && (
                        <div className="space-y-1 p-3 bg-orange-50 rounded-lg border">
                          <div className="flex items-center gap-2 font-medium text-orange-800">
                            <Scale className="h-4 w-4" />
                            Informações do Material Moído
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>Peso por saco: <strong>{produto.pesoSaco} KG</strong></div>
                            <div>Quantidade: <strong>{produto.quantidadeSacos} sacos</strong></div>
                            <div className="col-span-2">Tipo: <strong>{produto.tipoMaterial}</strong></div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-lg font-bold text-primary">
                        R$ {produto.preco.toFixed(2).replace('.', ',')}
                        <span className="text-sm font-normal text-muted-foreground">/{produto.unidade}</span>
                      </div>
                      <div className={`text-sm ${isLowStock(produto) ? "text-amber-600 font-medium" : ""}`}>
                        Estoque: <span className="font-medium">{produto.estoqueAtual}</span> {produto.unidade}
                        <br />
                        Mínimo: {produto.estoqueMinimo} {produto.unidade}
                      </div>
                      {produto.categoria === "Material Moído" && produto.pesoSaco && (
                        <div className="text-sm text-orange-700">
                          Total em sacos: <strong>{Math.floor(produto.estoqueAtual / produto.pesoSaco)} sacos</strong>
                        </div>
                      )}
                      <div className="text-xs">
                        Cadastrado em: {produto.dataCadastro}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProduct(produto)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProduct(produto.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProdutos.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedCategory !== "all" 
                ? "Tente ajustar os filtros de busca" 
                : "Cadastre seu primeiro produto para começar"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
