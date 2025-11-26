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
import {
  ProdutoComBags,
  Pedido,
  Cliente,
  Bag,
  ProdutoNoPedido,
} from "@/models/firebaseModels";
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

const mesesPt = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

// Função para parse do mês
const parseMes = (mesLabel: string) => {
  const [mesAbrev, ano] = mesLabel.replace(".", "").split(" ");
  const index = mesesPt.indexOf(mesAbrev.toLowerCase());
  return { index, ano: Number(ano) };
};

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

  // --- filtros ---
  const todayISO = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  })();

  const [dataInicial, setDataInicial] = useState<string>(sixMonthsAgo);
  const [dataFinal, setDataFinal] = useState<string>(todayISO);
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [filtroProduto, setFiltroProduto] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string>("");

  // ============================
  // fetch inicial
  // ============================
  useEffect(() => {
    const fetchData = async () => {
      const [clientesSnap, produtosSnap, pedidosSnap] = await Promise.all([
        getDocs(collection(db, "clientes")),
        getDocs(collection(db, "produtos")),
        getDocs(collection(db, "pedidos")),
      ]);

      // clientes
      const clientesData: Cliente[] = clientesSnap.docs.map((doc) => ({
        ...(doc.data() as Cliente),
        id: doc.id,
      }));
      setClientes(clientesData);

      // produtos + bags
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
          nomeProd: data.nomeProd,
          precoPorKg: data.precoPorKg,
          tipo: data.tipo,
          bags,
        });
      }
      setProdutos(produtosData);

      // pedidos
      const pedidosData: Pedido[] = pedidosSnap.docs.map((doc) => ({
        ...(doc.data() as Pedido),
        id: doc.id,
      }));
      setPedidos(pedidosData);

      // faturamento inicial (todos os pedidos) - ordenado por mês real
      const mesesMap = new Map<string, number>();
      pedidosData.forEach((p) => {
        const mes = new Date(p.dataPedido).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        mesesMap.set(
          mes,
          (mesesMap.get(mes) || 0) + (typeof p.total === "number" ? p.total : 0)
        );
      });
      const fatur = Array.from(mesesMap.entries()).map(([mes, total]) => ({
        mes,
        total,
      }));
      // Ordenação usando parseMes
      fatur.sort((a, b) => {
        const A = parseMes(a.mes);
        const B = parseMes(b.mes);
        if (A.ano !== B.ano) return A.ano - B.ano;
        return A.index - B.index;
      });
      setFaturamentoPorMes(fatur);

      // top 5 estoque baixo
      const top5 = produtosData
        .map((p) => ({
          nomeProd: p.nomeProd,
          totalKg: p.bags
            .filter((b) => b.status === "disponivel")
            .reduce((s, b) => s + b.pesoKg, 0),
        }))
        .sort((a, b) => a.totalKg - b.totalKg)
        .slice(0, 5);
      setTopBaixoEstoque(top5);
    };

    fetchData();
  }, []);

  // ============================
  // dados filtrados (pedidos) — MEMO
  // ============================
  const filteredPedidos = useMemo(() => {
    const start = dataInicial ? new Date(dataInicial + "T00:00:00") : null;
    const end = dataFinal ? new Date(dataFinal + "T23:59:59") : null;

    return pedidos.filter((p) => {
      // dataPedido é string yyyy-mm-dd
      const pd = p.dataPedido ? new Date(p.dataPedido + "T12:00:00") : null;
      if (start && (!pd || pd < start)) return false;
      if (end && (!pd || pd > end)) return false;

      if (filtroCliente && filtroCliente !== "") {
        if (p.clienteId !== filtroCliente) return false;
      }

      if (filtroStatus && filtroStatus !== "") {
        if (p.status !== filtroStatus) return false;
      }

      if (filtroFormaPagamento && filtroFormaPagamento !== "") {
        if ((p.formaPagamento || "") !== filtroFormaPagamento) return false;
      }

      if (filtroProduto && filtroProduto !== "") {
        const itens = Array.isArray(p.produtos) ? p.produtos : [];
        const hasProduto = itens.some((it) => it.id === filtroProduto);
        if (!hasProduto) return false;
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

  // ============================
  // cards (derivados do filteredPedidos)
  // ============================
  const totalClientes = clientes.length;
  const produtosEmEstoque = produtos.length;
  const pedidosDoPeriodo = filteredPedidos.length;
  const faturamentoTotalPeriodo = filteredPedidos.reduce(
    (acc, p) => acc + (typeof p.total === "number" ? p.total : 0),
    0
  );

  // ============================
  // atualizar gráfico quando filteredPedidos muda
  // ============================
  useEffect(() => {
    const mesesMap = new Map<string, number>();
    for (const pedido of filteredPedidos) {
      const mes = new Date(pedido.dataPedido).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      });
      mesesMap.set(
        mes,
        (mesesMap.get(mes) || 0) +
          (typeof pedido.total === "number" ? pedido.total : 0)
      );
    }

    const arr = Array.from(mesesMap.entries()).map(([mes, total]) => ({
      mes,
      total,
    }));
    // Ordenação usando parseMes
    arr.sort((a, b) => {
      const A = parseMes(a.mes);
      const B = parseMes(b.mes);
      if (A.ano !== B.ano) return A.ano - B.ano;
      return A.index - B.index;
    });

    setFaturamentoPorMes(arr);
  }, [filteredPedidos]);

  // ============================
  // EXPORT CSV (TIPADO) — ordenado por dataPedido DESC
  // ============================
  const exportarCSV = () => {
    if (!pedidos || pedidos.length === 0) {
      console.error("Sem pedidos para exportar");
      return;
    }

    // ordenar por dataPedido (mais novos primeiro)
    const pedidosOrdenados = [...pedidos].sort((a, b) => {
      const da = new Date(a.dataPedido).getTime();
      const db = new Date(b.dataPedido).getTime();
      return db - da;
    });

    const linhas = pedidosOrdenados.flatMap((pedido) => {
      const produtosNoPedido: ProdutoNoPedido[] = Array.isArray(pedido.produtos)
        ? pedido.produtos
        : [];

      return produtosNoPedido.map((prod) => {
        const qtdBags = prod.bags?.length ?? 0;
        const pesoTotalKg =
          prod.bags?.reduce((s, b) => s + (b.pesoKg ?? 0), 0) ?? 0;
        const listaBags = (prod.bags ?? [])
          .map((b) => {
            // achar identificador na coleção de produtos (produtos state)
            const produtoLocal = produtos.find((p) => p.id === prod.id);
            const bagInfo = produtoLocal?.bags.find((bx) => bx.id === b.bagId);
            const identificador = bagInfo?.identificador ?? b.bagId;
            return `${identificador} (${b.pesoKg}kg)`;
          })
          .join(" | ");

        // subtotal do produto = soma dos campos total das bags (modelo firebaseModels usa b.total)
        const subtotalNumber = (prod.bags ?? []).reduce(
          (s, b) => s + (b.total ?? 0),
          0
        );

        return {
          NumeroPedido: pedido.numeroPedido ?? "",
          Cliente: pedido.clienteNome ?? "",
          DataPedido: pedido.dataPedido ?? "",
          Produto: prod.nomeProd ?? "",
          qtdBags,
          pesoTotalKg: Number(pesoTotalKg.toFixed(3)), // 3 casas para evitar perda em kg
          bags: listaBags,
          FormaPagamento: pedido.formaPagamento ?? "",
          StatusPagamento: pedido.statusPagamento ?? "",
          Status: pedido.status ?? "",
          Observacoes: pedido.observacoes ?? "",
          DataVencimento: pedido.dataVencimento ?? "",
          TotalPedido: Number(subtotalNumber.toFixed(2)),
        };
      });
    });

    if (linhas.length === 0) {
      console.error("Nenhum item encontrado nos pedidos");
      return;
    }

    // construir CSV (ponto decimal com vírgula para pt-BR se preferir; aqui uso padrão numérico com .)
    const cabecalho = Object.keys(linhas[0]);
    const corpo = linhas
      .map((row) =>
        cabecalho
          .map((key) => {
            const val = row[key as keyof typeof row];
            // escapar " dentro do CSV
            if (val === null || val === undefined) return '""';
            if (typeof val === "number") return `"${val.toString()}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(";")
      )
      .join("\n");

    const csvContent = cabecalho.join(";") + "\n" + corpo;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pedidos.csv";
    link.click();
  };

  // ============================
  // RENDER
  // ============================
  return (
    <div className="p-6 space-y-6">
      {/* HEADER + FILTROS */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema MONDINI
          </p>
        </div>

        {/* Filtros: reorganizado para responsividade */}
        <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:gap-4">
          {/* período */}
          <div className="flex flex-col w-full max-w-[220px]">
            <Label>Período - Início</Label>
            <Input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col w-full max-w-[220px]">
            <Label>Período - Fim</Label>
            <Input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full"
            />
          </div>

          {/* cliente */}
          <div className="flex flex-col w-full max-w-[220px]">
            <Label>Cliente</Label>
            <Select
              value={filtroCliente || "all"}
              onValueChange={(v) => setFiltroCliente(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* produto */}
          <div className="flex flex-col w-full max-w-[220px]">
            <Label>Produto</Label>
            <Select
              value={filtroProduto || "all"}
              onValueChange={(v) => setFiltroProduto(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="Todos os produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nomeProd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* status */}
          <div className="flex flex-col w-full max-w-[220px]">
            <Label>Status</Label>
            <Select
              value={filtroStatus || "all"}
              onValueChange={(v) => setFiltroStatus(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="processando">Processando</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* forma de pagamento */}
          <div className="flex flex-col w-full max-w-[220px]">
            <Label>Forma de pagamento</Label>
            <Select
              value={filtroFormaPagamento || "all"}
              onValueChange={(v) =>
                setFiltroFormaPagamento(v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="À vista">À vista</SelectItem>
                <SelectItem value="A prazo">A prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* buttons */}
          <div className="flex items-center gap-2 w-full max-w-[220px]">
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
              className="w-full"
            >
              Limpar
            </Button>

            <Button variant="outline" onClick={exportarCSV} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Exportar Pedidos
            </Button>
          </div>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total de Clientes"
          value={String(totalClientes)}
          icon={Users}
        />
        <StatCard
          title="Produtos em Estoque"
          value={String(produtosEmEstoque)}
          icon={Package}
        />
        <StatCard
          title="Pedidos (filtrados)"
          value={String(pedidosDoPeriodo)}
          icon={FileText}
        />
        <StatCard
          title="Estoque Baixo"
          value={String(topBaixoEstoque.length)}
          icon={AlertTriangle}
        />
        <StatCard
          title="Faturamento (filtrado)"
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
            <BarChart data={faturamentoPorMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => `R$ ${v.toLocaleString("pt-BR")}`} />
              <Tooltip
                formatter={(v: number) =>
                  `R$ ${v.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}`
                }
              />
              <Bar dataKey="total" fill="#2563eb" name="Faturamento">
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={10}
                  formatter={(v: number) =>
                    `R$ ${Number(v).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* TOP 5 ESTOQUE BAIXO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Top 5 Produtos com Menor Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topBaixoEstoque.map((item, i) => (
              <div
                key={i}
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
