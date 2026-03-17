export const roundCurrency = (value: number): number =>
  Number(value.toFixed(2));

export const formatarMoeda = (value: number): string =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
