import { addDaysISO, addMonthsISO } from "./date";

export interface ParcelaPedido {
  numero: number;
  valor: number;
  dataVencimento: string;
  statusPagamento: "Pago" | "Não Pago";
}

/**
 * Calcula a data de vencimento a partir de um prazo textual
 * Ex: "28 dias", "30 dias"
 */
export const calcularDataVencimentoPrazo = (
  dataBaseISO: string,
  prazoPagamento: string
): string => {
  const dias = parseInt(prazoPagamento.replace(/\D/g, ""), 10);
  return addDaysISO(dataBaseISO, dias);
};

/**
 * Gera parcelas mensais (opcional, uso futuro)
 */
export const gerarParcelasPedido = (
  total: number,
  numeroParcelas: number,
  dataBaseISO: string
): ParcelaPedido[] => {
  if (total <= 0 || numeroParcelas <= 1) return [];

  const valorParcela = Number((total / numeroParcelas).toFixed(2));
  const parcelas: ParcelaPedido[] = [];

  for (let i = 1; i <= numeroParcelas; i++) {
    parcelas.push({
      numero: i,
      valor: valorParcela,
      dataVencimento: addMonthsISO(dataBaseISO, i),
      statusPagamento: "Não Pago",
    });
  }

  return parcelas;
};

/**
 * Divide total em n parcelas (tentando manter cents corretos),
 * retorna array de { numero, valor, dataVencimento }.
 * intervaloDias padrão = 30.
 */
export function calcularParcelas(
  total: number,
  nParcelas: number,
  dataBaseISO: string, // 'YYYY-MM-DD'
  intervaloDias = 30
) {
  const parcelas = [];
  // valor em centavos pra evitar float issues
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / nParcelas);
  const remainder = totalCents - base * nParcelas; // centavos sobrando

  for (let i = 0; i < nParcelas; i++) {
    // distribui o resto nos primeiros N parcelas
    const valorCents = base + (i < remainder ? 1 : 0);
    const valor = valorCents / 100;

    // calcular data
    const d = new Date(dataBaseISO + "T12:00:00");
    d.setDate(d.getDate() + intervaloDias * (i + 1));
    const dataVencimento = d.toISOString().split("T")[0];

    parcelas.push({
      numero: i + 1,
      valor,
      dataVencimento,
      pago: false,
    });
  }

  return parcelas;
}
