# Guide juridique de la nuit (GCN) — bêta

Assistant documentaire pour les membres du Grand Conseil de la Nuit. Le membre choisit sa commune et son type d'établissement, pose sa question avec ses mots, et le guide affiche les articles des textes officiels qui s'y rapportent, avec un lien vers le texte et sa date de version. Si rien ne répond, la question part à l'équipe.

Le guide fonctionne entièrement dans le navigateur : pas de serveur, pas d'IA externe, pas de clé API.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html`, `assets/style.css`, `assets/app.js` | Interface |
| `assets/search.js` | Moteur de recherche (mots-clés pondérés, lexique, filtres) |
| `assets/config.js` | Adresse de réception des questions |
| `data/corpus.json` | Les textes, découpés article par article |
| `data/lexique.json` | Jargon de la nuit relié aux mots des textes (club → dancing, pétard → stupéfiants…) |
| `data/faq.json` | Réponses validées par l'équipe, affichées en priorité |
| `apps-script/Code.gs` | Réception des questions dans une feuille Google et résumé quotidien par e-mail |
| `outils/build_corpus.py` | Reconstruit `corpus.json` à partir des PDF officiels |
| `tests/` | Les questions de test et le script qui les passe (`node tests/run.js`) |

## Recevoir les questions sans réponse

1. Créer une feuille Google Sheets vide, par exemple « GCN – questions au guide ».
2. Menu Extensions > Apps Script. Remplacer le contenu par celui de `apps-script/Code.gs`. Régler `HEURE_RESUME` en haut du fichier si besoin (8 h par défaut). Enregistrer.
3. Choisir la fonction `installer` dans la liste et cliquer sur Exécuter. Accepter les autorisations demandées.
4. Déployer > Nouveau déploiement > type « Application Web ». Exécuter en tant que : moi. Accès : tout le monde. Déployer, puis copier l'adresse qui finit par `/exec`.
5. Coller cette adresse dans `assets/config.js`, entre les guillemets de `ENVOI_URL`.

Chaque question arrive dans l'onglet « Questions », avec le statut « À traiter ». Un résumé part chaque jour à l'heure choisie.

## Ajouter une réponse validée

Quand l'équipe a répondu à une question qui reviendra, ajouter une entrée dans `data/faq.json` :

```json
{
  "question": "Puis-je laisser les clients danser sur la terrasse ?",
  "reponse": "Réponse rédigée et validée par l'équipe.",
  "sources": ["RTEP Genève art. 25", "RRDBHD art. 35"],
  "mots_cles": ["danser", "terrasse"],
  "commune": null,
  "date": "décembre 2026"
}
```

`commune` vaut `null` si la réponse vaut partout, sinon `geneve`, `carouge`, `lancy` ou `vernier`.

## Mettre à jour un texte

1. Télécharger le nouveau PDF officiel et le placer dans un dossier avec le nom de fichier attendu (voir la liste `DOCS` dans `outils/build_corpus.py`).
2. `python3 outils/build_corpus.py dossier_des_pdf data/corpus.json`
3. `node tests/run.js` pour vérifier que les questions de test trouvent toujours les bons articles.

## Limites connues de la bêta

- La recherche repose sur les mots et le lexique, pas encore sur le sens. Une question formulée avec des mots absents du lexique peut passer à côté. Chaque question transmise à l'équipe sert à enrichir le lexique.
- Le droit du travail (CO, LTr, OLT, CCNT) n'est pas encore intégré.
- Les dates de version des textes cantonaux correspondent au jour de téléchargement (17 novembre 2026).
