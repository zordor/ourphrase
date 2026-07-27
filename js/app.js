// PassPhrase — app controller. No frameworks, no network, no analytics.
import {
  createInvite, encodeInvite, decodeInvite, masterKeyFromInvite, checkByte,
  b64urlEncode, b64urlDecode, windowIndex, windowRemainingMs,
  wordsForWindow, STEP_SECONDS,
} from "./crypto-engine.js";
import { getDictionary, DICTIONARIES } from "./dictionaries.js";
import { makeQR } from "./qr.js";
import { generateSeed, encryptVault, decryptVault } from "./vault.js";

// ---------------------------------------------------------------------------
// i18n (UI language auto-detected; word language is chosen per contact)
// ---------------------------------------------------------------------------
const STRINGS = {
  es: {
    appTitle: "PassPhrase",
    emptyTitle: "Palabras secretas compartidas",
    emptyBody: "Conecta con alguien de confianza. Los dos veréis las mismas dos palabras, que cambian cada 5 minutos. Si coinciden, sabéis que sois vosotros.",
    newContact: "Nuevo contacto",
    nameLabel: "¿Cómo llamas a este grupo o persona?",
    namePlaceholder: "Familia, Trabajo…",
    langLabel: "Idioma de las palabras",
    continueBtn: "Continuar",
    shareTitle: "Conectar: {name}",
    step1: "1 · Envíale este enlace",
    shareLink: "Enviar enlace",
    linkCopied: "Enlace copiado. Pégalo en un mensaje.",
    step2: "2 · Dile este PIN de viva voz, en persona o por llamada",
    pinNote: "El PIN nunca viaja en el enlace. No lo envíes por escrito.",
    togetherQ: "¿Estáis en el mismo sitio?",
    showQr: "Mostrar código QR",
    qrHint: "Que apunte con la cámara del móvil. Con esto no hace falta PIN.",
    done: "Listo",
    joinTitle: "Te invitan a «{name}»",
    joinBody: "Escribe el PIN de 4 números que te han dicho de viva voz.",
    joinBtn: "Conectar",
    cancel: "Ahora no",
    pinWrong: "Ese PIN no coincide. Pídelo otra vez.",
    verifyHint: "Decíos las palabras. Si coinciden, sois vosotros.",
    prevHint: "Hace un momento: {words}",
    reshare: "Invitar de nuevo",
    delete: "Eliminar",
    deleteConfirm: "¿Eliminar «{name}»? Para verificaros de nuevo tendréis que volver a conectar.",
    badLink: "Este enlace de invitación no es válido.",
    backup: "Copia de seguridad",
    restoreEntry: "Recuperar una copia",
    backupHint: "Guarda tus contactos en un fichero cifrado. Tú guardas el fichero donde quieras y las palabras en papel. Sin servidores.",
    makeBackup: "Descargar copia cifrada",
    staleBackup: "Tienes cambios que aún no están en la copia. Descarga una nueva.",
    showWords: "Ver mis palabras",
    wordsNote: "Apunta estas 20 palabras en papel, en orden, y guárdalas bien. Sin ellas el fichero no se puede abrir. No cambian aunque hagas copias nuevas.",
    wordsDone: "Ya las tengo · Descargar fichero",
    restoreTitle: "¿Vienes de otro móvil? Recupera tu copia",
    chooseFile: "Elegir fichero de copia",
    typeWords: "Escribe aquí las 20 palabras, separadas por espacios",
    restoreBtn: "Recuperar",
    restoreNeedBoth: "Falta el fichero o las palabras.",
    badWords: "Esas palabras no abren este fichero. Revisa el orden y la escritura.",
    badFile: "Ese fichero no parece una copia de PassPhrase.",
    restoreOk: "Recuperado: {n} contactos.",
    scanInvite: "Escanear invitación",
    scanTitle: "Escanear",
    scanHint: "Apunta al código que te enseña la otra persona.",
    scanCameraError: "No se pudo abrir la cámara. Revisa el permiso de cámara, o usa el enlace de invitación.",
    scanNotInvite: "Ese código no es una invitación de PassPhrase.",
    scanIsInstallQr: "Ese es el código de instalar la app. Pide el código de «Conectar».",
    qrTabInstall: "Instalar la app",
    qrTabPair: "Conectar",
    qrCaptionPair: "Que abra PassPhrase y pulse «Escanear invitación». Con esto no hace falta PIN.",
    qrCaptionInstall: "¿Aún no tiene la app? Que escanee esto con la cámara del móvil y siga los pasos. Después enséñale el código de «Conectar».",
    installTitle: "Instala PassPhrase en tu móvil",
    installThen: "Cuando la tengas instalada, ábrela y pulsa «Escanear invitación» para conectar con quien te invitó.",
  },
  en: {
    appTitle: "PassPhrase",
    emptyTitle: "Shared secret words",
    emptyBody: "Connect with someone you trust. You will both see the same two words, changing every 5 minutes. If they match, you know it's really you.",
    newContact: "New contact",
    nameLabel: "What do you call this group or person?",
    namePlaceholder: "Family, Work…",
    langLabel: "Language of the words",
    continueBtn: "Continue",
    shareTitle: "Connect: {name}",
    step1: "1 · Send them this link",
    shareLink: "Send link",
    linkCopied: "Link copied. Paste it into a message.",
    step2: "2 · Tell them this PIN out loud, in person or on a call",
    pinNote: "The PIN never travels in the link. Don't send it in writing.",
    togetherQ: "Are you in the same place?",
    showQr: "Show QR code",
    qrHint: "Have them point their phone camera at it. No PIN needed this way.",
    done: "Done",
    joinTitle: "You're invited to “{name}”",
    joinBody: "Type the 4-digit PIN they told you out loud.",
    joinBtn: "Connect",
    cancel: "Not now",
    pinWrong: "That PIN doesn't match. Ask for it again.",
    verifyHint: "Say the words to each other. If they match, it's really you.",
    prevHint: "A moment ago: {words}",
    reshare: "Invite again",
    delete: "Delete",
    deleteConfirm: "Delete “{name}”? You'll have to connect again to verify each other.",
    badLink: "This invitation link is not valid.",
    backup: "Backup",
    restoreEntry: "Restore a backup",
    backupHint: "Save your contacts in an encrypted file. You keep the file anywhere you like and the words on paper. No servers.",
    makeBackup: "Download encrypted backup",
    staleBackup: "You have changes not yet in the backup. Download a fresh one.",
    showWords: "Show my words",
    wordsNote: "Write these 20 words on paper, in order, and keep them safe. Without them the file cannot be opened. They stay the same for future backups.",
    wordsDone: "Got them · Download file",
    restoreTitle: "Coming from another phone? Restore your backup",
    chooseFile: "Choose backup file",
    typeWords: "Type the 20 words here, separated by spaces",
    restoreBtn: "Restore",
    restoreNeedBoth: "The file or the words are missing.",
    badWords: "Those words don't open this file. Check the order and spelling.",
    badFile: "That file doesn't look like a PassPhrase backup.",
    restoreOk: "Restored: {n} contacts.",
    scanInvite: "Scan invitation",
    scanTitle: "Scan",
    scanHint: "Point at the code the other person is showing you.",
    scanCameraError: "Couldn't open the camera. Check the camera permission, or use the invitation link.",
    scanNotInvite: "That code is not a PassPhrase invitation.",
    scanIsInstallQr: "That's the install-the-app code. Ask for the “Connect” code.",
    qrTabInstall: "Install the app",
    qrTabPair: "Connect",
    qrCaptionPair: "Have them open PassPhrase and tap “Scan invitation”. No PIN needed this way.",
    qrCaptionInstall: "Don't have the app yet? Have them scan this with the phone camera and follow the steps. Then show them the “Connect” code.",
    installTitle: "Install PassPhrase on your phone",
    installThen: "Once installed, open it and tap “Scan invitation” to connect with whoever invited you.",
  },
};

