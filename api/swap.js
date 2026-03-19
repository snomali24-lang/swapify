module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { source_image, target_image } = req.body;
    const hf_token = process.env.HF_TOKEN;
    if (!hf_token) return res.status(401).json({ error: 'Token HF manquant' });

    const session_hash = Math.random().toString(36).substring(2, 12);

    // Étape 1 : rejoindre la queue
    const joinRes = await fetch('https://felixrosberg-face-swap.hf.space/queue/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hf_token}`
      },
      body: JSON.stringify({
        fn_index: 0,
        data: [source_image, target_image, 0, false],
        session_hash
      })
    });

    if (!joinRes.ok) throw new Error(`Erreur join (${joinRes.status})`);

    // Étape 2 : écouter le résultat via SSE
    const streamRes = await fetch(
      `https://felixrosberg-face-swap.hf.space/queue/data?session_hash=${session_hash}`,
      { headers: { 'Authorization': `Bearer ${hf_token}` } }
    );

    const text = await streamRes.text();
    const lines = text.split('\n').filter(l => l.startsWith('data:'));

    for (const line of lines) {
      try {
        const json = JSON.parse(line.replace('data: ', ''));
        if (json.msg === 'process_completed') {
          const output = json.output?.data?.[0];
          const url = output?.url || output?.path || output;
          if (url) {
            const finalUrl = url.startsWith('http')
              ? url
              : `https://felixrosberg-face-swap.hf.space/file=${url}`;
            return res.status(200).json({ result: finalUrl });
          }
        }
      } catch {}
    }

    // Retourner le texte brut pour déboguer
return res.status(200).json({ debug: lines.slice(0, 5), raw: text.slice(0, 500) });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
