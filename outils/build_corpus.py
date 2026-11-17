"""Extrait le texte des PDF du corpus et le découpe en articles -> corpus.json"""
import sys, re, json, collections
import pymupdf as fitz

SRC = sys.argv[1]   # dossier des PDF
OUT = sys.argv[2]   # fichier corpus.json

DOCS = [
    # id, fichier, sigle, titre, niveau, commune, référence, url officielle, types concernés
    dict(id="lrdbhd", file="lrdbhd", sigle="LRDBHD", ref="I 2 22", niveau="cantonal", commune=None,
         titre="Loi sur la restauration, le débit de boissons, l'hébergement et le divertissement",
         url="https://silgeneve.ch/legis/data/rsg_i2_22.htm"),
    dict(id="rrdbhd", file="rrdbhd", sigle="RRDBHD", ref="I 2 22.01", niveau="cantonal", commune=None,
         titre="Règlement d'exécution de la loi sur la restauration, le débit de boissons, l'hébergement et le divertissement",
         url="https://silgeneve.ch/legis/data/rsg_I2_22p01.htm"),
    dict(id="lif", file="lif", sigle="LIF", ref="K 1 18", niveau="cantonal", commune=None,
         titre="Loi sur l'interdiction de fumer dans les lieux publics",
         url="https://silgeneve.ch/legis/data/rsg_k1_18.htm"),
    dict(id="rif", file="rif", sigle="RIF", ref="K 1 18.01", niveau="cantonal", commune=None,
         titre="Règlement d'application relatif à la loi sur l'interdiction de fumer dans les lieux publics",
         url="https://silgeneve.ch/legis/data/rsg_k1_18p01.htm"),
    dict(id="ltgveat", file="ltgveat", sigle="LTGVEAT", ref="I 2 25", niveau="cantonal", commune=None,
         titre="Loi sur la remise à titre gratuit et la vente à l'emporter de boissons alcooliques, de produits du tabac et de produits assimilés au tabac",
         url="https://silgeneve.ch/legis/data/rsg_i2_25.htm"),
    dict(id="rpbv", file="rpbv", sigle="RPBV", ref="K 1 70.10", niveau="cantonal", commune=None,
         titre="Règlement sur la protection contre le bruit et les vibrations",
         url="https://silgeneve.ch/legis/data/rsg_k1_70p10.htm"),
    dict(id="rstp", file="rstp", sigle="RSTP", ref="E 4 05.03", niveau="cantonal", commune=None,
         titre="Règlement sur la salubrité et la tranquillité publiques",
         url="https://silgeneve.ch/legis/data/rsg_e4_05p03.htm"),
    dict(id="lstup", file="lstup", sigle="LStup", ref="RS 812.121", niveau="fédéral", commune=None,
         titre="Loi fédérale sur les stupéfiants et les substances psychotropes",
         url="https://www.fedlex.admin.ch/eli/cc/1952/241_241_245/fr"),
    dict(id="olrnis", file="olrnis", sigle="O-LRNIS", ref="RS 814.711", niveau="fédéral", commune=None,
         titre="Ordonnance relative à la loi fédérale sur la protection contre les dangers liés au rayonnement non ionisant et au son",
         url="https://www.fedlex.admin.ch/eli/cc/2019/183/fr"),
    dict(id="ge_terrasses", file="ge_terrasses", sigle="RTEP Genève", ref="LC 21 314", niveau="communal", commune="geneve",
         titre="Règlement sur les terrasses d'établissements publics (Ville de Genève)",
         url="https://www.geneve.ch/themes/environnement-urbain-espaces-verts/utilisation-espace-public/terrasses/terrasses-annee"),
    dict(id="ge_lc21316", file="ge_lc21316", sigle="Émolument domaine public Genève", ref="LC 21 316", niveau="communal", commune="geneve",
         titre="Règlement relatif à l'émolument administratif dû pour une permission d'usage accru du domaine public municipal (Ville de Genève)",
         url="https://www.geneve.ch/themes/environnement-urbain-espaces-verts/utilisation-espace-public"),
    dict(id="ge_lc21318", file="ge_lc21318", sigle="Taxation domaine public Genève", ref="LC 21 318", niveau="communal", commune="geneve",
         titre="Règlement relatif à la taxation des empiètements sur ou sous le domaine public municipal (Ville de Genève)",
         url="https://www.geneve.ch/themes/environnement-urbain-espaces-verts/utilisation-espace-public/terrasses/terrasses-annee"),
    dict(id="carouge_terrasses", file="carouge_terrasses", sigle="Terrasses Carouge", ref="LC 08 311", niveau="communal", commune="carouge",
         titre="Règlement sur les terrasses d'établissements publics (Ville de Carouge)",
         url="https://www.carouge.ch/sites/default/files/2024-09/reglement-terrasse-lc_08_311.pdf"),
    dict(id="lancy_terrasses", file="lancy_terrasses", sigle="Terrasses Lancy", ref="LC 28 313", niveau="communal", commune="lancy",
         titre="Règlement de la Ville de Lancy sur les terrasses d'établissements publics",
         url="https://www.lancy.ch/sites/default/files/documents/reglement-terrasses_mise_a_jour_20_06_2025.pdf"),
    dict(id="lancy_lrdbhd", file="lancy_lrdbhd", sigle="Émoluments LRDBHD Lancy", ref="LC 28 311", niveau="communal", commune="lancy",
         titre="Règlement communal de la Ville de Lancy sur la LRDBHD (émoluments et sanctions)",
         url="https://lancy.ch/sites/default/files/documents/Formulaires/reglement_emolument_2018_lrdbhd.pdf"),
    dict(id="vernier_terrasses", file="vernier_terrasses", sigle="Terrasses Vernier", ref="115.1", niveau="communal", commune="vernier",
         titre="Règlement de la Ville de Vernier relatif aux terrasses saisonnières d'établissements publics",
         url="https://www.vernier.ch/sites/default/files/2022-11/RSRV_-_115.1_Reglement_sur_les_terrasses_saisonnieres_detablissements_publics.pdf"),
]

