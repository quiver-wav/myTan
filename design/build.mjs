// Generatore della libreria componenti per claude.ai/design.
// Legge il CSS reale dell'app (src/ui/styles.css) e produce card HTML
// autonome in design/dist/, una per componente, con marker @dsCard.
// Uso: node design/build.mjs

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "dist");

// CSS dell'app, con il percorso font riscritto per la struttura del progetto
// design (card in <gruppo>/x.html, font in fonts/).
const appCss = readFileSync(join(root, "../src/ui/styles.css"), "utf8").replace(
  'url("./fonts/sora-var.woff2")',
  'url("../fonts/sora-var.woff2")',
);

// ---------- helper di rendering ----------

/** Anello di sessione (replica di SessionRing in TodayCard.tsx). */
function ring(fraction, minutes, sub, color) {
  const R = 70;
  const C = 2 * Math.PI * R;
  const pct = Math.min(fraction / 0.8, 1);
  return `<svg viewBox="0 0 180 180" width="160">
  <circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--line)" stroke-width="13"/>
  <circle cx="90" cy="90" r="${R}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"
    stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 90 90)"/>
  <text x="90" y="88" text-anchor="middle" font-size="36" font-weight="800" fill="var(--ink)">${minutes}′</text>
  <text x="90" y="112" text-anchor="middle" font-size="12" fill="var(--muted)">${sub}</text>
</svg>`;
}

/** Colore pelle (replica di tanToColor in src/ui/tanColor.ts). */
const TONES = ["#f7e7d8", "#f0d2b2", "#dfb08a", "#b97f57", "#8a5a3b", "#5c3a26"];
const DEEP = "#4a2e1a";
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
const tanColor = (p, t) => mixHex(TONES[p - 1], DEEP, Math.max(0, Math.min(1, t)));

function skinPreview(p, current, target) {
  const from = tanColor(p, current);
  const to = tanColor(p, target);
  return `<div class="skin-preview">
  <div><span class="swatch" style="background:${from}"></span><span class="lbl">Oggi</span></div>
  <div class="skin-grad" style="background:linear-gradient(90deg,${from},${to})"></div>
  <div><span class="swatch" style="background:${to}"></span><span class="lbl">Obiettivo</span></div>
</div>`;
}

function doseMeter(fraction) {
  return `<div class="dose-meter"><div class="marker" style="left:${(Math.min(fraction / 1.25, 1) * 100).toFixed(0)}%"></div></div>
<div class="scale"><span>0</span><span>soglia sicura</span><span>scottatura</span></div>`;
}

/** Layer "mare animato" per le schermate (markup allineato a Sea.tsx). */
const SEA = `<div class="sea" aria-hidden="true">
<div class="glint"></div>
<div class="wave wave-back"><svg viewBox="0 0 2880 140" preserveAspectRatio="none"><path fill="#cfe8e6" d="M0,70 C240,20 480,120 720,70 C960,20 1200,120 1440,70 C1680,20 1920,120 2160,70 C2400,20 2640,120 2880,70 L2880,140 L0,140 Z"/></svg></div>
<div class="wave wave-front"><svg viewBox="0 0 2880 140" preserveAspectRatio="none"><path fill="#ffffff" d="M0,60 C240,110 480,10 720,60 C960,110 1200,10 1440,60 C1680,110 1920,10 2160,60 C2400,110 2640,10 2880,60 L2880,140 L0,140 Z"/></svg></div>
<div class="wash"></div>
</div>`;

const colorTile = (v, name, note) =>
  `<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden">
  <div style="height:52px;background:${v}"></div>
  <div style="padding:8px 10px;font-size:12px"><b>${name}</b><br><span style="color:var(--muted)">${note}</span></div>
</div>`;

// ---------- definizione delle card ----------

