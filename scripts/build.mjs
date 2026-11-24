// Builds dist/index.html: merges the question bank, validates every item, and inlines CSS, JS and data
// into one self-contained page. No dependencies; needs Node 20 or later.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = p => fs.readFileSync(p, "utf8");
const readJson = p => JSON.parse(read(p).replace(/^\uFEFF/, ""));
const optJson = p => (fs.existsSync(p) ? readJson(p) : null);

const site = readJson(path.join(root, "content", "site.json"));
const cases = optJson(path.join(root, "content", "cases.json")) || { caseStudies: [], series: [] };
const snapshot = optJson(path.join(root, "content", "exam-snapshot.json"));
const live = optJson(path.join(root, "build", "exam-status.json")); // written by check-exam.mjs in CI

const objIds = new Set();
site.domains.forEach(d => d.objectives.forEach(o => objIds.add(o.id)));
const TYPES = new Set(["single", "multi", "yesno", "dropdown", "order"]);
const problems = [], warnings = [];

function checkQ(q, where) {
  const bad = m => { problems.push(where + " " + (q && q.id) + ": " + m); return false; };
  const warn = m => warnings.push(where + " " + q.id + ": " + m);
  if (!q || typeof q !== "object") return bad("not an object");
  if (!q.id) return bad("missing id");
  if (!TYPES.has(q.type)) return bad("unknown type " + q.type);
  if (!q.stem || !String(q.stem).trim()) return bad("empty stem");
  if (!q.explanation || !String(q.explanation).trim()) return bad("empty explanation");
  const inRange = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
  if (q.type === "single" || q.type === "multi") {
    if (!Array.isArray(q.options) || q.options.length < 2) return bad("needs options");
    if (!Array.isArray(q.answer) || !q.answer.length || !q.answer.every(i => inRange(i, q.options.length))) return bad("answer index out of range");
    if (new Set(q.answer).size !== q.answer.length) return bad("duplicate answer index");
    if (q.type === "single" && q.answer.length !== 1) return bad("single needs exactly one answer");
    if (q.type === "multi" && (q.answer.length < 2 || q.answer.length >= q.options.length)) return bad("multi needs 2+ answers and at least one distractor");
    if (new Set(q.options.map(o => String(o).trim().toLowerCase())).size !== q.options.length) warn("duplicate option text");
  } else if (q.type === "yesno") {
    if (!Array.isArray(q.statements) || q.statements.length < 2 || !q.statements.every(s => s && s.text && typeof s.answer === "boolean")) return bad("bad statements");
  } else if (q.type === "dropdown") {
    if (!Array.isArray(q.blanks) || !q.blanks.length) return bad("needs blanks");
    const found = new Set(((q.stem || "") + "\n" + (q.code || "")).match(/\[\[\d+\]\]/g) || []);
    for (let i = 1; i <= q.blanks.length; i++) if (!found.has("[[" + i + "]]")) return bad("placeholder [[" + i + "]] missing");
    if (found.size !== q.blanks.length) return bad("placeholder count " + found.size + " != blanks " + q.blanks.length);
    for (const b of q.blanks) if (!Array.isArray(b.options) || b.options.length < 2 || !inRange(b.answer, b.options.length)) return bad("bad blank");
  } else if (q.type === "order") {
    if (!Array.isArray(q.items) || q.items.length < 3) return bad("order needs 3+ items");
    if (q.distractors && !Array.isArray(q.distractors)) return bad("distractors must be an array");
  }
  if (!objIds.has(q.objective)) warn("unknown objective " + q.objective);
  if (!q.ref || !q.ref.url) warn("no reference link");
  else if (!/^https:\/\/(learn|techcommunity|devblogs)\.microsoft\.com\//.test(q.ref.url)) warn("non-Learn reference " + q.ref.url);
  if (/\b(options?|answers?|choices?)\s+[A-F]\b/.test(q.explanation) || /\b[A-F]\s+(is|are)\s+(wrong|incorrect|correct|right)\b/.test(q.explanation)) warn("explanation refers to an option letter (options are shuffled)");
  return true;
}

const questions = [], cheats = {}, triggers = [], lookup = [], flashcards = [];
site.domains.forEach(d => { cheats[d.id] = []; });
const seenIds = new Set(), seenUrls = new Set();
const qDir = path.join(root, "content", "questions");
const files = fs.readdirSync(qDir).filter(f => f.endsWith(".json")).sort();
for (const f of files) {
  let j;
  try { j = readJson(path.join(qDir, f)); } catch (e) { problems.push(f + ": invalid JSON - " + e.message); continue; }
  const part = j.part || f.replace(/\.json$/, "");
  const dom = Number(j.domain);
  (j.questions || []).forEach(q => {
    if (!checkQ(q, f)) return;
    const od = Number(String(q.objective || "").split(".")[0]);
    q.domain = cheats[od] ? od : dom;
    if (!cheats[q.domain]) { problems.push(f + " " + q.id + ": cannot place in a domain"); return; }
    if (seenIds.has(q.id)) { problems.push(f + " " + q.id + ": duplicate id"); return; }
    seenIds.add(q.id);
    q.difficulty = [1, 2, 3].includes(q.difficulty) ? q.difficulty : 2;
    q.hot = !!q.hot;
    questions.push(q);
  });
  if (!cheats[dom]) { if (j.cheatsheet || j.triggers) problems.push(f + ": bad domain " + j.domain); continue; }
  (j.cheatsheet || []).forEach(s => {
    if (!s || !s.title) return;
    if (typeof s.note === "string") s.note = s.note.replace(/^\s*trap\s*:\s*/i, "");
    if (s.note) s.note = s.note.charAt(0).toUpperCase() + s.note.slice(1);
    cheats[dom].push(s);
  });
  (j.triggers || []).forEach((t, i) => {
    if (!t || !t.when || !t.pick) return;
    triggers.push({ domain: dom, when: t.when, pick: t.pick, why: t.why || "" });
    flashcards.push({ id: "tr-" + part + "-" + i, domain: dom, kind: "trigger", front: t.when, back: t.pick + (t.why ? "\n\n" + t.why : "") });
  });
  (j.lookup || []).forEach(l => {
    if (!l || !l.url || seenUrls.has(l.url)) return;
    seenUrls.add(l.url);
    lookup.push({ domain: dom, topic: l.topic || "", search: l.search || "", url: l.url });
  });
  (j.flashcards || []).forEach((c, i) => { if (c && c.front && c.back) flashcards.push({ id: "fc-" + part + "-" + i, domain: dom, kind: "fact", front: c.front, back: c.back }); });
}

const caseStudies = (cases.caseStudies || []).map(cs => {
  const qs = (cs.questions || []).filter(q => checkQ(q, "case " + cs.id));
  qs.forEach(q => { q.domain = Number(String(q.objective).split(".")[0]); q.difficulty = q.difficulty || 2; q.hot = !!q.hot; });
  return { id: cs.id, title: cs.title, tabs: cs.tabs, questions: qs };
});
const series = (cases.series || []).map(sr => ({
  id: sr.id,
  questions: (sr.questions || []).map(x => ({
    id: x.id, domain: Number(String(x.objective).split(".")[0]), objective: x.objective, type: "single", difficulty: x.difficulty || 2, hot: !!x.hot,
    noShuffle: true, tags: x.tags || [],
    stem: "This question is part of a series that presents the same scenario. Each question proposes a different solution. More than one solution in the series might meet the goal, or none might.\n\n" +
      sr.scenario + "\n\n**Solution:** " + x.solution + "\n\nDoes this meet the goal?",
    options: ["Yes", "No"], answer: [x.meets ? 0 : 1], explanation: x.explanation, ref: x.ref
  })).filter(q => checkQ(q, "series " + sr.id))
}));

// "Last updated" is the last commit that touched content/, not the build time.
function gitDate(...paths) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cI", "--", ...paths], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch (e) { return null; }
}
const allQ = questions.concat(...caseStudies.map(c => c.questions), ...series.map(s => s.questions));
const data = {
  meta: {
    built: new Date().toISOString(),
    updated: gitDate("content") || new Date().toISOString(),
    repo: site.repo || null,
    outline: {
      asOf: (snapshot && snapshot.asOf) || site.outlineAsOf || null,
      state: live ? live.state : "unchecked",
      checkedAt: live ? live.checkedAt : null,
      liveAsOf: live ? live.liveAsOf : null
    },
    counts: { questions: allQ.length }
  },
  domains: site.domains, plan: site.plan, intel: site.intel, deltas: site.deltas,
  questions, caseStudies, series, cheats, triggers, lookup, flashcards
};

