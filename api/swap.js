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
    if (!source_image || !target_image) return res.status(400).json({ error: 'Images manquantes' });

    const session_hash = Math.random().toString(36).substring(2, 12);

    // Soumettre au Space InsightFace
    const joinRes = await fetch('https://mindsync-faceswap.hf.space/run/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hf_token}`
      },
      body: JSON.stringify({
        fn_index: 0,
        data: [source_image, target_image],
        session_hash
      })
    });

    if (!joinRes.ok) {
      const txt = await joinRes.text();
      throw new Error(`Erreur Space (${joinRes.status}): ${txt.slice(0, 150)}`);
    }

    const result = await joinRes.json();
    const output = result.data?.[0];
    if (!output) throw new Error('Aucun résultat reçu');

    const finalUrl = output.url || output.path || (typeof output === 'string' ? output : null);
    if (!finalUrl) throw new Error('URL résultat introuvable');

    return res.status(200).json({ result: finalUrl, mode: 'photo' });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
