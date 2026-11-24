// Review helper: prints a compact, human-readable dump of a researched data file.
// usage: node dump.mjs <q|cheats|cards> <file.json> [fromIndex] [toIndex]
import fs from "node:fs";
const [mode, file, from, to] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const L = "ABCDEFGH";
const out = [];
if (mode === "q") {
  const qs = j.questions || (j.caseStudies ? j.caseStudies.flatMap(c => c.questions) : []);
  qs.slice(+from || 0, to ? +to : undefined).forEach(q => {
    out.push("### " + q.id + " [" + q.type + " obj " + q.objective + " d" + q.difficulty + (q.hot ? " HOT" : "") + "]");
    out.push(q.stem);
    if (q.code) out.push("```\n" + q.code + "\n```");
    if (q.options) q.options.forEach((o, i) => out.push((q.answer.includes(i) ? " *" : "  ") + L[i] + ") " + o));
    if (q.statements) q.statements.forEach(s => out.push("  [" + (s.answer ? "Y" : "N") + "] " + s.text));
    if (q.blanks) q.blanks.forEach((b, i) => out.push("  [[" + (i + 1) + "]] " + b.options.map((o, k) => (k === b.answer ? "*" : "") + o).join(" | ")));
    if (q.items) { q.items.forEach((t, i) => out.push("  " + (i + 1) + ". " + t)); (q.distractors || []).forEach(t => out.push("  x  " + t)); }
    out.push("EXP: " + q.explanation);
    out.push("REF: " + (q.ref ? q.ref.url : "-"));
    out.push("");
  });
} else if (mode === "cheats") {
  (j.cheatsheet || []).forEach(s => {
    out.push("## " + s.title);
    if (s.columns) out.push(s.columns.join(" | "));
    (s.rows || []).forEach(r => out.push("- " + r.join(" | ")));
    (s.bullets || []).forEach(b => out.push("- " + b));
    if (s.code) out.push("```\n" + s.code + "\n```");
    if (s.note) out.push("TRAP: " + s.note);
    out.push("");
  });
  out.push("## TRIGGERS");
  (j.triggers || []).forEach(t => out.push("- " + t.when + " => " + t.pick + " (" + t.why + ")"));
} else {
  (j.flashcards || []).forEach(c => out.push("- " + c.front + " => " + c.back));
  out.push("## LOOKUP");
  (j.lookup || []).forEach(l => out.push("- " + l.topic + " | " + l.search + " | " + l.url));
}
console.log(out.join("\n"));
