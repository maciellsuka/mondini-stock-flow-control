import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  FileText,
  Package,
  Users,
  DollarSign,
  Download,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ProdutoComBags, Pedido, Cliente, Bag } from "@/models/firebaseModels";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// ===== MAPA DE MESES PT-BR =====
const meses = {
  Jan: 0,
  Fev: 1,
  Mar: 2,
  Abr: 3,
  Mai: 4,
  Jun: 5,
  Jul: 6,
  Ago: 7,
  Set: 8,
  Out: 9,
  Nov: 10,
  Dez: 11,
};

function parseMesLabel(label: string) {
  const clean = label.replace(".", "").replace("de", "").trim();
  const partes = clean.split(/[\s-]+/);
  const mesAbrev = partes[0].slice(0, 3).toLowerCase();
  const ano = Number(partes[1]);

  const key = Object.keys(meses).find((m) =>
    m.toLowerCase().startsWith(mesAbrev)
  ) as keyof typeof meses;

  return { mes: meses[key], ano };
}

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<ProdutoComBags[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [faturamentoPorMes, setFaturamentoPorMes] = useState<
    { mes: string; total: number }[]
  >([]);
  const [topBaixoEstoque, setTopBaixoEstoque] = useState<
    { nomeProd: string; totalKg: number }[]
  >([]);

  // ===== FILTROS =====
  const todayISO = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  })();

  const formatarMoedaBR = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [dataInicial, setDataInicial] = useState(sixMonthsAgo);
  const [dataFinal, setDataFinal] = useState(todayISO);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroProduto, setFiltroProduto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState("");

  // ================= FETCH =================
  useEffect(() => {
    const fetchData = async () => {
      const [clientesSnap, produtosSnap, pedidosSnap] = await Promise.all([
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "produtos")),
        getDocs(collection(db, "pedidos")),
      ]);

      // CLIENTES
      setClientes(
        clientesSnap.docs.map((d) => ({ ...(d.data() as Cliente), id: d.id }))
      );

      // PRODUTOS
      const produtosData: ProdutoComBags[] = [];

      for (const docSnap of produtosSnap.docs) {
        const data = docSnap.data();
        const bagsSnap = await getDocs(
          collection(db, `produtos/${docSnap.id}/bags`)
        );

        const bags: Bag[] = bagsSnap.docs.map((b) => ({
          id: b.id,
          produtoId: docSnap.id,
          pesoKg: b.data().pesoKg,
          status: b.data().status,
          criadoEm: b.data().criadoEm?.toDate() ?? new Date(),
          identificador: b.data().identificador ?? "",
        }));

        produtosData.push({
          id: docSnap.id,
          ...data,
          bags,
        } as ProdutoComBags);
      }

      setProdutos(produtosData);

      // PEDIDOS
      const pedidosData = pedidosSnap.docs.map(
        (d) => ({ ...(d.data() as Pedido), id: d.id } as Pedido)
      );

      setPedidos(pedidosData);

      // GRÁFICO INICIAL
      atualizarGrafico(pedidosData);

      // TOP 5
      const top = produtosData
        .map((p) => ({
          nomeProd: p.nomeProd,
          totalKg: p.bags
            .filter((b) => b.status === "disponivel")
            .reduce((s, b) => s + b.pesoKg, 0),
        }))
        .sort((a, b) => a.totalKg - b.totalKg)
        .slice(0, 5);

      setTopBaixoEstoque(top);
    };

    fetchData();
  }, []);

  // ================= FILTRO =================
  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      const pd = new Date(p.dataPedido + "T12:00:00");
      if (dataInicial && pd < new Date(dataInicial)) return false;
      if (dataFinal && pd > new Date(dataFinal + "T23:59:59")) return false;
      if (filtroCliente && p.clienteId !== filtroCliente) return false;
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (filtroFormaPagamento && p.formaPagamento !== filtroFormaPagamento)
        return false;
      if (filtroProduto) {
        const itens = (p as any).itens || p.produtos || [];
        return itens.some(
          (i: any) => i.produtoId === filtroProduto || i.id === filtroProduto
        );
      }
      return true;
    });
  }, [
    pedidos,
    dataInicial,
    dataFinal,
    filtroCliente,
    filtroProduto,
    filtroStatus,
    filtroFormaPagamento,
  ]);

  // ================= GRÁFICO =================
  const atualizarGrafico = (lista: Pedido[]) => {
    const map = new Map<string, number>();

    lista.forEach((p) => {
      const label = new Date(p.dataPedido).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      });

      map.set(label, (map.get(label) || 0) + (p.total || 0));
    });

    const arr = Array.from(map.entries()).map(([mes, total]) => ({
      mes,
      total,
    }));

    arr.sort((a, b) => {
      const A = parseMesLabel(a.mes);
      const B = parseMesLabel(b.mes);
      return A.ano !== B.ano ? A.ano - B.ano : A.mes - B.mes;
    });

    setFaturamentoPorMes(arr);
  };

  useEffect(() => atualizarGrafico(filteredPedidos), [filteredPedidos]);

  // ================= CARDS =================
  const faturamentoTotalPeriodo = filteredPedidos.reduce(
    (acc, p) => acc + (p.total || 0),
    0
  );

  // ================= EXPORT CSV (IDENTIFICADOR) =================
  const encontrarIdentificadorBag = (produtoId: string, bagId: string) => {
    const produto = produtos.find((p) => p.id === produtoId);
    const bag = produto?.bags.find((b) => b.id === bagId);
    return bag?.identificador || bagId;
  };

  const exportarCSV = () => {
    const base = filteredPedidos.length ? filteredPedidos : pedidos;
    const linhas: any[] = [];

    base.forEach((pedido) => {
      const itens = (pedido as any).itens || pedido.produtos || [];
      if (!itens.length) return;

      itens.forEach((item: any) => {
        const bags = item.bagsUsadas || item.bags || [];

        const pesoTotal = bags.reduce(
          (s: number, b: any) => s + (b.pesoUsado || b.pesoKg || 0),
          0
        );

        const lista = bags
          .map((b: any) => {
            const identificador = encontrarIdentificadorBag(
              item.produtoId || item.id,
              b.bagId
            );
            return `${identificador} (${b.pesoUsado || b.pesoKg}kg)`;
          })
          .join(" | ");

        linhas.push({
          numeroPedido: pedido.numeroPedido,
          cliente: pedido.clienteNome,
          dataPedido: pedido.dataPedido,
          produto: item.produtoNome || item.nomeProd,
          qtdBags: bags.length,
          pesoTotalKg: formatarMoedaBR(Number(pesoTotal.toFixed(2))),
          bags: lista,
          subtotal: formatarMoedaBR(item.subtotal) || 0,
          status: pedido.status,
          totalPedido: formatarMoedaBR(pedido.total),
        });
      });
    });

    if (!linhas.length) {
      alert("Nenhuma linha válida para exportar.");
      return;
    }

    const head = Object.keys(linhas[0]);
    const body = linhas
      .map((row) =>
        head
          .map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n");

    const csv = head.join(";") + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "pedidos.csv";
    link.click();
  };

  // ================= RENDER =================
  return (
    <div className="p-6 space-y-6">
      {/* FILTROS */}
      <div className="flex flex-wrap gap-3 items-end">
        {[
          ["Início", dataInicial, setDataInicial],
          ["Fim", dataFinal, setDataFinal],
        ].map(([label, value, setter]: any, i) => (
          <div key={i} className="w-full sm:w-[160px]">
            <Label>{label}</Label>
            <Input
              type="date"
              value={value}
              onChange={(e) => setter(e.target.value)}
            />
          </div>
        ))}

        {[
          ["Cliente", filtroCliente, setFiltroCliente, clientes, "nome"],
          ["Produto", filtroProduto, setFiltroProduto, produtos, "nomeProd"],
        ].map(([label, val, set, lista, campo]: any, i) => (
          <div key={i} className="w-full sm:w-[180px]">
            <Label>{label}</Label>
            <Select
              value={val || "all"}
              onValueChange={(v) => set(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {lista.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i[campo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {[
          [
            "Status",
            filtroStatus,
            setFiltroStatus,
            ["pendente", "processando", "concluido", "cancelado"],
          ],
          [
            "Pagamento",
            filtroFormaPagamento,
            setFiltroFormaPagamento,
            ["À vista", "A prazo"],
          ],
        ].map(([label, val, set, lista]: any, i) => (
          <div key={i} className="w-full sm:w-[160px]">
            <Label>{label}</Label>
            <Select
              value={val || "all"}
              onValueChange={(v) => set(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {lista.map((i: string) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDataInicial(sixMonthsAgo);
              setDataFinal(todayISO);
              setFiltroCliente("");
              setFiltroProduto("");
              setFiltroStatus("");
              setFiltroFormaPagamento("");
            }}
          >
            Limpar
          </Button>

          <Button variant="outline" onClick={exportarCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Clientes" value={clientes.length} icon={Users} />
        <StatCard title="Produtos" value={produtos.length} icon={Package} />
        <StatCard
          title="Pedidos"
          value={filteredPedidos.length}
          icon={FileText}
        />
        <StatCard
          title="Estoque baixo"
          value={topBaixoEstoque.length}
          icon={AlertTriangle}
        />
        <StatCard
          title="Faturamento"
          value={`R$ ${faturamentoTotalPeriodo.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          icon={DollarSign}
        />
      </div>

      {/* GRÁFICO */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={faturamentoPorMes} margin={{ top: 32 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `R$ ${v.toLocaleString("pt-BR")}`} />
              <Tooltip
                formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`}
              />
              <Bar dataKey="total" fill="#2563eb">
                <LabelList
                  position="top"
                  formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* TOP */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 - Estoque Baixo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topBaixoEstoque.map((i, idx) => (
              <div
                key={idx}
                className="flex justify-between border p-2 rounded"
              >
                <span>{i.nomeProd}</span>
                <span className="font-semibold text-red-500">
                  {i.totalKg.toFixed(2)} kg
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
