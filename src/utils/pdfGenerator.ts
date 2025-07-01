
interface ItemPedido {
  id: number;
  produtoId: number;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

interface Pedido {
  id: number;
  clienteId: number;
  clienteNome: string;
  dataPedido: string;
  dataEntrega?: string;
  status: "pendente" | "processando" | "concluido" | "cancelado";
  itens: ItemPedido[];
  total: number;
  observacoes?: string;
}

export const generatePedidoPDF = (pedido: Pedido) => {
  // Criar um novo documento HTML para impressão
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Por favor, permita pop-ups para gerar o PDF');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido #${pedido.id} - MONDINI</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .company-name {
          font-size: 28px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 5px;
        }
        .company-subtitle {
          font-size: 14px;
          color: #666;
        }
        .pedido-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
        }
        .info-section {
          flex: 1;
        }
        .info-title {
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 5px;
        }
        .status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .status-pendente { background-color: #fef3c7; color: #92400e; }
        .status-processando { background-color: #dbeafe; color: #1e40af; }
        .status-concluido { background-color: #d1fae5; color: #065f46; }
        .status-cancelado { background-color: #fee2e2; color: #991b1b; }
        .itens-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          border: 1px solid #e5e7eb;
        }
        .itens-table th,
        .itens-table td {
          border: 1px solid #e5e7eb;
          padding: 12px;
          text-align: left;
        }
        .itens-table th {
          background-color: #f9fafb;
          font-weight: bold;
          color: #374151;
        }
        .text-right {
          text-align: right;
        }
        .total-row {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        .observacoes {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-left: 4px solid #2563eb;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">MONDINI</div>
        <div class="company-subtitle">Sistema de Controle de Estoque</div>
      </div>

      <div class="pedido-info">
        <div class="info-section">
          <div class="info-title">Pedido</div>
          <div>#${pedido.id}</div>
        </div>
        <div class="info-section">
          <div class="info-title">Cliente</div>
          <div>${pedido.clienteNome}</div>
        </div>
        <div class="info-section">
          <div class="info-title">Data do Pedido</div>
          <div>${new Date(pedido.dataPedido).toLocaleDateString('pt-BR')}</div>
        </div>
        ${pedido.dataEntrega ? `
        <div class="info-section">
          <div class="info-title">Data de Entrega</div>
          <div>${new Date(pedido.dataEntrega).toLocaleDateString('pt-BR')}</div>
        </div>
        ` : ''}
        <div class="info-section">
          <div class="info-title">Status</div>
          <div class="status status-${pedido.status}">
            ${getStatusLabel(pedido.status)}
          </div>
        </div>
      </div>

      <table class="itens-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Preço Unitário</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${pedido.itens.map(item => `
            <tr>
              <td>${item.produtoNome}</td>
              <td class="text-right">${item.quantidade}</td>
              <td class="text-right">R$ ${item.precoUnitario.toFixed(2)}</td>
              <td class="text-right">R$ ${item.subtotal.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3">TOTAL GERAL</td>
            <td class="text-right">R$ ${pedido.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      ${pedido.observacoes ? `
      <div class="observacoes">
        <div class="info-title">Observações</div>
        <div>${pedido.observacoes}</div>
      </div>
      ` : ''}

      <div class="footer">
        <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p>MONDINI - Sistema de Controle de Estoque</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Aguardar o carregamento e então imprimir
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 100);
  };
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pendente": return "Pendente";
    case "processando": return "Processando";
    case "concluido": return "Concluído";
    case "cancelado": return "Cancelado";
    default: return status;
  }
};