const css = read(path.join(root, "src", "styles.css"));
const jsDir = path.join(root, "src", "js");
const js = fs.readdirSync(jsDir).filter(f => f.endsWith(".js")).sort().map(f => "/* " + f + " */\n" + read(path.join(jsDir, f)).replace(/^"use strict";\s*/, "")).join("\n");
try { new vm.Script('"use strict";\n' + js, { filename: "app.js" }); } catch (e) { problems.push("JS syntax: " + e.message + (e.stack ? "\n" + e.stack.split("\n").slice(0, 4).join("\n") : "")); }
const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const html = read(path.join(root, "src", "template.html"))
  .replaceAll("__SITE_URL__", site.siteUrl || "")
  .replace("/*__CSS__*/", () => css)
  .replace("/*__DATA__*/", () => json)
  .replace("/*__JS__*/", () => '"use strict";\n' + js);

const by = (list, key) => list.reduce((m, x) => { const k = key(x); m[k] = (m[k] || 0) + 1; return m; }, {});
console.log("question files:", files.length);
console.log("questions:", allQ.length, "| bank", questions.length, "| case study", caseStudies.reduce((a, c) => a + c.questions.length, 0), "| series", series.reduce((a, s) => a + s.questions.length, 0));
console.log("by domain:", JSON.stringify(by(allQ, q => "D" + q.domain)));
console.log("by type:", JSON.stringify(by(allQ, q => q.type)));
console.log("by objective:", JSON.stringify(by(allQ, q => q.objective)));
console.log("cheat sections:", Object.values(cheats).reduce((a, c) => a + c.length, 0), "| triggers:", triggers.length, "| lookup:", lookup.length, "| flashcards:", flashcards.length);
console.log("content last updated:", data.meta.updated, "| outline:", JSON.stringify(data.meta.outline));
if (warnings.length) console.log("\nWARNINGS (" + warnings.length + "):\n  " + warnings.join("\n  "));
if (problems.length) {
  console.error("\nPROBLEMS (" + problems.length + "):\n  " + problems.join("\n  "));
  process.exit(1);
}
const out = path.join(root, "dist");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
console.log("output:", path.join(out, "index.html"), Math.round(html.length / 1024) + " KB");
