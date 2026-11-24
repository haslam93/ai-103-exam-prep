"use strict";
/* ---------- data access ---------- */
const DATA = window.AI103_DATA;
const DOM = {};
const OBJ = {};
DATA.domains.forEach(d => {
  DOM[d.id] = d;
  d.objectives.forEach(o => { OBJ[o.id] = Object.assign({ domain: d.id }, o); });
});
const QMAP = {};
const BANK = DATA.questions;
const CASEMAP = {};
const CASEQ = [];
const SERQ = [];
BANK.forEach(q => { QMAP[q.id] = q; });
(DATA.caseStudies || []).forEach(cs => {
  CASEMAP[cs.id] = cs;
  cs.questions.forEach(q => { q.caseId = cs.id; QMAP[q.id] = q; CASEQ.push(q); });
});
(DATA.series || []).forEach(sr => {
  sr.questions.forEach(q => { q.seriesId = sr.id; QMAP[q.id] = q; SERQ.push(q); });
});
const ALLQ = BANK.concat(CASEQ, SERQ);

function typeLabel(q) {
  switch (q.type) {
    case "single": return q.seriesId ? "Meets the goal?" : "Single answer";
    case "multi": return "Choose " + q.answer.length;
    case "yesno": return "Yes / No grid";
    case "dropdown": return "Drop-down";
    case "order": return "Sequence";
    default: return q.type;
  }
}
function qText(q) {
  if (q._text) return q._text;
  q._text = [q.stem, q.code, (q.options || []).join(" "), (q.statements || []).map(s => s.text).join(" "),
    (q.items || []).join(" "), (q.blanks || []).map(b => b.options.join(" ")).join(" "), q.explanation,
    (q.tags || []).join(" ")].join(" ");
  return q._text;
}
function hotMatches(topic) {
  const re = new RegExp(topic.match, "i");
  return ALLQ.filter(q => re.test(qText(q)));
}

/* ---------- responses + grading ---------- */
function initResp(q) {
  switch (q.type) {
    case "single": return null;
    case "multi": return [];
    case "yesno": return q.statements.map(() => null);
    case "dropdown": return q.blanks.map(() => null);
    default: return [];
  }
}
function makeState(q, doShuffle) {
  const st = { resp: initResp(q), done: false, peek: false, flag: false };
  const ident = n => Array.from({ length: n }, (_, i) => i);
  if (q.type === "single" || q.type === "multi") st.ord = doShuffle && !q.noShuffle ? shuffle(ident(q.options.length)) : ident(q.options.length);
  if (q.type === "dropdown") st.bord = q.blanks.map(b => (doShuffle ? shuffle(ident(b.options.length)) : ident(b.options.length)));
  if (q.type === "order") st.pool = shuffle(ident(q.items.length + (q.distractors ? q.distractors.length : 0)));
  return st;
}
function isAnswered(q, resp) {
  switch (q.type) {
    case "single": return resp != null;
    case "multi": return resp.length >= q.answer.length;
    case "yesno":
    case "dropdown": return resp.every(v => v != null);
    default: return resp.length > 0;
  }
}
/* Partial credit per part, as Microsoft scores multi-part items: right parts score, wrong ones cost nothing. */
function grade(q, resp) {
  let total = 1, earned = 0, attempted = false;
  switch (q.type) {
    case "single":
      attempted = resp != null;
      earned = resp === q.answer[0] ? 1 : 0;
      break;
    case "multi": {
      total = q.answer.length;
      attempted = resp.length > 0;
      const good = resp.filter(i => q.answer.includes(i)).length;
      earned = Math.max(0, good - Math.max(0, resp.length - q.answer.length));
      break;
    }
    case "yesno":
      total = q.statements.length;
      attempted = resp.some(v => v != null);
      earned = q.statements.filter((s, i) => resp[i] === s.answer).length;
      break;
    case "dropdown":
      total = q.blanks.length;
      attempted = resp.some(v => v != null);
      earned = q.blanks.filter((b, i) => resp[i] === b.answer).length;
      break;
    default:
      attempted = resp.length > 0;
      earned = resp.length === q.items.length && resp.every((v, i) => v === i) ? 1 : 0;
  }
  return { earned, total, attempted, full: earned === total };
}