const INSTALL_STEPS = {
  es: {
    ios: [
      "Toca el botón Compartir de Safari (el cuadrado con la flecha hacia arriba).",
      "Elige «Añadir a pantalla de inicio».",
      "Abre PassPhrase desde el icono nuevo.",
    ],
    other: [
      "Abre el menú del navegador (⋮).",
      "Elige «Instalar aplicación» o «Añadir a pantalla de inicio».",
      "Abre PassPhrase desde el icono nuevo.",
    ],
  },
  en: {
    ios: [
      "Tap Safari's Share button (the square with the arrow pointing up).",
      "Choose “Add to Home Screen”.",
      "Open PassPhrase from the new icon.",
    ],
    other: [
      "Open the browser menu (⋮).",
      "Choose “Install app” or “Add to Home Screen”.",
      "Open PassPhrase from the new icon.",
    ],
  },
};
const UI_LANG = (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
const L = STRINGS[UI_LANG];
const t = (key, vars = {}) =>
  L[key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// ---------------------------------------------------------------------------
// storage
// ---------------------------------------------------------------------------
const STORE_KEY = "passphrase.contacts.v1";

function loadContacts() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function saveContacts(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

// contact: { id, name, lang, key(b64url), invite{...pin}, hue, created }
let contacts = loadContacts();
let current = null;        // contact shown on verify screen
let pendingInvite = null;  // invite being joined (from link)

function hueFromKey(keyB64) {
  const k = b64urlDecode(keyB64);
  return ((k[0] << 8) | k[1]) % 360;
}

async function contactFromInvite(invite, pin) {
  const key = await masterKeyFromInvite(invite, pin);
  const keyB64 = b64urlEncode(key);
  return {
    id: invite.s1.slice(0, 12),
    name: invite.n || "—",
    lang: invite.l,
    key: keyB64,
    invite: { ...invite, pin },
    hue: hueFromKey(keyB64),
    created: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// navigation
// ---------------------------------------------------------------------------
const screens = {};
for (const el of document.querySelectorAll(".screen")) {
  screens[el.id.replace("screen-", "")] = el;
}
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  if (name === "home") renderHome();
  if (name !== "verify") stopTicker();
  if (name !== "scan") stopScanner();
}

// static i18n fill
for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = t(el.dataset.i18n);
}
document.getElementById("new-name").placeholder = t("namePlaceholder");
document.getElementById("restore-words").placeholder = t("typeWords");
document.documentElement.lang = UI_LANG;

// ---------------------------------------------------------------------------
// home
// ---------------------------------------------------------------------------
function renderHome() {
  const list = document.getElementById("contact-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";
  empty.hidden = contacts.length > 0;
  for (const c of contacts) {
    const btn = document.createElement("button");
    btn.className = "contact";
    btn.style.setProperty("--h", c.hue);
    btn.innerHTML = `
      <span class="dot"></span>
      <span class="c-name"></span>
      <span class="c-lang"></span>
      <span class="chev">›</span>`;
    btn.querySelector(".c-name").textContent = c.name;
    btn.querySelector(".c-lang").textContent = DICTIONARIES[c.lang]?.name || c.lang;
    btn.addEventListener("click", () => openVerify(c));
    list.appendChild(btn);
  }
  // backup entry point: restore-focused when empty, backup-focused otherwise
  const entry = document.getElementById("btn-backup-entry");
  entry.textContent = contacts.length ? t("backup") : t("restoreEntry");
  if (contacts.length && backupIsStale()) {
    const dot = document.createElement("span");
    dot.className = "stale-dot";
    entry.appendChild(dot);
  }
}

// ---------------------------------------------------------------------------
// verify (words + ring)
// ---------------------------------------------------------------------------
let ticker = null;
let shownWindow = null;

function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = null; }
  shownWindow = null;
}

function openVerify(contact) {
  current = contact;
  document.documentElement.style.setProperty("--hue", contact.hue);
  document.getElementById("verify-name").textContent = contact.name;
  show("verify");
  stopTicker();
  tick();
  ticker = setInterval(tick, 500);
}

async function tick() {
  if (!current) return;
  const now = Date.now();
  const win = windowIndex(now);
  const remaining = windowRemainingMs(now);
  const stepMs = STEP_SECONDS * 1000;

  // ring + countdown
  const frac = remaining / stepMs;
  const CIRC = 188.5;
  document.getElementById("ring-fg").style.strokeDashoffset = (CIRC * (1 - frac)).toFixed(1);
  const secs = Math.ceil(remaining / 1000);
  document.getElementById("ring-time").textContent =
    `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  if (win !== shownWindow) {
    shownWindow = win;
    const key = b64urlDecode(current.key);
    const dict = getDictionary(current.lang).words;
    const [w1, w2] = await wordsForWindow(key, win, dict);
    const prev = await wordsForWindow(key, win - 1, dict);
    setWord("word-1", w1);
    setWord("word-2", w2);
    const hint = document.getElementById("prev-hint");
    hint.textContent = t("prevHint", { words: prev.map(up).join(" · ") });
    hint.hidden = false;
  }
  // previous-window hint only while clocks could still disagree
  const elapsed = stepMs - remaining;
  document.getElementById("prev-hint").hidden = elapsed > 60_000;
}

const up = (w) => w.toLocaleUpperCase(current?.lang === "es" ? "es" : "en");
function setWord(id, word) {
  const el = document.getElementById(id);
  el.style.animation = "none";
  void el.offsetWidth; // restart the entry animation
  el.style.animation = "";
  el.textContent = up(word);
}

// resume cleanly when iOS re-activates the PWA
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && current && !screens.verify.hidden) tick();
});

// ---------------------------------------------------------------------------
// new contact + share
// ---------------------------------------------------------------------------
document.getElementById("btn-new").addEventListener("click", () => {
  show("new");
  setTimeout(() => document.getElementById("new-name").focus(), 350);
});

let newLang = UI_LANG in DICTIONARIES ? UI_LANG : "es";
document.getElementById("lang-seg").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  newLang = btn.dataset.lang;
  for (const b of document.querySelectorAll(".seg-btn")) {
    b.classList.toggle("selected", b === btn);
  }
});
// preselect segment matching UI language
for (const b of document.querySelectorAll(".seg-btn")) {
  b.classList.toggle("selected", b.dataset.lang === newLang);
}

document.getElementById("form-new").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("new-name").value.trim();
  if (!name) return;
  const invite = createInvite(name, newLang);
  const contact = await contactFromInvite(invite, invite.pin);
  contact.invite.c = await checkByte(b64urlDecode(contact.key));
  contacts.push(contact);
  saveContacts(contacts);
  current = contact;
  document.getElementById("new-name").value = "";
  openShare(contact);
});

function baseUrl() {
  return location.origin === "null" || location.protocol === "file:"
    ? location.href.split("#")[0]
    : location.origin + location.pathname;
}

function inviteUrl(contact, includePin) {
  const payload = { ...contact.invite };
  const pin = payload.pin;
  delete payload.pin;
  const enc = encodeInvite({ ...payload, pin }, { includePin });
  return `${baseUrl()}#i=${enc}`;
}

function openShare(contact) {
  current = contact;
  document.documentElement.style.setProperty("--hue", contact.hue);
  document.getElementById("share-title").textContent = t("shareTitle", { name: contact.name });
  document.getElementById("share-pin").textContent = contact.invite.pin;
  document.getElementById("qr-box").hidden = true;
  setQrTab("pair");
  show("share");
}

document.getElementById("btn-share-link").addEventListener("click", async () => {
  const url = inviteUrl(current, false);
  if (navigator.share) {
    try { await navigator.share({ url }); return; }
    catch (err) { if (err && err.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    alert(t("linkCopied"));
  } catch {
    prompt("URL", url);
  }
});

// two QRs on the share screen: "connect" (secret invite) and "install the app"
// (plain project URL, safe to scan with the phone camera — no secrets inside)
let qrTab = "pair";
function setQrTab(tab) {
  qrTab = tab;
  for (const b of document.querySelectorAll("#qr-tabs .seg-btn")) {
    b.classList.toggle("selected", b.dataset.qrtab === tab);
  }
}
function renderQr() {
  const url = qrTab === "pair" ? inviteUrl(current, true) : `${baseUrl()}#install`;
  const matrix = makeQR(url);
  const canvas = document.getElementById("qr-canvas");
  const n = matrix.length;
  const scale = Math.floor(512 / (n + 8));
  const px = (n + 8) * scale;
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (matrix[r][c]) ctx.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
  }
  document.getElementById("qr-caption").textContent =
    t(qrTab === "pair" ? "qrCaptionPair" : "qrCaptionInstall");
}
document.getElementById("btn-show-qr").addEventListener("click", () => {
  const box = document.getElementById("qr-box");
  box.hidden = !box.hidden;
  if (!box.hidden) renderQr();
});
document.getElementById("qr-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-qrtab]");
  if (!b) return;
  setQrTab(b.dataset.qrtab);
  renderQr();
});

document.getElementById("btn-share-done").addEventListener("click", () => openVerify(current));
document.getElementById("btn-reshare").addEventListener("click", () => openShare(current));
document.getElementById("btn-delete").addEventListener("click", () => {
  if (!confirm(t("deleteConfirm", { name: current.name }))) return;
  contacts = contacts.filter((c) => c.id !== current.id);
  saveContacts(contacts);
  current = null;
  show("home");
});

// ---------------------------------------------------------------------------
// backup / restore (encrypted vault + 20-word phrase)
// ---------------------------------------------------------------------------
const SEED_KEY = "passphrase.seed.v1";
const BACKUP_SIG_KEY = "passphrase.backupsig.v1";
const contactsSig = () => contacts.map((c) => c.id).sort().join(",");
const backupIsStale = () =>
  !!localStorage.getItem(SEED_KEY) &&
  localStorage.getItem(BACKUP_SIG_KEY) !== contactsSig();

let restoreFileText = null;

function openBackup() {
  document.getElementById("backup-menu").hidden = false;
  document.getElementById("backup-words").hidden = true;
  document.getElementById("backup-make-card").hidden = contacts.length === 0;
  document.getElementById("btn-show-words").hidden = !localStorage.getItem(SEED_KEY);
  document.getElementById("backup-stale").hidden = !backupIsStale();
  document.getElementById("restore-error").hidden = true;
  document.getElementById("restore-file-name").hidden = true;
  document.getElementById("restore-words").value = "";
  document.getElementById("restore-file").value = "";
  restoreFileText = null;
  show("backup");
}
document.getElementById("btn-backup-entry").addEventListener("click", openBackup);

function showWordsGrid(seed) {
  const grid = document.getElementById("words-grid");
  grid.innerHTML = "";
  for (const w of seed.split(" ")) {
    const span = document.createElement("span");
    span.textContent = w;
    grid.appendChild(span);
  }
  document.getElementById("backup-menu").hidden = true;
  document.getElementById("backup-words").hidden = false;
}

async function exportVault(seed) {
  const text = await encryptVault({ v: 1, exported: Date.now(), contacts }, seed);
  const name = `passphrase-copia-${new Date().toISOString().slice(0, 10)}.txt`;
  const file = new File([text], name, { type: "text/plain" });
  let shared = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); shared = true; }
    catch (err) { if (err && err.name === "AbortError") return; }
  }
  if (!shared) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }
  localStorage.setItem(BACKUP_SIG_KEY, contactsSig());
  openBackup();
}

