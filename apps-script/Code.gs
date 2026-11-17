/**
 * Guide juridique de la nuit (GCN) — réception des questions sans réponse.
 *
 * Ce script s'attache à une feuille Google Sheets. Il :
 *  1. enregistre chaque question envoyée depuis le guide dans l'onglet « Questions » ;
 *  2. envoie chaque jour, à l'heure choisie, un résumé des nouvelles questions par e-mail.
 *
 * Installation : voir le README du dépôt (section « Recevoir les questions »).
 */

// Heure d'envoi du résumé quotidien (0 à 23, heure de Genève)
const HEURE_RESUME = 8;
// Adresse qui reçoit le résumé. Vide = l'adresse du compte Google qui installe le script.
const DESTINATAIRE = "";
// Envoyer aussi un e-mail immédiat à chaque nouvelle question (true / false)
const ALERTE_IMMEDIATE = false;

const ONGLET = "Questions";
const ENTETES = [
  "Reçue le", "Commune", "Type d'établissement", "Question", "Nom", "E-mail",
  "Articles proposés par le guide", "Confiance du guide", "Statut",
  "Réponse de l'équipe", "Validée pour le guide (oui/non)", "Répondue le",
];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.question || String(d.question).length > 2000) return reponse_({ ok: false });
    const feuille = onglet_();
    feuille.appendRow([
      new Date(), propre_(d.commune), propre_(d.type), propre_(d.question), propre_(d.nom), propre_(d.email),
      propre_(d.articles_proposes), propre_(d.confiance), "À traiter", "", "", "",
    ]);
    if (ALERTE_IMMEDIATE) {
      MailApp.sendEmail(destinataire_(), "GCN · nouvelle question au guide",
        `Commune : ${d.commune}\nType : ${d.type}\n\n${d.question}\n\nDe : ${d.nom} <${d.email}>`);
    }
    return reponse_({ ok: true });
  } catch (err) {
    return reponse_({ ok: false });
  }
}

function doGet() {
  return reponse_({ ok: true, service: "guide GCN" });
}

/** Résumé quotidien des questions « À traiter » reçues depuis le dernier résumé. */
function envoyerResume() {
  const props = PropertiesService.getScriptProperties();
  const depuis = new Date(Number(props.getProperty("dernierResume") || 0));
  const valeurs = onglet_().getDataRange().getValues().slice(1);
  const nouvelles = valeurs.filter((l) => l[0] instanceof Date && l[0] > depuis);
  const enAttente = valeurs.filter((l) => l[8] === "À traiter");
  props.setProperty("dernierResume", String(Date.now()));
  if (!nouvelles.length && !enAttente.length) return;

  const lignes = nouvelles.map((l, i) =>
    `${i + 1}. ${l[3]}\n   ${l[2]} · ${l[1]} · de ${l[4] || "anonyme"} <${l[5]}>\n   Articles proposés : ${l[6] || "aucun"}`);
  const corps =
    `Nouvelles questions depuis le dernier résumé : ${nouvelles.length}\n` +
    `Questions encore à traiter au total : ${enAttente.length}\n\n` +
    (lignes.length ? lignes.join("\n\n") + "\n\n" : "") +
    `Feuille de suivi : ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`;
  MailApp.sendEmail(destinataire_(), `GCN · ${nouvelles.length} nouvelle(s) question(s) au guide`, corps);
}

/** À lancer une fois, à la main : crée le déclencheur quotidien. */
function installer() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "envoyerResume")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("envoyerResume").timeBased().everyDays(1).atHour(HEURE_RESUME)
    .inTimezone("Europe/Zurich").create();
  onglet_();
}

function onglet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let f = ss.getSheetByName(ONGLET);
  if (!f) {
    f = ss.insertSheet(ONGLET);
    f.appendRow(ENTETES);
    f.setFrozenRows(1);
    f.getRange(1, 1, 1, ENTETES.length).setFontWeight("bold");
    f.setColumnWidth(4, 420);
  }
  return f;
}

function destinataire_() {
  return DESTINATAIRE || Session.getEffectiveUser().getEmail();
}

function propre_(v) {
  // évite qu'un texte commençant par = soit interprété comme une formule
  const s = String(v == null ? "" : v).slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
