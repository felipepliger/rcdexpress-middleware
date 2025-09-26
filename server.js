const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
// rota proxy
app.get('/listarNota', async (req, res) => {
  try {
    const { cnpjclie, serienf, numnota, chaveNFe } = req.query;

    // monta a URL do serviço externo
    let url = 'http://rcdexpress.ddns.com.br:8090/ADTWebService/conhecimento/listarNota?';

    if (cnpjclie && serienf && chaveNFe) {
      url += `cnpjclie=${cnpjclie}&serienf=${serienf}&chaveNFe=${chaveNFe}`;
    } else if (cnpjclie && numnota) {
      url += `cnpjclie=${cnpjclie}&numnota=${numnota}`;
    } else {
      return res.status(400).json({ erro: 'Parâmetros insuficientes' });
    }
    const resposta = await axios.get(url);

    res.json(resposta.data);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ erro: 'Falha ao buscar nota' });
  }
});

// start
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
