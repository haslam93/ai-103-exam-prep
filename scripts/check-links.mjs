// Checks every reference URL in the content (question refs, cheat-sheet refs, the Learn lookup map, sources).
// Microsoft Learn moves and retires pages often, so this runs weekly.
//
//   node scripts/check-links.mjs [--report FILE]
//
// Classifies each URL as ok, broken (404/410), moved (Learn redirected to a different page) or
// unverified (anything else: bot protection, timeouts, 5xx). Always exits 0.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const readJson = p => JSON.parse(fs.readFileSync(p, "utf8"));

const uses = new Map(); // url -> where it is used
const add = (url, where) => {
  if (!url || !/^https?:\/\//.test(url)) return;
  const clean = url.split("#")[0];
  if (!uses.has(clean)) uses.set(clean, new Set());
  uses.get(clean).add(where);
};
const qDir = path.join(root, "content", "questions");
for (const f of fs.readdirSync(qDir).filter(x => x.endsWith(".json"))) {
  const j = readJson(path.join(qDir, f));
  (j.questions || []).forEach(q => add(q.ref && q.ref.url, q.id));
  (j.cheatsheet || []).forEach(s => add(s.ref && s.ref.url, f + " cheat sheet: " + s.title));
  (j.lookup || []).forEach(l => add(l.url, f + " lookup: " + l.topic));
}
const cases = readJson(path.join(root, "content", "cases.json"));
(cases.caseStudies || []).forEach(c => c.questions.forEach(q => add(q.ref && q.ref.url, q.id)));
(cases.series || []).forEach(s => s.questions.forEach(q => add(q.ref && q.ref.url, q.id)));
const site = readJson(path.join(root, "content", "site.json"));
((site.intel && site.intel.sources) || []).forEach(s => add(s.url, "source: " + s.title));

// Learn URLs compare without the locale segment, so /en-us/ and locale-less forms are the same page.
const key = u => { try { const x = new URL(u); return x.hostname + x.pathname.replace(/^\/[a-z]{2}-[a-z]{2}\//i, "/").replace(/\/+$/, "").toLowerCase(); } catch (e) { return u; } };

async function check(url) {
  const learn = /^https:\/\/learn\.microsoft\.com\//.test(url);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow", signal: AbortSignal.timeout(25000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-103-exam-prep link check)", Accept: learn ? "text/markdown" : "text/html" }
      });
      if (res.status === 404 || res.status === 410) return { state: "broken", detail: "HTTP " + res.status };
      if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 4000)); continue; }
      if (!res.ok) return { state: "unverified", detail: "HTTP " + res.status };
      if (learn && key(res.url) !== key(url)) return { state: "moved", detail: res.url };
      return { state: "ok" };
    } catch (e) {
      if (attempt) return { state: "unverified", detail: e.name === "TimeoutError" ? "timeout" : e.message };
    }
  }
  return { state: "unverified", detail: "throttled or server error" };
}

const urls = [...uses.keys()].sort();
const results = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < urls.length) {
    const url = urls[next++];
    results.push(Object.assign({ url }, await check(url)));
  }
}));

const pick = s => results.filter(r => r.state === s).sort((a, b) => a.url.localeCompare(b.url));
const broken = pick("broken"), moved = pick("moved"), unverified = pick("unverified");
const where = u => [...uses.get(u)].slice(0, 6).join(", ") + (uses.get(u).size > 6 ? ", ..." : "");
const section = (title, list) => "### " + title + " (" + list.length + ")\n" +
  (list.length ? list.map(r => "- " + r.url + (r.detail ? "  \n  " + r.detail : "") + "  \n  Used by: " + where(r.url)).join("\n") : "- none") + "\n";
const md = [
  "Checked " + urls.length + " reference URLs: " + pick("ok").length + " ok, " + broken.length + " broken, " + moved.length + " moved, " + unverified.length + " unverified.",
  "",
  section("Broken", broken),
  section("Moved (Learn redirected to a different page; confirm that it still supports the answer)", moved),
  section("Unverified (not counted as failures)", unverified),
  "_Opened by the link-check workflow. Fix the URLs in `content/` and the issue closes on the next clean run._"
].join("\n");

console.log(md);
if (opt("--report")) {
  const file = path.resolve(root, opt("--report"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, md + "\n");
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "broken=" + broken.length + "\nmoved=" + moved.length + "\nfailing=" + (broken.length + moved.length) + "\n");
