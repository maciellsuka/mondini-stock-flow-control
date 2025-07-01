
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, FileText, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";

export default function Dashboard() {
  // Dados mockados para demonstração
  const stats = [
    {
      title: "Total de Clientes",
      value: "1,234",
      description: "Clientes ativos",
      icon: Users,
      trend: { value: 12, isPositive: true }
    },
    {
      title: "Produtos em Estoque",
      value: "8,567",
      description: "Itens disponíveis",
      icon: Package,
      trend: { value: -3, isPositive: false }
    },
    {
      title: "Pedidos do Mês",
      value: "456",
      description: "Novos pedidos",
      icon: FileText,
      trend: { value: 18, isPositive: true }
    },
    {
      title: "Estoque Baixo",
      value: "23",
      description: "Produtos com estoque baixo",
      icon: AlertTriangle,
    },
    {
      title: "Faturamento Mensal",
      value: "R$ 145.780",
      description: "Receita do mês atual",
      icon: DollarSign,
      trend: { value: 25, isPositive: true }
    },
    {
      title: "Serviços Prestados",
      value: "89",
      description: "Serviços do mês",
      icon: TrendingUp,
      trend: { value: 8, isPositive: true }
    }
  ];

  const recentOrders = [
    { id: "PED-001", client: "Empresa ABC Ltda", value: "R$ 2.450,00", status: "Pendente", date: "2024-01-07" },
    { id: "PED-002", client: "Indústria XYZ S/A", value: "R$ 1.280,00", status: "Processando", date: "2024-01-07" },
    { id: "PED-003", client: "Comercial 123", value: "R$ 3.670,00", status: "Concluído", date: "2024-01-06" },
    { id: "PED-004", client: "Distribuidora DEF", value: "R$ 890,00", status: "Concluído", date: "2024-01-06" },
  ];

  const lowStockProducts = [
    { name: "Material Moído Tipo A", current: 15, minimum: 50, category: "Material Moído" },
    { name: "MCOLOR Verde", current: 8, minimum: 20, category: "MCOLOR" },
    { name: "Produto Final XYZ", current: 32, minimum: 100, category: "Produto Final" },
    { name: "Material Moído Tipo B", current: 12, minimum: 40, category: "Material Moído" },
  ];

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema MONDINI
          </p>
        </div>
      </div>

      {/* Estatísticas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pedidos Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{order.id}</p>
                    <p className="text-sm text-muted-foreground">{order.client}</p>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium">{order.value}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === "Concluído" 
                        ? "bg-green-100 text-green-800" 
                        : order.status === "Processando"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Produtos com Estoque Baixo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockProducts.map((product, index) => (
                <div key={index} className="space-y-2 p-3 border rounded-lg bg-amber-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                      {product.current} / {product.minimum}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-600 h-2 rounded-full" 
                      style={{ width: `${(product.current / product.minimum) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
