# Notes pour Claude Code

## Chatbot "Alex" — résumé statique du site

Le contexte du site donné à Alex (services, portfolio, FAQ, contact) n'est plus scrapé dynamiquement : il est codé en dur dans la constante `SITE_SUMMARY` du fichier [api/chat.js](api/chat.js). Ce choix a été fait pour limiter la consommation de tokens (l'ancien scraping renvoyait le contenu des 5 pages à chaque message et faisait sauter le quota Groq).

**Quand modifier `SITE_SUMMARY` :**
- Si le changement apporté au site modifie une info qu'Alex utilise pour répondre (nouveau service, nouveau tarif, nouveau projet portfolio, nouvelle FAQ, changement de contact, etc.) → mettre à jour `SITE_SUMMARY` en conséquence.

**Quand NE PAS y toucher :**
- Pour les changements purement visuels/CSS, le contenu marketing qui ne change pas le fond (reformulation d'une phrase, réorganisation de section), ou tout ce qui n'a pas d'impact sur les infos que le visiteur pourrait demander à Alex.

Bref : ne pas mettre à jour `SITE_SUMMARY` par réflexe à chaque modif du site, seulement quand l'info qu'il contient devient inexacte.