const cards = [
  {
    path: "foundations/colors.html",
    group: "Fondamenta",
    name: "Palette",
    subtitle: "Brand, superfici, semantici",
    width: 480,
    body: `<h2>Palette myTan</h2>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
${colorTile("var(--sun)", "Sun", "#f5a623 · brand")}
${colorTile("var(--sun-deep)", "Sun deep", "#ef7d3a · gradiente CTA")}
${colorTile("var(--sun-dark)", "Sun dark", "accento testo")}
${colorTile("var(--bg)", "Background", "sfondo app")}
${colorTile("var(--card)", "Card", "superficie")}
${colorTile("var(--line)", "Line", "bordi e divisori")}
${colorTile("var(--ink)", "Ink", "testo primario")}
${colorTile("var(--muted)", "Muted", "testo secondario")}
${colorTile("linear-gradient(135deg,#f7a928,#ef7d3a)", "CTA gradient", "azioni primarie")}
${colorTile("var(--safe)", "Safe", "entro soglia")}
${colorTile("var(--warn)", "Warn", "oltre consigliato")}
${colorTile("var(--danger)", "Danger", "rischio scottatura")}
</div>`,
  },
  {
    path: "foundations/typography.html",
    group: "Fondamenta",
    name: "Tipografia",
    subtitle: "Sora display + system body",
    width: 480,
    body: `<div class="brand">myTan <small>abbronzati in sicurezza</small></div>
<div class="step-label">Step label · Passo 1 di 3</div>
<h1>Titolo schermata (h1, Sora 700)</h1>
<h2>Titolo card (h2, Sora 700)</h2>
<p>Corpo del testo standard, font di sistema per leggibilità nativa.</p>
<p class="muted">Testo secondario (muted) per descrizioni e didascalie lunghe che accompagnano i dati.</p>
<span class="big">29 min</span>
<p class="note">Nota piccola per avvisi contestuali sotto i controlli.</p>`,
  },
  {
    path: "components/buttons.html",
    group: "Componenti",
    name: "Bottoni",
    subtitle: "Primario / ghost / opzioni",
    width: 480,
    body: `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
<button>Primario</button>
<button class="ghost">Ghost</button>
<button disabled>Disabilitato</button>
</div>
<button class="block" style="margin-top:14px">Inizia sessione ora</button>
<div style="margin-top:14px">
<button class="option">Dorato leggero<span class="desc">Un velo dorato naturale, graduale.</span></button>
<button class="option selected">Ambrato / bronzo<span class="desc">Abbronzatura media classica.</span></button>
<button class="option" disabled>Scuro intenso<span class="desc">Non raggiungibile per questo fototipo.</span></button>
</div>`,
  },
  {
    path: "components/pills.html",
    group: "Componenti",
    name: "Pill & badge",
    subtitle: "Sicurezza sessione + intensità UV",
    width: 480,
    body: `<h2>Pill di sicurezza</h2>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<span class="pill safe">80% della soglia</span>
<span class="pill aggressive">92% della soglia</span>
<span class="pill burn">136% della soglia</span>
</div>
<h2 style="margin-top:18px">Badge UV (scala OMS)</h2>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<span class="uvchip low">UV 2.1</span>
<span class="uvchip mid">UV 4.5</span>
<span class="uvchip high">UV 7.2</span>
<span class="uvchip extreme">UV 8.9</span>
</div>`,
  },
  {
    path: "components/banners.html",
    group: "Componenti",
    name: "Banner",
    subtitle: "Info / avviso / countdown",
    width: 480,
    body: `<p class="banner">Sessione in pausa: il conteggio è fermo. Riapplica la crema prima di riprendere.</p>
<p class="banner warn">UV molto alto oggi (max 8.4): acqua, occhiali e cappello · ~33°C nella finestra.</p>
<div class="banner countdown"><span>Prossima sessione tra <b>2h 14m</b> — alle <b>12:52</b> per 29 min</span></div>`,
  },
  {
    path: "components/dose-meter.html",
    group: "Componenti",
    name: "Dose meter",
    subtitle: "Verde → soglia (80%) → scottatura",
    width: 480,
    body: `<p class="muted" style="margin-top:0">Sessione sicura (60%)</p>${doseMeter(0.6)}
<p class="muted">Oltre il consigliato (90%)</p>${doseMeter(0.9)}
<p class="muted">Rischio scottatura (110%)</p>${doseMeter(1.1)}`,
  },
  {
    path: "components/session-ring.html",
    group: "Componenti",
    name: "Anello sessione",
    subtitle: "Stati: sicura / quasi soglia / pausa",
    width: 520,
    body: `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
${ring(0.42, 15, "≈ 14 min alla soglia", "var(--safe)")}
${ring(0.76, 27, "≈ 2 min alla soglia", "var(--warn)")}
${ring(0.55, 19, "in pausa", "var(--muted)")}
</div>`,
  },
  {
    path: "components/skin-preview.html",
    group: "Componenti",
    name: "Anteprima pelle",
    subtitle: "Colore attuale → obiettivo",
    width: 480,
    body: `<p class="muted" style="margin-top:0">Fototipo II · obiettivo dorato leggero</p>
${skinPreview(2, 0.06, 0.175)}
<p class="muted">Fototipo IV · obiettivo scuro intenso</p>
${skinPreview(4, 0.3, 0.675)}`,
  },
  {
    path: "components/inputs.html",
    group: "Componenti",
    name: "Input",
    subtitle: "Testo / slider / switch / selettore",
    width: 480,
    body: `<input type="text" placeholder="Es. Rimini, Catania, Milano…">
<div class="row" style="margin-top:16px"><span class="muted" style="font-size:13px">La tua durata · 12:52–13:21</span><span class="big" style="font-size:22px">29 min</span></div>
<input type="range" min="0" max="120" value="29">
<div style="margin-top:16px"><label class="toggle"><input type="checkbox" checked> Userò la protezione</label></div>
<div class="row" style="margin-top:16px"><span class="muted" style="font-size:13px">Sessioni a settimana</span><span>
<button class="ghost" style="padding:6px 10px">3</button>
<button style="padding:6px 10px">4</button>
<button class="ghost" style="padding:6px 10px">5</button>
</span></div>`,
  },
  {
    path: "components/day-list.html",
    group: "Componenti",
    name: "Liste giorno",
    subtitle: "Piano 7 giorni + storico",
    width: 480,
    body: `<h2>Prossimi 7 giorni</h2>
<div class="day"><span class="when">Gio 2 Lug</span><span style="text-align:right">12:41–13:04 · <b>23 min</b><br><span class="uv"><span class="uvchip extreme">UV 8.2</span> SPF 50</span></span></div>
<div class="day"><span class="when">Ven 3 Lug</span><span style="text-align:right">12:53–13:17 · <b>24 min</b><br><span class="uv"><span class="uvchip high">UV 7.8</span> SPF 30</span></span></div>
<div class="day"><span class="when">Sab 4 Lug</span><span class="uv" style="text-align:right;max-width:55%">UV troppo basso: giornata poco utile.</span></div>
<h2 style="margin-top:18px">Storico sessioni</h2>
<div class="day"><span class="when">Mer 1 Lug<br><span class="uv" style="text-transform:none">12:50 · 23 min · SPF</span></span><span><span class="pill safe">78% soglia</span> <button class="ghost" style="padding:4px 8px">✕</button></span></div>`,
  },
  {
    path: "components/progress.html",
    group: "Componenti",
    name: "Progresso obiettivo",
    subtitle: "Barra con marker + stima",
    width: 480,
    body: `<h2>Il tuo obiettivo: Ambrato / bronzo</h2>
${skinPreview(3, 0.22, 0.41)}
<div class="bar" style="position:relative"><span style="width:54%"></span><div style="position:absolute;top:-3px;left:75%;width:3px;height:16px;border-radius:2px;background:var(--ink)"></div></div>
<p class="muted" style="margin-top:6px">Abbronzatura attuale 54% · l'asticella scura è il tuo obiettivo.</p>
<div style="margin-top:8px"><span class="big">~8 giorni</span><span class="muted"> · 5 sessioni alla durata suggerita</span></div>`,
  },
  {
    path: "screens/onboarding.html",
    group: "Schermate",
    name: "Questionario",
    subtitle: "Fitzpatrick, passo 1",
    width: 400,
    sea: true,
    body: `<div class="card">
<div class="step-label">Passo 1 di 3 · Domanda 5 di 7</div>
<div class="bar"><span style="width:71%"></span></div>
<h1>Se stai un'ora al sole intenso di mezzogiorno senza protezione, cosa succede di solito?</h1>
<button class="option">Scottatura dolorosa con vesciche</button>
<button class="option">Mi scotto e dopo qualche giorno mi spello</button>
<button class="option selected">Mi scotto leggermente, a volte mi spello un po'</button>
<button class="option">Raramente mi scotto</button>
<button class="option">Non mi scotto mai</button>
</div>`,
  },
  {
    path: "screens/today-planning.html",
    group: "Schermate",
    name: "Oggi · pianificazione",
    subtitle: "Countdown, slider, dose, CTA",
    width: 400,
    sea: true,
    body: `<div class="card">
<div class="row"><h2 style="margin:0">Oggi</h2><label class="toggle"><input type="checkbox"> Userò la protezione</label></div>
<p class="banner warn">UV molto alto oggi (max 8.3): acqua, occhiali e cappello · ~34°C nella finestra.</p>
<div class="banner countdown"><span>Prossima sessione tra <b>1h 10m</b> — alle <b>12:41</b> per 23 min</span></div>
<p class="muted" style="margin:10px 0 4px">Finestra suggerita: <b>12:41</b> · durata consigliata <b>23 min</b> (SPF 50)</p>
<div class="row" style="margin-top:14px"><span class="muted" style="font-size:13px">La tua durata · 12:41–13:04</span><span class="big" style="font-size:22px">23 min</span></div>
<input type="range" min="0" max="120" value="23">
${doseMeter(0.81)}
<div class="row" style="margin-top:12px"><span class="pill safe">81% della soglia</span><span style="font-size:13px;text-align:right;max-width:60%">Sicura — entro la soglia consigliata</span></div>
<button class="block" style="margin-top:14px">Inizia sessione ora</button>
<button class="ghost block" style="margin-top:6px">Registra senza timer</button>
</div>`,
  },
  {
    path: "screens/today-live.html",
    group: "Schermate",
    name: "Oggi · sessione live",
    subtitle: "Anello, pausa bagno, termina",
    width: 400,
    sea: true,
    body: `<div class="card">
<div class="row"><h2 style="margin:0">Oggi</h2></div>
<p class="muted" style="margin-top:10px;margin-bottom:0">Sessione iniziata alle <b>12:41</b> · senza protezione</p>
<div style="text-align:center">${ring(0.55, 16, "≈ 7 min alla soglia", "var(--safe)")}</div>
<div class="row" style="margin-top:12px"><span class="pill safe">55% della soglia</span><span style="font-size:13px;text-align:right;max-width:60%">Sicura — entro la soglia consigliata</span></div>
<div class="row" style="margin-top:12px;gap:8px">
<button class="ghost block">Pausa bagno</button>
<button class="block">Termina (16 min)</button>
</div>
</div>`,
  },
];

// ---------- generazione ----------

for (const c of cards) {
  const harness = c.sea
    ? "body { padding: 18px; min-height: 100vh; position: relative; overflow-x: hidden; }"
    : "body { padding: 18px; min-height: auto; }";
  const html = `<!-- @dsCard group="${c.group}" name="${c.name}" subtitle="${c.subtitle}" width="${c.width}" -->
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${appCss}
/* harness della card */
${harness}
</style>
</head>
<body>
${c.sea ? `${SEA}\n` : ""}${c.body}
</body>
</html>
`;
  const out = join(outDir, c.path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log("wrote", c.path);
}

// font self-hosted usato dalle card
mkdirSync(join(outDir, "fonts"), { recursive: true });
copyFileSync(join(root, "../src/ui/fonts/sora-var.woff2"), join(outDir, "fonts/sora-var.woff2"));
console.log("wrote fonts/sora-var.woff2");
console.log(`\n${cards.length} card + font generati in design/dist/`);
