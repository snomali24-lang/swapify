module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { source_image, target_image, target_video, mode } = req.body;
    const hf_token = process.env.HF_TOKEN;
    if (!hf_token) return res.status(401).json({ error: 'Token HF manquant' });

    const session_hash = Math.random().toString(36).substring(2, 12);

    // Choisir le bon Space selon le mode
    const spaceUrl = mode === 'video'
      ? 'https://numz-video-faceswap.hf.space'
      : 'https://tencent-ailab-ip-adapter.hf.space';

    // On utilise le Space InsightFace pour les photos
    const imageSpaceUrl = 'https://deepinsight-inswapper.hf.space';

    const targetUrl = mode === 'video' ? spaceUrl : imageSpaceUrl;

    // Envoyer la requête au Space Gradio
    const joinRes = await fetch(`${targetUrl}/run/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hf_token}`
      },
      body: JSON.stringify({
        data: mode === 'video'
          ? [source_image, target_video]
          : [source_image, target_image],
        fn_index: 0,
        session_hash
      })
    });

    if (!joinRes.ok) {
      const errText = await joinRes.text();
      throw new Error(`Erreur Space (${joinRes.status}): ${errText.slice(0, 200)}`);
    }

    const result = await joinRes.json();

    // Extraire l'URL du résultat
    const output = result.data?.[0];
    if (!output) throw new Error('Aucun résultat reçu');

    const outputUrl = output.url || output.path || output;
    if (!outputUrl) throw new Error('URL résultat introuvable');

    // Si c'est une URL relative, la rendre absolue
    const finalUrl = outputUrl.startsWith('http')
      ? outputUrl
      : `${targetUrl}/file=${outputUrl}`;

    return res.status(200).json({ result: finalUrl, mode });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
