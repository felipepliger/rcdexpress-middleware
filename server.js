const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs');
const carbone = require('carbone');

const app = express();
app.use(cors({
  exposedHeaders: ["Content-Disposition"]
}));


const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function buscarNotas({ cnpjclie, serienf, numnota, chaveNFe, dataInicio, dataFim }) {
  let url = 'https://rcdexpress.ddns.com.br:8443/ADTWebService/conhecimento/listarNota?';

  if (cnpjclie && serienf && chaveNFe) {
    url += `cnpjclie=${cnpjclie}&serienf=${serienf}&chaveNFe=${chaveNFe}`;
  } else if (cnpjclie && dataInicio && dataFim) {
    url += `cnpjclie=${cnpjclie}&dataInicio=${dataInicio}&dataFim=${dataFim}`;
  } else if (cnpjclie && numnota) {
    url += `cnpjclie=${cnpjclie}&numnota=${numnota}`;
  } else {
    throw new Error('Parâmetros insuficientes');
  }

  const resposta = await axios.get(url, { httpsAgent });

  const dataOrdenada = resposta.data.data.sort(
    (a, b) => new Date(b.emissao) - new Date(a.emissao) // mais recente → mais antigo
  );

  return {
    ...resposta.data,
    data: dataOrdenada
  };
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

      const fileName = `rcdexpress-${timestamp}.xlsx`;

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

app.get('/relatorioPdf', async (req, res) => {
  try {
    const resposta = await buscarNotas(req.query);
    const data = resposta.data;
    
    const templatePath = './templates/template-ods.ods';

    carbone.render(templatePath, data, { convertTo: 'pdf' }, (err, result) => {
      if (err) {
        console.error("Erro ao gerar PDF:", err);
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

      const fileName = `rcdexpress-${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

      res.send(result); // PDF buffer
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: 'Falha ao gerar relatório',
      detalhe: err.message
    });
  }
});


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
