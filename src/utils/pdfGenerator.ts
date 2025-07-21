import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface ItemPedido {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  bagsUsadas: { bagId: string; pesoUsado: number }[];
}

interface Pedido {
  id: string;
  clienteId: string;
  clienteNome: string;
  dataPedido: string;
  dataEntrega?: string;
  status: string;
  itens: ItemPedido[];
  total: number;
  observacoes?: string;
  numeroPedido?: string;
}

export const generatePedidoPDF = async (pedido: Pedido) => {
  const clienteRef = doc(db, "clientes", pedido.clienteId);
  const clienteSnap = await getDoc(clienteRef);
  const cliente = clienteSnap.exists() ? clienteSnap.data() : null;

  const identificadoresBags: Record<string, string> = {};

  for (const item of pedido.itens) {
    for (const bagUso of item.bagsUsadas) {
      if (!identificadoresBags[bagUso.bagId]) {
        try {
          const bagRef = doc(db, "produtos", item.produtoId, "bags", bagUso.bagId);
          const bagSnap = await getDoc(bagRef);
          if (bagSnap.exists()) {
            const bagData = bagSnap.data();
            identificadoresBags[bagUso.bagId] = bagData.identificador || bagUso.bagId;
          } else {
            identificadoresBags[bagUso.bagId] = bagUso.bagId;
          }
        } catch {
          identificadoresBags[bagUso.bagId] = bagUso.bagId;
        }
      }
    }
  }

  // Função para montar o conteúdo HTML da via
  const montarVia = (tituloVia: string) => `
    <div class="via">
      <h2>${tituloVia}</h2>

      <div class="header">
        <img src="/assets/Logo-Mondini-DGbuvNVK.png" alt="Logo Mondini" />
      </div>

      <table>
        <tr>
          <th>Pedido nro.</th>
          <td>${pedido.numeroPedido}</td>
          <th>Emissão</th>
          <td>${new Date(pedido.dataPedido).toLocaleDateString("pt-BR")}</td>
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
            <td>${cliente.endereco}</td>
            <th>Telefone</th>
            <td>${cliente.telefone}</td>
          </tr>
          <tr>
            <th>Bairro</th>
            <td>${cliente.bairro}</td>
            <th>Cidade</th>
            <td>${cliente.cidade} - ${cliente.estado}</td>
          </tr>
          <tr>
            <th>CNPJ</th>
            <td colspan="3">${cliente.cnpj}</td>
          </tr>`
            : ""
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
          ${pedido.itens
            .map((item) => {
              const itemHtml = `
                <tr>
                  <td>${item.quantidade.toFixed(2)}</td>
                  <td>${item.produtoNome}</td>
                  <td>R$ ${item.precoUnitario.toFixed(2)}</td>
                  <td>R$ ${item.subtotal.toFixed(2)}</td>
                </tr>
              `;

              const bagsHtml = item.bagsUsadas
                .map(
                  (bag) => `
                  <tr style="font-size: 12px; color: #555;">
                    <td colspan="4" style="padding-left: 24px;">
                      ↳ Bag <strong>${identificadoresBags[bag.bagId]}</strong> — ${bag.pesoUsado.toFixed(2)} kg
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
            <td>R$ ${pedido.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      ${
        pedido.observacoes
          ? `<div><strong>Observações:</strong> ${pedido.observacoes}</div>`
          : ""
      }
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Pedido #${pedido.id} - Duas Vias</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        h2 {
          text-align: center;
          margin-bottom: 12px;
          text-transform: uppercase;
          color: #222;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
        }
        .header img {
          max-width: 180px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 6px 10px;
          font-size: 13px;
        }
        th {
          background-color: #f1f1f1;
          text-align: left;
        }
        .total {
          font-weight: bold;
          background-color: #f1f1f1;
        }
        .footer {
          font-size: 11px;
          text-align: center;
          color: #666;
          margin-top: 32px;
          border-top: 1px solid #ccc;
          padding-top: 8px;
        }

        /* Cada via terá uma margem para separar visualmente */
        .via {
          page-break-inside: avoid;
          margin-bottom: 40px;
        }

        /* Linha pontilhada para corte entre vias */
        .corte {
          border-top: 2px dashed #999;
          margin: 40px 0;
        }
      </style>
    </head>
    <body>
      ${montarVia("Via do Usuário (Vendedor)")}
      
      <div class="corte"></div>
      
      ${montarVia("Via do Cliente")}

      <div class="footer">
        Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}<br />
        Avenida Coronel Antonio Estanislau do Amaral, 544 - B. Itaici<br />
        CNPJ: 39.694.722/0001-29 - IE: 353.439.082.115 - TELEFONE (19) 97403-9792
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para gerar o PDF");
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 200);
  };
};
