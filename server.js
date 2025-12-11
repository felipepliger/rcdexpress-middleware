const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs');
const carbone = require('carbone');
const puppeteer = require("puppeteer");
const puppeteerCore = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();
app.use(cors({
  exposedHeaders: ["Content-Disposition"]
}));


const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function buscarNotas({ cnpjclie, serienf, numnota, chaveNFe, dataInicio, dataFim, tipoCte }) {

  let url = 'https://rcdexpress.ddns.com.br:8443/ADTWebService/conhecimento/listarNota?';
  const params = new URLSearchParams();
  params.append("cnpjclie", cnpjclie);

  if (tipoCte) {
    if (Array.isArray(tipoCte)) {
      tipoCte.forEach(t => params.append("tipocte", t));
    } else {
      // se for string e já com vírgulas
      tipoCte.split(",").forEach(t => params.append("tipocte", t.trim()));
    }
  }

  if (serienf && chaveNFe) {
    params.append("serienf", serienf);
    params.append("chaveNFe", chaveNFe);
  } else if (dataInicio && dataFim) {
    params.append("dataInicio", dataInicio);
    params.append("dataFim", dataFim);
  } else if (numnota) {
    params.append("numnota", numnota);
  } else {
    throw new Error("Parâmetros insuficientes");
  }

  const resposta = await axios.get(url, {
    params,
    httpsAgent,
  });

  if (resposta.data.data && resposta.data.data.length > 0) {
    const dataOrdenada = resposta.data.data.sort(
      (a, b) => new Date(b.emissao) - new Date(a.emissao)
    );
    return {
      ...resposta.data,
      data: dataOrdenada
    };
  } else {
    return resposta.data;
  }
}


app.get('/listarNota', async (req, res) => {
  try {
    const dados = await buscarNotas(req.query);
    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: 'Falha ao buscar nota',
      detalhe: err.message
    });
  }
});

app.get('/relatorioExcel', async (req, res) => {
  try {
    const resposta = await buscarNotas(req.query);
    const data = resposta.data;
    
    const templatePath = './templates/template.xlsx';

    carbone.render(templatePath, data, (err, result) => {
      if (err) {
        console.error("Erro ao gerar XLSX:", err);
        return res.status(500).json({ erro: 'Falha ao gerar relatório' });
      }

      // data e hora atual formatada
      const agora = new Date();
      const yyyy = agora.getFullYear();
      const mm = String(agora.getMonth() + 1).padStart(2, '0');
      const dd = String(agora.getDate()).padStart(2, '0');
      const hh = String(agora.getHours()).padStart(2, '0');
      const mi = String(agora.getMinutes()).padStart(2, '0');
      const ss = String(agora.getSeconds()).padStart(2, '0');

      const timestamp = `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;

      const fileName = `rcdexpress-excel-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

      res.send(result);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: 'Falha ao gerar relatório',
      detalhe: err.message
    });
  }
});

app.get("/relatorioPdf", async (req, res) => {
  try {
    const resposta = await buscarNotas(req.query);
    const data = resposta.data;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { 
              font-family: Arial, sans-serif; 
              font-size: 10px; 
            }

            h2 {
              margin-bottom: 10px;
            }

            table { 
              width: 100%; 
              border-collapse: collapse; 
            }

            th, td { 
              border: 1px solid #ccc; 
              padding: 5px; 
              text-align: left;
            }

            th { 
              background: #f3f3f3; 
              font-weight: bold; 
            }

            /* quebra automática de páginas */
            tr { page-break-inside: avoid; }

            /* ajustar colunas largas */
            td:nth-child(4) {
              word-break: break-all;
              font-size: 9px;
            }

            /* cabeçalho fixo em todas as páginas */
            thead { 
              display: table-header-group; 
            }
          </style>
        </head>
        <body>
          <h2>Relatório de Notas</h2>

          <table>
            <thead>
              <tr>
                <th>Código Filial</th>
                <th>Tipo Lcto</th>
                <th>Número Nota</th>
                <th>Chave NFe</th>
                <th>Série</th>
                <th>Data Ocorrência</th>
                <th>Nome Destinatário</th>
                <th>Descrição Ocorrência</th>
              </tr>
            </thead>

            <tbody>
              ${data.map((n) => `
                <tr>
                  <td>${n.codFilial || ""}</td>
                  <td>${n.tipoLcto || ""}</td>
                  <td>${n.numNota || ""}</td>
                  <td>${n.chaveNFe || ""}</td>
                  <td>${n.serie || ""}</td>
                  <td>${n.dataOcorrencia ? new Date(n.dataOcorrencia).toLocaleDateString("pt-BR") : ""}</td>
                  <td>${n.nomeDestinatario || ""}</td>
                  <td>${n.descrOcorrencia || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;


    const browser = await getBrowser();

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({ format: "A4", printBackground: true });

    await browser.close();

    // data e hora atual formatada
    const agora = new Date();
    const yyyy = agora.getFullYear();
    const mm = String(agora.getMonth() + 1).padStart(2, '0');
    const dd = String(agora.getDate()).padStart(2, '0');
    const hh = String(agora.getHours()).padStart(2, '0');
    const mi = String(agora.getMinutes()).padStart(2, '0');
    const ss = String(agora.getSeconds()).padStart(2, '0');

    const timestamp = `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;

    const fileName = `rcdexpress-pdf-${timestamp}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (e) {
    console.error("Erro ao gerar PDF:", e);
    res.status(500).json({ erro: "Falha ao gerar PDF" });
  }
});


function isRender() {
  return !!process.env.RENDER;
}

async function getBrowser() {
  if (isRender()) {
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    return puppeteer.launch({
      headless: true,
    });
  }
}

const PORT = 3000;

// const options = {
//   pfx: fs.readFileSync("1007107376.pfx"),
//   passphrase: "270270ab"
// };

// https.createServer(options, app).listen(PORT, () => {
//   console.log(`Servidor HTTPS rodando em https://localhost:${PORT}`);
// });

http.createServer(app).listen(PORT, () => {
  console.log(`Servidor HTTP rodando em http://localhost:${PORT}`);
});