HEADER_PATTERNS = [
    r"^rsGE [A-Z] \d", r"^Source SILGENEVE PUBLIC", r"^SILGENEVE PUBLIC", r"^Source\s*$",
    r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}", r"^https?://", r"^\d+/\d+\s*$", r"chevron_right",
    r"^Accueil\s*$", r"^Recueil systématique", r"^RS \d{3}\.\d+ - ", r"^\d+ Santé", r"^8 Santé",
    r"^LC \d\d \d{3}\s+Règlement", r"^Règlement sur les terrasses d’établissements publics\s+LC",
    r"^LC \d\d \d{3}\s*$", r"^Règlement- Terrasses saisonnières", r"^Ville de Vernier\s*Règlement",
    r"^Page \d+ sur \d+", r"^\d+/\d+\s*$", r"^\d{3}\.\d{2,3}\b",
]
HEADER_RE = re.compile("|".join(HEADER_PATTERNS))


def body_size(doc):
    c = collections.Counter()
    for p in doc:
        for b in p.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if s["text"].strip():
                        c[round(s["size"], 1)] += len(s["text"])
    return c.most_common(1)[0][0]


def extract_lines(path):
    """Regroupe les fragments par ligne visuelle (même hauteur), toutes colonnes
    confondues, puis ne garde que le corps du texte (exposants et notes écartés)."""
    doc = fitz.open(path)
    bs = body_size(doc)
    lines = []
    for p in doc:
        spans = []
        for b in p.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if s["text"].strip():
                        spans.append(s)
        # regroupement par ligne de base
        rows = []
        for s in sorted(spans, key=lambda s: (round(s["bbox"][3], 0), s["bbox"][0])):
            y = s["bbox"][3]
            big = s["size"] >= bs - 0.35
            placed = False
            for r in rows:
                if abs(r["y"] - y) < (2.5 if big else 4.5):
                    r["spans"].append(s); placed = True; break
            if not placed:
                rows.append({"y": y, "spans": [s]})
        rows.sort(key=lambda r: r["y"])
        for r in rows:
            out = ""
            prev_x1 = 0
            sp = sorted(r["spans"], key=lambda s: s["bbox"][0])
            if not any(s["size"] >= bs - 0.35 for s in sp):
                continue   # ligne entièrement en petit corps : note de bas de page
            for s in sp:
                t = s["text"]
                if s["size"] >= bs - 0.35:
                    if out and not out.endswith(" ") and s["bbox"][0] - prev_x1 > 3:
                        out += " "
                    out += t
                elif t.strip() in ("er", "re", "e", "bis", "ter") and out and out.rstrip()[-1:].isdigit():
                    out = out.rstrip() + t.strip() + " "
                elif t.strip().isdigit() and not out.strip():
                    out += t.strip() + " "      # numéro d'alinéa en exposant
                prev_x1 = s["bbox"][2]
            out = out.replace("\xa0", " ").rstrip()
            if out.strip():
                lines.append(out)
    return lines


def clean(lines):
    res = []
    for ln in lines:
        s = ln.strip()
        if HEADER_RE.search(s):
            continue
        # fin des textes silgeneve : tableau historique
        if re.match(r"^RSG\s+Intitulé", s) or re.match(r"^Tableau des modifications", s):
            break
        res.append(s)
    return res


