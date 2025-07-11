import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileText, Package, Users, DollarSign, Download } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ProdutoComBags, Pedido, Cliente, Bag } from "@/models/firebaseModels";
import { Button } from "@/components/ui/button";
import Papa from "papaparse";

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [faturamentoPorMes, setFaturamentoPorMes] = useState<{ mes: string; total: number }[]>([]);
  const [topBaixoEstoque, setTopBaixoEstoque] = useState<{ nomeProd: string; totalKg: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [clientesSnap, produtosSnap, pedidosSnap] = await Promise.all([
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "produtos")),
        getDocs(collection(db, "pedidos")),
      ]);

      const clientesData: Cliente[] = clientesSnap.docs.map((doc) => ({
        ...(doc.data() as Cliente),
        id: doc.id,
      }));
      setClientes(clientesData);

      const produtosData: ProdutoComBags[] = [];
      for (const docSnap of produtosSnap.docs) {
        const data = docSnap.data();
        const bagsSnap = await getDocs(collection(db, `produtos/${docSnap.id}/bags`));
        const bags: Bag[] = bagsSnap.docs.map((b) => ({
          id: b.id,
          produtoId: docSnap.id,
          pesoKg: b.data().pesoKg,
          status: b.data().status,
          criadoEm: b.data().criadoEm?.toDate() ?? new Date(),
        }));

        produtosData.push({
          id: docSnap.id,
          nomeProd: data.nomeProd,
          precoPorKg: data.precoPorKg,
          tipo: data.tipo,
          bags,
        });
      }
      setProdutos(produtosData);

      const pedidosData: Pedido[] = pedidosSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate() : new Date(),
        } as Pedido;
      });
      setPedidos(pedidosData);

      // Faturamento por mês
      const mesesMap = new Map<string, number>();
      for (const pedido of pedidosData) {
        const mes = pedido.criadoEm.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
        mesesMap.set(mes, (mesesMap.get(mes) || 0) + pedido.total);
      }
      const faturamento = Array.from(mesesMap.entries()).map(([mes, total]) => ({ mes, total }));
      faturamento.sort((a, b) => new Date(`1 ${a.mes}`) > new Date(`1 ${b.mes}`) ? 1 : -1);
      setFaturamentoPorMes(faturamento);

      // Top 5 com menor estoque
      const produtosOrdenados = produtosData
        .map((p) => ({
          nomeProd: p.nomeProd,
          totalKg: p.bags.filter((b) => b.status === "disponivel").reduce((acc, b) => acc + b.pesoKg, 0),
        }))
        .sort((a, b) => a.totalKg - b.totalKg)
        .slice(0, 5);
      setTopBaixoEstoque(produtosOrdenados);
    };

    fetchData();
  }, []);

  const exportarCSV = () => {
    const data = pedidos.map((p) => ({
      ID: p.id,
      Cliente: p.clienteNome,
      "Data Pedido": p.criadoEm.toLocaleDateString("pt-BR"),
      Total: p.total.toFixed(2),
      Status: p.status,
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "pedidos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema MONDINI</p>
        </div>
        <Button variant="outline" onClick={exportarCSV}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Pedidos
        </Button>
      </div>

      {/* Cards de estatísticas: tudo em uma linha */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total de Clientes" value={clientes.length.toString()} icon={Users} />
        <StatCard title="Produtos em Estoque" value={produtos.length.toString()} icon={Package} />
        <StatCard title="Pedidos do Mês" value={pedidos.length.toString()} icon={FileText} />
        <StatCard title="Estoque Baixo" value={topBaixoEstoque.length.toString()} icon={AlertTriangle} />
        <StatCard
          title="Faturamento Total"
          value={`R$ ${pedidos.reduce((acc, p) => acc + p.total, 0).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          icon={DollarSign}
        />
      </div>

      {/* Gráfico de faturamento mensal com altura ajustada */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={faturamentoPorMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip
                formatter={(value: number) =>
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                }
              />
              <Bar dataKey="total" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 5 Produtos com Menor Estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Top 5 Produtos com Menor Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topBaixoEstoque.map((item, index) => (
              <div
                key={index}
                className="p-3 border rounded-md bg-amber-50 flex justify-between items-center"
              >
                <p className="font-medium">{item.nomeProd}</p>
                <span className="text-sm font-semibold text-red-600">
                  {item.totalKg.toFixed(2)} kg
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
