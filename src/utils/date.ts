export const formatarDataISOParaBrasil = (dataISO?: string) => {
  if (!dataISO) return "-";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

export const addDaysISO = (baseISO: string, dias: number): string => {
  const base = new Date(baseISO + "T12:00:00");
  base.setDate(base.getDate() + dias);
  return base.toISOString().split("T")[0];
};

export const addMonthsISO = (baseISO: string, meses: number): string => {
  const base = new Date(baseISO + "T12:00:00");
  base.setMonth(base.getMonth() + meses);
  return base.toISOString().split("T")[0];
};