/* ---------- history ---------- */
function histOf(id) { return Store.data.hist[id]; }
function recordResult(q, g, peeked) {
  const H = Store.data.hist;
  const r = H[q.id] || (H[q.id] = { n: 0, ok: 0 });
  r.n++;
  if (g.full && !peeked) r.ok++;
  r.e = peeked ? 0 : g.earned;
  r.t = g.total;
  r.ts = Date.now();
  Store.save();
}
function setFlag(id, on) {
  const H = Store.data.hist;
  const r = H[id] || (H[id] = { n: 0, ok: 0 });
  r.flag = !!on;
  Store.save();
}
function statusOf(id) {
  const r = Store.data.hist[id];
  if (!r || !r.n) return "unseen";
  if (r.e === r.t) return "ok";
  return r.e > 0 ? "part" : "bad";
}
function domainStats() {
  const out = {};
  DATA.domains.forEach(d => { out[d.id] = { total: 0, seen: 0, e: 0, t: 0 }; });
  ALLQ.forEach(q => {
    const s = out[q.domain];
    if (!s) return;
    s.total++;
    const r = Store.data.hist[q.id];
    if (r && r.n) { s.seen++; s.e += r.e || 0; s.t += r.t || 0; }
  });
  return out;
}
const midWeight = d => (d.weight[0] + d.weight[1]) / 2;
function readiness() {
  const st = domainStats();
  let w = 0, acc = 0, cov = 0, wAll = 0;
  DATA.domains.forEach(d => {
    const s = st[d.id], m = midWeight(d);
    wAll += m;
    if (s.t) { acc += m * (s.e / s.t); w += m; }
    cov += m * (s.total ? s.seen / s.total : 0);
  });
  return { score: w ? acc / w : null, coverage: cov / wAll, st };
}

/* ---------- mock exam assembly (blueprint-weighted) ---------- */
function allocate(n) {
  const mids = DATA.domains.map(midWeight);
  const sum = mids.reduce((a, b) => a + b, 0);
  const raw = mids.map(m => (n * m) / sum);
  const base = raw.map(Math.floor);
  let left = n - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) base[order[k][1]]++;
  const out = {};
  DATA.domains.forEach((d, i) => { out[d.id] = base[i]; });
  return out;
}
function pickForExam(targets) {
  const H = Store.data.hist;
  const ts = q => (H[q.id] && H[q.id].ts) || 0;
  const picked = [];
  const spare = {};
  let shortage = 0;
  DATA.domains.forEach(d => {
    const pool = shuffle(BANK.filter(q => q.domain === d.id)).sort((a, b) => ts(a) - ts(b)); // unseen first, then oldest
    const want = Math.max(0, targets[d.id] || 0);
    const take = pool.slice(0, want);
    picked.push(...take);
    shortage += want - take.length;
    spare[d.id] = pool.slice(want);
  });
  let moved = true;
  while (shortage > 0 && moved) {
    moved = false;
    for (const d of DATA.domains) {
      if (shortage > 0 && spare[d.id].length) { picked.push(spare[d.id].shift()); shortage--; moved = true; }
    }
  }
  return shuffle(picked);
}
function leastSeen(list) {
  const H = Store.data.hist;
  const score = x => x.questions.reduce((a, q) => Math.max(a, (H[q.id] && H[q.id].ts) || 0), 0);
  return shuffle(list).sort((a, b) => score(a) - score(b))[0];
}
function buildExam(cfg) {
  const cs = cfg.caseStudy && DATA.caseStudies && DATA.caseStudies.length ? leastSeen(DATA.caseStudies) : null;
  const sr = cfg.series && DATA.series && DATA.series.length ? leastSeen(DATA.series) : null;
  const extra = (cs ? cs.questions : []).concat(sr ? sr.questions : []);
  const mainN = Math.max(1, cfg.n - extra.length);
  const targets = allocate(cfg.n);
  extra.forEach(q => { targets[q.domain] = (targets[q.domain] || 0) - 1; });
  const ids = DATA.domains.map(d => d.id);
  ids.forEach(id => { if (targets[id] < 0) targets[id] = 0; });
  let sum = ids.reduce((a, id) => a + targets[id], 0);
  const byWeight = ids.slice().sort((a, b) => midWeight(DOM[b]) - midWeight(DOM[a]));
  let k = 0;
  while (sum < mainN) { targets[byWeight[k % byWeight.length]]++; sum++; k++; }
  while (sum > mainN) { const id = byWeight[k % byWeight.length]; if (targets[id] > 0) { targets[id]--; sum--; } k++; }
  const sections = [{ kind: "main", title: "Questions", qids: pickForExam(targets).map(q => q.id) }];
  if (sr) sections.push({ kind: "series", title: "Solution series", qids: sr.questions.map(q => q.id), seriesId: sr.id });
  if (cs) sections.push({ kind: "case", title: "Case study: " + cs.title, qids: cs.questions.map(q => q.id), caseId: cs.id });
  const st = {};
  sections.forEach(s => s.qids.forEach(id => { st[id] = makeState(QMAP[id], Store.data.settings.shuffle); }));
  return {
    cfg, startedAt: Date.now(), total: cfg.minutes * 60, left: cfg.minutes * 60, paused: false,
    sections, si: 0, qi: 0, st, spent: {}, done: false, screen: "q"
  };
}