ART_RE = re.compile(r"^(?:Art\.?|Article)\s+(\d+[A-Za-z]?)(?:\s*\(\d+\))?(?:\s*[:\-–]?\s*)(.*)$")
ANNEX_RE = re.compile(r"^Annexe\s*(\d+)\b\s*(.*)$")
STRUCT_RE = re.compile(r"^(Titre|Chapitre|Section)\s+([IVXLC\d]+[A-Za-z]?)\b[\s.:]*(.*)$", re.I)


def split_articles(lines, title_next=False):
    chunks, cur, ctx = [], None, {"titre": "", "chapitre": "", "section": ""}
    pre = []
    for s in lines:
        m = ART_RE.match(s)
        a = ANNEX_RE.match(s)
        st = STRUCT_RE.match(s)
        if st and len(s) < 120:
            kind = st.group(1).lower()
            label = f"{st.group(1).capitalize()} {st.group(2)} {st.group(3)}".strip()
            ctx[kind] = label
            if kind == "titre": ctx["chapitre"] = ctx["section"] = ""
            if kind == "chapitre": ctx["section"] = ""
            continue
        if m and (len(s) < 160):
            if cur: chunks.append(cur)
            cur = {"art": m.group(1), "titre": m.group(2).strip(), "ctx": " · ".join(v for v in ctx.values() if v), "lines": []}
            continue
        if a and len(s) < 160:
            if cur: chunks.append(cur)
            cur = {"art": "Annexe " + a.group(1), "titre": a.group(2).strip(), "ctx": "", "lines": []}
            continue
        if cur is None:
            pre.append(s)
        else:
            # titre d'article sur la ligne suivante (règlements communaux)
            if title_next and not cur["titre"] and not cur["lines"] and len(s) < 90 and not re.match(r"^\d", s):
                cur["titre"] = s
                continue
            cur["lines"].append(s)
    if cur: chunks.append(cur)
    return pre, chunks


def join_text(lines):
    """Recolle les lignes en paragraphes : nouvel alinéa sur chiffre / lettre."""
    out = []
    for s in lines:
        newpar = bool(re.match(r"^(\d{1,2}[A-Za-z]?\s|[a-z]\)\s|[a-z]\.\s|\d+\.\s|\d+\.\d+|•|-\s)", s))
        if out and not newpar:
            if out[-1].endswith("-") and not out[-1].endswith(" -"):
                out[-1] = out[-1][:-1] + s
            else:
                out[-1] += " " + s
        else:
            out.append(s)
    txt = "\n".join(out)
    txt = re.sub(r"\((\d{1,2})\)", "", txt)          # renvois silgeneve (12)
    txt = re.sub(r"[ \t]{2,}", " ", txt)
    return txt.strip()


def version_of(raw, d):
    if "SILGENEVE" in raw:
        return "version en vigueur consultée le 17 novembre 2026"
    m = re.search(r"\(État le ([^)]+)\)", raw)
    if m: return "état le " + m.group(1)
    m = re.search(r"\(Etat le ([^)]+)\)", raw)
    if m: return "état le " + m.group(1)
    m = re.search(r"[Ee]ntrée en vigueur\s*:?\s*(?:le\s*)?([0-9]{1,2}(?:er)?\s*\w+ \d{4})", raw)
    if m: return "en vigueur depuis le " + m.group(1)
    return ""


MAXLEN = 1400

corpus = {"docs": [], "chunks": []}
for d in DOCS:
    raw_lines = extract_lines(f"{SRC}/{d['file']}.pdf")
    raw = "\n".join(raw_lines)
    lines = clean(raw_lines)
    pre, arts = split_articles(lines, title_next=d['id'] in ('vernier_terrasses','lancy_terrasses','lancy_lrdbhd','ge_terrasses','ge_lc21316','ge_lc21318','carouge_terrasses'))
    d2 = {k: v for k, v in d.items() if k != "file"}
    d2["version"] = version_of(raw, d)
    corpus["docs"].append(d2)
    n = 0
    for a in arts:
        text = join_text(a["lines"])
        if not text or re.fullmatch(r"\(?abrogé\)?\.?", text.strip(), re.I):
            continue
        # découpage des articles longs par alinéas
        parts, buf = [], ""
        for par in text.split("\n"):
            if buf and len(buf) + len(par) > MAXLEN:
                parts.append(buf); buf = par
            else:
                buf = (buf + "\n" + par) if buf else par
        if buf: parts.append(buf)
        for i, p in enumerate(parts):
            corpus["chunks"].append({
                "doc": d["id"], "art": a["art"], "titre": a["titre"], "ctx": a["ctx"],
                "part": i + 1 if len(parts) > 1 else 0, "nparts": len(parts), "text": p,
            })
            n += 1
    print(f"{d['id']:20s} articles={len(arts):4d} chunks={n:4d} version={d2['version']}", file=sys.stderr)

json.dump(corpus, open(OUT, "w"), ensure_ascii=False, indent=0)
print("total chunks", len(corpus["chunks"]), file=sys.stderr)
