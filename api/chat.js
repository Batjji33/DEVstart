// ============================================================================
//  DEVstart — Serverless Function : Chatbot "Alex"
//  Plateforme : Vercel (Hobby)  •  Runtime : Node.js
//  Reçoit le contenu du site + l'historique de conversation, interroge l'API
//  Groq (compatible OpenAI) et renvoie la réponse de l'assistant.
//
//  La clé API Groq est lue depuis la variable d'environnement GROQ_API_KEY.
//  Elle n'est JAMAIS exposée côté client.
// ============================================================================

// --- Configuration Groq ---------------------------------------------------
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

// --- Construction du system prompt ----------------------------------------
// On injecte dynamiquement le contenu scrapé du site (siteContent).
function buildSystemPrompt(siteContent) {
  return `Tu es Alex, l'assistant de DEVstart, une agence web moderne qui crée des sites rapides, élégants et performants grâce à l'IA.

Ton style : décontracté et sympa, mais toujours pro. Tu peux utiliser quelques termes techniques (responsive, SEO, serverless, etc.) quand c'est pertinent, mais tu n'en abuses pas.

Tu connais parfaitement DEVstart. Voici le contenu complet du site pour t'y référer :

---
${siteContent || "(contenu du site indisponible)"}
---

Les offres et tarifs exacts de DEVstart :
- Essentiel : 69€ — site vitrine 1 à 3 pages, design responsive, SEO de base, formulaire de contact, livraison en 7 jours
- Professionnel : 99€ — site vitrine 3 à 5 pages, design premium, SEO avancé, animations & interactions, support 30 jours
- Sur Mesure : sur devis — pages illimitées, fonctionnalités avancées (dashboard, espace membre), design entièrement sur mesure, support prioritaire

Pour toute demande de devis ou projet Sur Mesure, invite le visiteur à remplir le formulaire sur /contact.html.

Tu peux aussi répondre à des questions générales hors DEVstart (tech, web, etc.).`;
}

// --- Handler Vercel -------------------------------------------------------
export default async function handler(req, res) {
  // On n'accepte que les requêtes POST.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée. Utilisez POST." });
  }

  // Vérification de la clé API côté serveur.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY manquante dans les variables d'environnement.");
    return res.status(500).json({
      error: "Configuration serveur incomplète. Réessaie un peu plus tard 🙏",
    });
  }

  // Récupération et validation du corps de la requête.
  // (Vercel parse automatiquement le JSON, mais on gère le cas brut par sécurité.)
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Corps de requête JSON invalide." });
    }
  }

  const messages = body?.messages;
  const siteContent = body?.siteContent || "";

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Le champ 'messages' est requis." });
  }

  // On assemble la conversation : system prompt + historique du visiteur.
  const payload = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(siteContent) },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 800,
  };

  // Garde-fou anti-timeout : on annule l'appel Groq au bout de 25 s
  // (la fonction Vercel Hobby a une limite d'exécution).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Gestion des erreurs renvoyées par Groq (404, 401, 429, etc.).
    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.error(`Erreur Groq (${groqRes.status}): ${errText}`);

      let friendly = "Oups, je n'arrive pas à répondre pour le moment 😅 Réessaie dans un instant.";
      if (groqRes.status === 429) {
        friendly = "Je reçois beaucoup de questions là tout de suite 😅 Laisse-moi quelques secondes et réessaie.";
      } else if (groqRes.status === 401) {
        friendly = "Petit souci de configuration côté serveur. L'équipe DEVstart va régler ça vite 🙏";
      }
      return res.status(502).json({ error: friendly });
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "Je n'ai pas réussi à formuler de réponse. Tu peux reformuler ? 🙂",
      });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    clearTimeout(timeout);

    // Cas spécifique du timeout (abort).
    if (err.name === "AbortError") {
      console.error("Timeout de l'appel Groq.");
      return res.status(504).json({
        error: "Ça prend un peu trop de temps là 😅 Réessaie, ça devrait passer.",
      });
    }

    console.error("Erreur inattendue:", err);
    return res.status(500).json({
      error: "Une erreur est survenue de mon côté. Réessaie dans un instant 🙏",
    });
  }
}
