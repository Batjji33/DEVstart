/* ============================================================================
   DEVstart — Chatbot "Alex" (frontend, vanilla JS, zéro dépendance)
   ----------------------------------------------------------------------------
   • Bulle flottante en bas à droite, présente sur toutes les pages.
   • Au PREMIER clic d'ouverture : scraping unique des 5 pages du site pour
     fournir le contexte à l'IA (stocké en mémoire, jamais refait dans la session).
   • L'historique complet + le contenu scrapé sont envoyés à /api/chat à chaque
     message. La clé API reste côté serveur.
   ========================================================================== */

(function () {
  "use strict";

  // --- Configuration -------------------------------------------------------
  const API_ENDPOINT = "/api/chat";
  const PAGES = [
    "/index.html",
    "/services.html",
    "/portfolio.html",
    "/a-propos.html",
    "/contact.html",
  ];
  const WELCOME =
    "Salut ! Je suis Alex, l'assistant de DEVstart 👋 Comment je peux t'aider ?";
  const MAX_CHARS_PER_PAGE = 1200; // limite la taille du contenu scrapé envoyé à chaque message
  const MAX_HISTORY_MESSAGES = 12; // limite l'historique envoyé pour éviter de dépasser le quota Groq (TPM)

  // --- État (mémoire de session, en closure) -------------------------------
  let siteContent = null;     // contenu scrapé (string) — null tant que non scrapé
  let scrapeStarted = false;  // évite tout double scraping
  let isOpen = false;         // état d'ouverture du popup
  let isSending = false;      // une requête est en cours
  const messages = [];        // historique : [{ role, content }, ...]

  // Références DOM (renseignées au build).
  let els = {};

  /* ----------------------------------------------------------------------
     1. SCRAPING — une seule fois par session
     Récupère le texte lisible (innerText) des 5 pages, en parallèle.
     ---------------------------------------------------------------------- */
  async function scrapeSite() {
    if (scrapeStarted) return;
    scrapeStarted = true;

    const results = await Promise.allSettled(
      PAGES.map(async (path) => {
        const res = await fetch(path, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`${path} → ${res.status}`);
        const html = await res.text();

        // On parse le HTML hors-écran et on extrait uniquement le texte lisible.
        const doc = document.createElement("div");
        doc.innerHTML = html;

        // On retire les éléments non pertinents (scripts, styles, etc.) ainsi
        // que la nav/footer, identiques sur les 5 pages : les garder gonflerait
        // inutilement le nombre de tokens envoyés à chaque message.
        doc.querySelectorAll("script, style, noscript, svg, canvas, nav, footer, .mobile-nav")
          .forEach((n) => n.remove());

        const text = (doc.innerText || doc.textContent || "")
          .replace(/\s+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
          .slice(0, MAX_CHARS_PER_PAGE); // on plafonne pour limiter la consommation de tokens

        return `### Page : ${path}\n${text}`;
      })
    );

    const collected = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    // Même si certaines pages échouent, on garde ce qu'on a pu récupérer.
    siteContent = collected.join("\n\n");
  }

  /* ----------------------------------------------------------------------
     2. CONSTRUCTION DE L'INTERFACE
     ---------------------------------------------------------------------- */
  function buildUI() {
    // Bouton flottant
    const launcher = document.createElement("button");
    launcher.className = "dvs-chat-launcher";
    launcher.setAttribute("aria-label", "Ouvrir le chat avec Alex");
    launcher.innerHTML = `
      <svg class="dvs-icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <svg class="dvs-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>`;

    // Fenêtre de chat
    const panel = document.createElement("div");
    panel.className = "dvs-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat avec Alex, l'assistant DEVstart");
    panel.innerHTML = `
      <header class="dvs-chat-header">
        <div class="dvs-chat-avatar">A</div>
        <div class="dvs-chat-ident">
          <span class="dvs-chat-name">Alex</span>
          <span class="dvs-chat-status"><span class="dvs-dot"></span>Assistant DEVstart</span>
        </div>
        <button class="dvs-chat-x" aria-label="Fermer le chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>
      <div class="dvs-chat-body" aria-live="polite"></div>
      <form class="dvs-chat-form">
        <input type="text" class="dvs-chat-input" placeholder="Écris ton message…"
               autocomplete="off" aria-label="Votre message" />
        <button type="submit" class="dvs-chat-send" aria-label="Envoyer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>`;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    els = {
      launcher,
      panel,
      body: panel.querySelector(".dvs-chat-body"),
      form: panel.querySelector(".dvs-chat-form"),
      input: panel.querySelector(".dvs-chat-input"),
      send: panel.querySelector(".dvs-chat-send"),
      close: panel.querySelector(".dvs-chat-x"),
    };

    // Événements
    launcher.addEventListener("click", toggle);
    els.close.addEventListener("click", () => setOpen(false));
    els.form.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) setOpen(false);
    });
  }

  /* ----------------------------------------------------------------------
     3. OUVERTURE / FERMETURE
     ---------------------------------------------------------------------- */
  function toggle() {
    setOpen(!isOpen);
  }

  function setOpen(open) {
    isOpen = open;
    els.panel.classList.toggle("dvs-open", open);
    els.launcher.classList.toggle("dvs-active", open);

    if (open) {
      // Premier affichage : message de bienvenue + lancement du scraping.
      if (messages.length === 0) {
        addMessage("assistant", WELCOME);
      }
      scrapeSite(); // ne fait rien si déjà lancé
      setTimeout(() => els.input.focus(), 250);
    }
  }

  /* ----------------------------------------------------------------------
     4. AFFICHAGE DES MESSAGES
     ---------------------------------------------------------------------- */
  // Mini-rendu Markdown sécurisé : on échappe le HTML AVANT de convertir
  // **gras** et les listes à puces (* / -), pour garder un vrai formatage
  // sans jamais permettre d'injection HTML venant du modèle.
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderMarkdownLite(content) {
    const escaped = escapeHtml(content).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const lines = escaped.split("\n");
    let html = "";
    let inList = false;

    for (const line of lines) {
      const bullet = line.match(/^\s*[*-]\s+(.*)/);
      if (bullet) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${bullet[1]}</li>`;
        continue;
      }
      if (inList) { html += "</ul>"; inList = false; }
      html += line.trim() === "" ? "<br>" : `<p>${line}</p>`;
    }
    if (inList) html += "</ul>";
    return html;
  }

  function addMessage(role, content) {
    messages.push({ role, content });

    const row = document.createElement("div");
    row.className = `dvs-msg dvs-msg-${role}`;
    const bubble = document.createElement("div");
    bubble.className = "dvs-bubble";
    if (role === "assistant") {
      bubble.innerHTML = renderMarkdownLite(content); // HTML déjà échappé ci-dessus
    } else {
      bubble.textContent = content; // message utilisateur : jamais interprété
    }
    row.appendChild(bubble);
    els.body.appendChild(row);

    scrollToBottom();
  }

  function showTyping() {
    const row = document.createElement("div");
    row.className = "dvs-msg dvs-msg-assistant dvs-typing-row";
    row.innerHTML = `
      <div class="dvs-bubble dvs-typing">
        <span></span><span></span><span></span>
      </div>`;
    els.body.appendChild(row);
    scrollToBottom();
    return row;
  }

  function scrollToBottom() {
    els.body.scrollTop = els.body.scrollHeight;
  }

  /* ----------------------------------------------------------------------
     5. ENVOI D'UN MESSAGE
     ---------------------------------------------------------------------- */
  async function onSubmit(e) {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text || isSending) return;

    addMessage("user", text);
    els.input.value = "";
    setSending(true);

    const typingRow = showTyping();

    try {
      // On s'assure que le scraping est terminé avant d'envoyer le contexte.
      await scrapeSite();

      // On ne renvoie que les derniers échanges : l'historique complet grossirait
      // indéfiniment le nombre de tokens envoyés et ferait sauter le quota Groq.
      const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);

      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: recentMessages, siteContent: siteContent || "" }),
      });

      typingRow.remove();

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.reply) {
        addMessage(
          "assistant",
          data.error ||
            "Oups, je n'arrive pas à répondre là 😅 Réessaie dans un instant."
        );
      } else {
        addMessage("assistant", data.reply);
      }
    } catch (err) {
      typingRow.remove();
      addMessage(
        "assistant",
        "Je n'arrive pas à joindre le serveur 😅 Vérifie ta connexion et réessaie."
      );
    } finally {
      setSending(false);
      els.input.focus();
    }
  }

  function setSending(state) {
    isSending = state;
    els.send.disabled = state;
    els.input.disabled = state;
  }

  /* ----------------------------------------------------------------------
     6. INITIALISATION
     ---------------------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();
