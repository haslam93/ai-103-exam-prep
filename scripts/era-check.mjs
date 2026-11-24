// Flags vocabulary that postdates the exam outline inside the visible text of questions
// (stems, options, code). Explanations may mention newer names; visible text should use the exam's wording.
// Informational: prints findings and always exits 0.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const terms = [/Foundry IQ \(Azure AI Search\)/i, /Foundry User\b/, /Foundry Agent Consumer/, /Foundry Project Manager/, /Foundry Account Owner/, /Foundry Owner\b/,
  /blocking level/i, /agentic mode/i, /\bToolbox\b/i, /routing_config/, /2026-06-06/, /2026-10-01/, /kind: voice/];
const visible = q => [q.stem, q.code || "", ...(q.options || []), ...(q.statements || []).map(s => s.text), ...(q.items || []), ...(q.distractors || []),
  ...(q.blanks || []).flatMap(b => b.options)].join("\n");

const qDir = path.join(root, "content", "questions");
const files = fs.readdirSync(qDir).filter(f => f.endsWith(".json")).map(f => path.join(qDir, f)).concat(path.join(root, "content", "cases.json"));
let n = 0;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const qs = j.questions || (j.caseStudies || []).flatMap(c => c.questions)
    .concat((j.series || []).flatMap(s => s.questions.map(x => ({ id: x.id, stem: s.scenario + " " + x.solution }))));
  for (const q of qs) {
    const hits = terms.filter(t => t.test(visible(q))).map(String);
    if (hits.length) { n++; console.log(q.id + ": " + hits.join(", ")); }
  }
}
console.log(n ? n + " question(s) use post-outline vocabulary in visible text. Move the newer name into the explanation." : "No post-outline vocabulary in visible question text.");
