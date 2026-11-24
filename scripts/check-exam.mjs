// Compares the live AI-103 study guide with the snapshot this content is aligned to.
//
//   node scripts/check-exam.mjs                 print the result
//   node scripts/check-exam.mjs --out FILE      also write a status JSON (the build reads build/exam-status.json)
//   node scripts/check-exam.mjs --report FILE   also write a Markdown report (used as the issue body)
//   node scripts/check-exam.mjs --update        re-baseline content/exam-snapshot.json from the live page
//   node scripts/check-exam.mjs --record FILE   write the result to FILE if the last record is over 30 days old
//
// Always exits 0 unless --update fails: a network error must not block a deployment.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUIDE = "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103";
const SNAPSHOT = path.join(root, "content", "exam-snapshot.json");
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const norm = s => s.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
const sha = lines => crypto.createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);

// Learn serves Markdown when asked, which is far more stable to parse than the HTML page.
async function fetchGuide() {
  const res = await fetch(GUIDE, { headers: { Accept: "text/markdown", "User-Agent": "ai-103-exam-prep outline watcher" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

function parseGuide(md) {
  const versions = [], notices = [];
  let cur = null;
  for (const raw of md.replace(/^---[\s\S]*?\n---\s*/, "").split(/\r?\n/)) {
    const line = norm(raw);
    if (!line) continue;
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      cur = /^Skills measured/i.test(h2[1]) ? { title: h2[1], lines: [] } : null;
      if (cur) versions.push(cur);
    } else if (cur) {
      if (/^#{3,4} /.test(line) || /^[-*] /.test(line)) cur.lines.push(line.replace(/^\* /, "- "));
    } else if (/will be updated on|\bretire[ds]?\b|\bretirement\b|\bretiring\b|\breplaced by\b/i.test(line) && line[0] !== "|") {
      notices.push(line);
    }
  }
  versions.forEach(v => {
    v.asOf = (/(?:as of|prior to)\s+(.+)$/i.exec(v.title) || [])[1] || null;
    v.hash = sha(v.lines);
  });
  return { versions, notices };
}

const current = v => v.versions.find(x => /as of/i.test(x.title)) || v.versions[0] || null;

function compare(snap, live) {
  const a = snap.versions.map(v => v.title + ":" + v.hash).join("|") + "#" + sha(snap.notices || []);
  const b = live.versions.map(v => v.title + ":" + v.hash).join("|") + "#" + sha(live.notices || []);
  return a === b;
}

function report(snap, live) {
  const s = current(snap), l = current(live);
  const before = new Set(s ? s.lines : []), after = new Set(l ? l.lines : []);
  const added = [...after].filter(x => !before.has(x)), removed = [...before].filter(x => !after.has(x));
  const oldNotices = new Set(snap.notices || []);
  const newNotices = (live.notices || []).filter(x => !oldNotices.has(x));
  const list = xs => (xs.length ? xs.map(x => "- " + x.replace(/^[-#]+ /, "")).join("\n") : "- none");
  return [
    "The [AI-103 study guide](" + GUIDE + ") no longer matches the snapshot that this content is aligned to.",
    "",
    "| | |",
    "| --- | --- |",
    "| Content is aligned to | " + (s ? s.title : "unknown") + " (captured " + (snap.capturedAt || "").slice(0, 10) + ") |",
    "| Study guide now lists | " + (live.versions.map(v => v.title).join("; ") || "nothing recognisable") + " |",
    "",
    "### Lines added to the current outline",
    list(added),
    "",
    "### Lines removed from the outline",
    list(removed),
    "",
    "### New notices on the page",
    list(newNotices),
    "",
    "### What to do",
    "1. Read the change log table in the study guide and decide which skill areas are affected.",
    "2. Update `content/site.json` (skill areas, objectives, weights) and the affected questions, cheat sheets and flashcards in `content/questions/`. `docs/AUTHORING.md` has the rules.",
    "3. Run `node scripts/check-exam.mjs --update` to re-baseline the snapshot, then `node scripts/build.mjs`.",
    "4. Open a pull request. Once the new snapshot is merged, the warning banner on the site clears and this issue can be closed.",
    "",
    "_Opened by the exam-watch workflow. The body is refreshed on each run while the issue stays open._"
  ].join("\n");
}

function setOutput(pairs) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(pairs).map(([k, v]) => k + "=" + String(v).replace(/\r?\n/g, " ")).join("\n") + "\n");
}
function write(file, text) {
  fs.mkdirSync(path.dirname(path.resolve(root, file)), { recursive: true });
  fs.writeFileSync(path.resolve(root, file), text);
}

const checkedAt = new Date().toISOString();
const snap = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) : null;
let live = null, error = null;
try {
  live = parseGuide(await fetchGuide());
  if (!live.versions.length) throw new Error("no 'Skills measured' section found; the page layout may have changed");
} catch (e) { error = e.message; }

if (flag("--update")) {
  if (!live) { console.error("Cannot update the snapshot: " + error); process.exit(1); }
  const c = current(live);
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ source: GUIDE, capturedAt: checkedAt, asOf: c.asOf, versions: live.versions, notices: live.notices }, null, 2) + "\n");
  console.log("Snapshot updated: " + c.title + " (" + c.lines.length + " lines)");
  process.exit(0);
}

let state = "unknown";
if (live && snap) state = compare(snap, live) ? "match" : "changed";
const liveCur = live ? current(live) : null;
const status = {
  state, checkedAt,
  alignedTo: snap ? snap.asOf : null,
  liveAsOf: liveCur ? liveCur.asOf : null,
  liveTitles: live ? live.versions.map(v => v.title) : [],
  error
};
console.log(JSON.stringify(status, null, 2));
if (opt("--out")) write(opt("--out"), JSON.stringify(status, null, 2) + "\n");
if (opt("--report") && state === "changed") write(opt("--report"), report(snap, live) + "\n");
// Scheduled workflows are disabled after 60 days without repository activity, so the watcher
// records its result in a tracked file about once a month and commits it.
if (opt("--record") && state !== "unknown") {
  let last = 0;
  try { last = Date.parse(JSON.parse(fs.readFileSync(path.resolve(root, opt("--record")), "utf8")).checkedAt) || 0; } catch (e) { /* first run */ }
  if (Date.now() - last > 30 * 864e5) write(opt("--record"), JSON.stringify({ checkedAt, state, liveAsOf: status.liveAsOf }, null, 2) + "\n");
}
setOutput({ state, changed: state === "changed", live_as_of: status.liveAsOf || "" });