document.getElementById("btn-make-backup").addEventListener("click", async () => {
  let seed = localStorage.getItem(SEED_KEY);
  if (!seed) {
    const dictLang = UI_LANG in DICTIONARIES ? UI_LANG : "es";
    seed = generateSeed(getDictionary(dictLang).words, 20).join(" ");
    localStorage.setItem(SEED_KEY, seed);
    showWordsGrid(seed); // first time: make them write the words down
  } else {
    await exportVault(seed);
  }
});
document.getElementById("btn-show-words").addEventListener("click", () => {
  showWordsGrid(localStorage.getItem(SEED_KEY));
});
document.getElementById("btn-words-done").addEventListener("click", () => {
  exportVault(localStorage.getItem(SEED_KEY));
});

document.getElementById("btn-choose-file").addEventListener("click", () => {
  document.getElementById("restore-file").click();
});
document.getElementById("restore-file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  restoreFileText = await f.text();
  const nameEl = document.getElementById("restore-file-name");
  nameEl.textContent = f.name;
  nameEl.hidden = false;
  document.getElementById("restore-error").hidden = true;
});

document.getElementById("btn-restore").addEventListener("click", async () => {
  const words = document.getElementById("restore-words").value.trim();
  const errEl = document.getElementById("restore-error");
  const fail = (msg) => { errEl.textContent = msg; errEl.hidden = false; };
  if (!restoreFileText || !words) return fail(t("restoreNeedBoth"));
  let payload;
  try {
    payload = await decryptVault(restoreFileText, words);
  } catch (err) {
    return fail(t(err.message === "bad-file" ? "badFile" : "badWords"));
  }
  let added = 0;
  for (const c of payload.contacts || []) {
    if (!contacts.find((x) => x.id === c.id)) { contacts.push(c); added++; }
  }
  saveContacts(contacts);
  // adopt the phrase so this device can keep updating the same backup
  if (!localStorage.getItem(SEED_KEY)) localStorage.setItem(SEED_KEY, words);
  localStorage.setItem(BACKUP_SIG_KEY, contactsSig());
  alert(t("restoreOk", { n: added }));
  show("home");
});

