import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Pedido, ProdutoNoPedido } from "@/models/firebaseModels";

/**
 * Gera o HTML do pedido e abre em uma nova aba.
 * Suporta tanto o formato legado (pedido.itens) quanto o formato novo (pedido.produtos).
 * Inclui PARCELAMENTO quando existir pedido.parcelas
 */
export const generatePedidoPDF = async (pedido: Pedido) => {
  // =========================
  // 🔎 Buscar cliente
  // =========================
  const clienteRef = doc(db, "clientes", pedido.clienteId);
  const clienteSnap = await getDoc(clienteRef);
  const cliente = clienteSnap.exists() ? (clienteSnap.data() as any) : null;

  // =========================
  // 📅 Formatar data ISO → BR
  // =========================
  const formatarDataLocal = (dateString?: string) => {
    if (!dateString) return "-";
    const [ano, mes, dia] = dateString.split("-").map(Number);
    if (!ano || !mes || !dia) return "-";
    return `${dia.toString().padStart(2, "0")}/${mes
      .toString()
      .padStart(2, "0")}/${ano}`;
  };

  // =========================
  // 🔁 Normalizar itens (legado ou novo)
  // =========================
  type ItemPedidoForPdf = {
    id: string;
    produtoId: string;
    produtoNome: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    bagsUsadas: { bagId: string; pesoUsado: number }[];
  };

  let itensForPdf: ItemPedidoForPdf[] = [];
  const anyPedido = pedido as any;

  if (Array.isArray(anyPedido.itens) && anyPedido.itens.length > 0) {
    // legado
    itensForPdf = anyPedido.itens.map((it: any) => ({
      id: it.id,
      produtoId: it.produtoId,
      produtoNome: it.produtoNome,
      quantidade: it.quantidade,
      precoUnitario: it.precoUnitario,
      subtotal: it.subtotal,
      bagsUsadas: it.bagsUsadas || [],
    }));
  } else {
    // novo (produtos)
    const produtos: ProdutoNoPedido[] = Array.isArray(anyPedido.produtos)
      ? anyPedido.produtos
      : [];

    itensForPdf = produtos.map((prod) => {
      const quantidade = prod.bags.reduce((s, b) => s + (b.pesoKg || 0), 0);
      const subtotal = prod.bags.reduce((s, b) => s + (b.total || 0), 0);
      const bagsUsadas = prod.bags.map((b) => ({
        bagId: b.bagId,
        pesoUsado: b.pesoKg,
      }));

      return {
        id: `${prod.id}-${Date.now()}`,
        produtoId: prod.id,
        produtoNome: prod.nomeProd,
        quantidade,
        precoUnitario: prod.precoPorKg,
        subtotal,
        bagsUsadas,
      };
    });
  }

  // =========================
  // 🧊 Buscar identificadores das bags
  // =========================
  const identificadoresBags: Record<string, string> = {};

  for (const item of itensForPdf) {
    for (const bagUso of item.bagsUsadas) {
      if (!identificadoresBags[bagUso.bagId]) {
        try {
          const bagRef = doc(
            db,
            "produtos",
            item.produtoId,
            "bags",
            bagUso.bagId
          );
          // eslint-disable-next-line no-await-in-loop
          const bagSnap = await getDoc(bagRef);
          identificadoresBags[bagUso.bagId] = bagSnap.exists()
            ? (bagSnap.data() as any).identificador || bagUso.bagId
            : bagUso.bagId;
        } catch {
          identificadoresBags[bagUso.bagId] = bagUso.bagId;
        }
      }
    }
  }

  // =========================
  // 🧾 Montar via
  // =========================
  const montarVia = () => `
    <div class="via">
      <div class="header" style="text-align:center;margin-bottom:8px;">
        <img src="/assets/Logo-Mondini-DGbuvNVK.png" alt="Logo" style="max-width:150px;" />
      </div>

      <table>
        <tr>
          <th>Pedido nº</th>
          <td>${pedido.numeroPedido || "-"}</td>
          <th>Emissão</th>
          <td>${formatarDataLocal(pedido.dataPedido)}</td>
        </tr>
        <tr>
          <th>Cliente</th>
          <td colspan="3">${pedido.clienteNome}</td>
        </tr>

        ${
          cliente
            ? `
        <tr>
          <th>Endereço</th>
          <td>${cliente.endereco || "-"}</td>
          <th>Telefone</th>
          <td>${cliente.telefone || "-"}</td>
        </tr>
        <tr>
          <th>Bairro</th>
          <td>${cliente.bairro || "-"}</td>
          <th>Cidade</th>
          <td>${cliente.cidade || "-"} - ${cliente.estado || "-"}</td>
        </tr>
        <tr>
          <th>CNPJ</th>
          <td>${cliente.cnpj || "-"}</td>
          <th>IE</th>
          <td>${cliente.ie || "-"}</td>
        </tr>`
            : ""
        }

        ${
          pedido.formaPagamento === "A prazo" && pedido.prazoPagamento
            ? `
        <tr>
          <th rowSpan="2">Forma de Pagamento</th>
          <td rowSpan="2">${pedido.formaPagamento}</td>
          <th>Prazo</th>
          <td>${pedido.prazoPagamento}</td>
        </tr>
        <tr>
          <th>Vencimento</th>
          <td>${
            pedido.dataVencimento
              ? formatarDataLocal(pedido.dataVencimento)
              : "-"
          }</td>
        </tr>`
            : `
        <tr>
          <th>Forma de Pagamento</th>
          <td colspan="3">${pedido.formaPagamento || "-"}</td>
        </tr>`
        }
      </table>

      <table>
        <thead>
          <tr>
            <th>Qtd. (kg)</th>
            <th>Produto</th>
            <th>Valor Unit.</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${itensForPdf
            .map((item) => {
              const itemHtml = `
                <tr>
                  <td>${item.quantidade.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</td>
                  <td>${item.produtoNome}</td>
                  <td>R$ ${item.precoUnitario.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</td>
                  <td>R$ ${item.subtotal.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</td>
                </tr>
              `;
              const bagsHtml = item.bagsUsadas
                .map(
                  (bag) => `
                <tr style="font-size:12px;color:#555;">
                  <td colspan="4" style="padding-left:20px;">
                    ↳ Bag <strong>${
                      identificadoresBags[bag.bagId] || bag.bagId
                    }</strong> — ${bag.pesoUsado.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} kg
                  </td>
                </tr>
              `
                )
                .join("");
              return itemHtml + bagsHtml;
            })
            .join("")}

          <tr class="total">
            <td colspan="3">TOTAL GERAL</td>
            <td>R$ ${Number(pedido.total || 0).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</td>
          </tr>
        </tbody>
      </table>

      ${
        Array.isArray((pedido as any).parcelas) &&
        (pedido as any).parcelas.length > 0
          ? `
      <h4 style="margin-top:18px;">Parcelamento</h4>
      <table>
        <thead>
          <tr>
            <th>Parcela</th>
            <th>Vencimento</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${(pedido as any).parcelas
            .map(
              (p: any) => `
            <tr>
              <td>${p.numero}</td>
              <td>${formatarDataLocal(p.dataVencimento)}</td>
              <td>R$ ${Number(p.valor).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</td>
              <td>${p.pago ? "Pago" : "Não Pago"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      `
          : ""
      }

      ${
        pedido.observacoes
          ? `<div style="margin-top:12px;"><strong>Observações:</strong> ${pedido.observacoes}</div>`
          : ""
      }
    </div>
  `;

  // =========================
  // 🖨 HTML final (2 vias)
  // =========================
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Pedido #${pedido.numeroPedido || pedido.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; font-size:13px; color:#333; }
          table { width:100%; border-collapse:collapse; margin:6px 0 14px; }
          th, td { border:1px solid #ccc; padding:6px 8px; font-size:13px; }
          th { background:#e0e0e0; font-weight:bold; text-align:left; }
          .total { font-weight:bold; background:#f1f1f1; }
          .via { page-break-inside: avoid; margin-bottom:30px; }
          .corte { border-top:2px dashed #999; margin:28px 0; }
          .header img { max-width:150px; }
        </style>
      </head>
      <body>
        ${montarVia()}
        <div class="corte"></div>
        ${montarVia()}
        <div style="font-size:11px;text-align:center;color:#666;margin-top:22px;border-top:1px solid #ccc;padding-top:8px;">
          Documento gerado em ${new Date().toLocaleDateString(
            "pt-BR"
          )} às ${new Date().toLocaleTimeString("pt-BR")}<br/>
          Avenida Coronel Antonio Estanislau do Amaral, 544 - B. Itaici<br/>
          CNPJ: 39.694.722/0001-29 — IE: 353.439.082.115 — TELEFONE (19) 97403-9792
        </div>
      </body>
    </html>
  `;

  const newTab = window.open("", "_blank");
  if (!newTab) {
    alert("Por favor, permita pop-ups para visualizar o PDF");
    return;
  }
  newTab.document.write(html);
  newTab.document.close();
};
