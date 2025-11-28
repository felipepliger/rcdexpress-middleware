const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const fs = require('fs');

const app = express();
app.use(cors());

// cria um agente HTTPS que ignora certificados inválidos (para o serviço externo)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// rota proxy
app.get('/listarNota', async (req, res) => {
  try {
    const { cnpjclie, serienf, numnota, chaveNFe } = req.query;

    // monta a URL do serviço externo
    let url = 'https://rcdexpress.ddns.com.br:8443/ADTWebService/conhecimento/listarNota?';

    if (cnpjclie && serienf && chaveNFe) {
      url += `cnpjclie=${cnpjclie}&serienf=${serienf}&chaveNFe=${chaveNFe}`;
    } else if (cnpjclie && numnota) {
      url += `cnpjclie=${cnpjclie}&numnota=${numnota}`;
    } else {
      return res.status(400).json({ erro: 'Parâmetros insuficientes' });
    }

    const resposta = await axios.get(url, { httpsAgent });
    res.json(resposta.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: 'Falha ao buscar nota',
      detalhe: err.message
    });
  }
});

const PORT = 3000;

const options = {
  key: fs.readFileSync("localhost-key.pem"),
  cert: fs.readFileSync("localhost.pem")
};

https.createServer(options, app).listen(PORT, () => {
  console.log(`Servidor HTTPS rodando em https://localhost:${PORT}`);
});