// ---------------------------------------------------------------------------
// join flow (invite link opened)
// ---------------------------------------------------------------------------
async function joinFromInvite(invite) {
  const existing = contacts.find((c) => c.invite?.s1 === invite.s1);
  if (existing) { openVerify(existing); return; }

  if (invite.p) {
    // QR variant: PIN embedded, no typing needed
    const contact = await contactFromInvite(invite, invite.p);
    delete contact.invite.p;
    contacts.push(contact);
    saveContacts(contacts);
    openVerify(contact);
    return;
  }
  pendingInvite = invite;
  document.getElementById("join-title").textContent = t("joinTitle", { name: invite.n || "?" });
  document.getElementById("join-error").hidden = true;
  document.getElementById("join-pin").value = "";
  show("join");
  setTimeout(() => document.getElementById("join-pin").focus(), 350);
}

async function handleInviteHash() {
  const m = location.hash.match(/^#i=([A-Za-z0-9_-]+)$/);
  if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);
  let invite;
  try { invite = decodeInvite(m[1]); }
  catch { alert(t("badLink")); return false; }
  await joinFromInvite(invite);
  return true;
}

// ---------------------------------------------------------------------------
// in-app QR scanner (jsQR loaded lazily; the invited person scans from INSIDE
// the installed app so the pairing lands in the right storage on iOS)
// ---------------------------------------------------------------------------
let jsqrLoading = null;
function loadJsQR() {
  if (globalThis.jsQR) return Promise.resolve();
  if (!jsqrLoading) {
    jsqrLoading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "js/vendor/jsQR.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return jsqrLoading;
}

let scanStream = null;
let scanRAF = 0;
let scanLastErr = 0;

function stopScanner() {
  if (scanRAF) { cancelAnimationFrame(scanRAF); scanRAF = 0; }
  if (scanStream) {
    for (const tr of scanStream.getTracks()) tr.stop();
    scanStream = null;
  }
  const video = document.getElementById("scan-video");
  if (video) video.srcObject = null;
}

async function openScanner() {
  show("scan");
  const errEl = document.getElementById("scan-error");
  errEl.hidden = true;
  try {
    await loadJsQR();
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    const video = document.getElementById("scan-video");
    video.srcObject = scanStream;
    await video.play();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let last = 0;
    const loop = (ts) => {
      scanRAF = requestAnimationFrame(loop);
      if (ts - last < 160 || video.readyState < 2 || !video.videoWidth) return;
      last = ts;
      const scale = Math.min(1, 720 / video.videoWidth);
      canvas.width = Math.floor(video.videoWidth * scale);
      canvas.height = Math.floor(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = globalThis.jsQR(img.data, img.width, img.height);
      if (found && found.data) handleScan(found.data);
    };
    scanRAF = requestAnimationFrame(loop);
  } catch {
    stopScanner();
    errEl.textContent = t("scanCameraError");
    errEl.hidden = false;
  }
}

function showScanError(msg) {
  const now = Date.now();
  if (now - scanLastErr < 1500) return; // keep scanning, don't flicker
  scanLastErr = now;
  const errEl = document.getElementById("scan-error");
  errEl.textContent = msg;
  errEl.hidden = false;
}

function handleScan(text) {
  const m = String(text).match(/#i=([A-Za-z0-9_-]+)/);
  if (!m) {
    showScanError(String(text).includes("#install") ? t("scanIsInstallQr") : t("scanNotInvite"));
    return;
  }
  let invite;
  try { invite = decodeInvite(m[1]); }
  catch { showScanError(t("scanNotInvite")); return; }
  stopScanner();
  joinFromInvite(invite);
}

document.getElementById("btn-scan").addEventListener("click", openScanner);
document.getElementById("btn-scan-close").addEventListener("click", () => show("home"));

// ---------------------------------------------------------------------------
// install instructions (reached by scanning the install QR with the camera)
// ---------------------------------------------------------------------------
function isStandalone() {
  return navigator.standalone === true ||
    (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
}

function renderInstallScreen() {
  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  const steps = INSTALL_STEPS[UI_LANG][isIos ? "ios" : "other"];
  const ol = document.getElementById("install-steps");
  ol.innerHTML = "";
  for (const s of steps) {
    const li = document.createElement("li");
    li.textContent = s;
    ol.appendChild(li);
  }
}

async function tryJoin() {
  const pin = document.getElementById("join-pin").value.trim();
  if (!/^\d{4}$/.test(pin)) return;
  const contact = await contactFromInvite(pendingInvite, pin);
  if (typeof pendingInvite.c === "number") {
    const cb = await checkByte(b64urlDecode(contact.key));
    if (cb !== pendingInvite.c) {
      document.getElementById("join-error").hidden = false;
      document.getElementById("join-pin").value = "";
      document.getElementById("join-pin").focus();
      return;
    }
  }
  pendingInvite = null;
  contacts.push(contact);
  saveContacts(contacts);
  openVerify(contact);
}

document.getElementById("btn-join").addEventListener("click", tryJoin);
document.getElementById("join-pin").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  document.getElementById("join-error").hidden = true;
  if (e.target.value.length === 4) tryJoin();
});

// generic back-nav buttons
document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (!nav) return;
  if (nav.dataset.nav === "verify" && current) openVerify(current);
  else show("home");
});

// handle a new invite arriving while the app is already open
window.addEventListener("hashchange", () => { handleInviteHash(); });

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

(async () => {
  if (location.hash === "#install") {
    history.replaceState(null, "", location.pathname + location.search);
    if (!isStandalone()) {
      renderInstallScreen();
      show("install");
      return;
    }
  }
  const handled = await handleInviteHash();
  if (!handled) show("home");
})();
