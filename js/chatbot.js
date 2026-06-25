/* ============================================================================
   DEVstart — Chatbot "Alex" (frontend, vanilla JS, zéro dépendance)
   ----------------------------------------------------------------------------
   • Bulle flottante en bas à droite, présente sur toutes les pages.
   • Le contexte du site (résumé statique) est géré côté serveur dans le system
     prompt — aucun scraping client, aucun contenu de page renvoyé à l'API.
   • Seul l'historique de conversation (limité) est envoyé à /api/chat à chaque
     message. La clé API reste côté serveur.
   ========================================================================== */

(function () {
  "use strict";

  // --- Configuration -------------------------------------------------------
  const API_ENDPOINT = "/api/chat";
  const WELCOME =
    "Salut ! Je suis Alex, l'assistant de DEVstart 👋 Comment je peux t'aider ?";
  const MAX_HISTORY_MESSAGES = 12; // limite l'historique envoyé pour éviter de dépasser le quota Groq (TPM)

  // --- État (mémoire de session, en closure) -------------------------------
  let isOpen = false;         // état d'ouverture du popup
  let isSending = false;      // une requête est en cours
  const messages = [];        // historique : [{ role, content }, ...]

  // Références DOM (renseignées au build).
  let els = {};

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
      // Premier affichage : message de bienvenue.
      if (messages.length === 0) {
        addMessage("assistant", WELCOME);
      }
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
      // On ne renvoie que les derniers échanges : l'historique complet grossirait
      // indéfiniment le nombre de tokens envoyés et ferait sauter le quota Groq.
      const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);

      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: recentMessages }),
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
