"use strict";
/* ---------- mock exam: sections, timer, palette, results ---------- */
const Exam = {
  S: null, R: null, showResults: false, timer: null, caseUi: { tab: 0 }, revFilter: "all",
  root: null, timerEl: null, paceEl: null, palEl: null,
  presets: [
    { label: "Full mock", n: 63, minutes: 120, caseStudy: true, series: true, desc: "63 questions, 120 minutes. Standalone questions, a locked solution series, then a case study at the end." },
    { label: "Half mock", n: 32, minutes: 60, caseStudy: true, series: false, desc: "32 questions, 60 minutes, ending with a case study. Good when time is short." },
    { label: "Sprint", n: 15, minutes: 25, caseStudy: false, series: false, desc: "15 questions, 25 minutes, weighted like the blueprint. A quick pulse check." }
  ],

  init() {
    const valid = s => s && s.sections && s.sections.every(x => x.qids.every(id => QMAP[id]));
    if (valid(Store.data.current)) { this.S = Store.data.current; this.S.paused = true; }
    else if (Store.data.current) { Store.data.current = null; Store.save(); }
    if (valid(Store.data.last)) this.R = Store.data.last;
  },
  totalQ(S) { return S.sections.reduce((a, s) => a + s.qids.length, 0); },
  offset(S, si) { return S.sections.slice(0, si).reduce((a, s) => a + s.qids.length, 0); },
  persist() { Store.data.current = this.S; Store.save(); },

  render(root) {
    this.root = root;
    root.textContent = "";
    this.timerEl = this.paceEl = this.palEl = null;
    if (this.S && !this.S.done) {
      if (this.S.screen === "secreview") this.renderSecReview(root); else this.renderRun(root);
      this.startTimer();
    } else if (this.showResults && this.R) this.renderResults(root);
    else this.renderSetup(root);
  },
  leave() {
    if (this.S && !this.S.done && !this.S.paused) {
      this.S.paused = true;
      this.persist();
      toast("Mock exam paused. Open the Mock exam tab to resume.");
    }
    this.stopTimer();
  },

  /* ----- setup ----- */
  renderSetup(root) {
    const self = this;
    root.append(h("div", { class: "row between top mb1" },
      h("div", null, h("h1", null, "Mock exam"),
        h("p", { class: "muted mt0" }, "Timed, weighted like the blueprint, no feedback until you submit. Questions you haven't seen are drawn first.")),
      this.R ? h("button", { class: "btn", type: "button", onclick: () => { self.showResults = true; self.render(root); } }, "View last results") : null));
    root.append(h("div", { class: "grid g3" }, this.presets.map(p =>
      h("button", { class: "tile", type: "button", onclick: () => self.begin(p) }, h("b", null, p.label), h("span", null, p.desc)))));

    const num = (val, min, max) => h("input", { type: "number", class: "search", min: String(min), max: String(max), value: String(val), style: { width: "6.5rem", flex: "none", minWidth: "0" } });
    const nIn = num(40, 5, BANK.length), mIn = num(75, 5, 240);
    const cs = h("input", { type: "checkbox" }), sr = h("input", { type: "checkbox" });
    cs.checked = true;
    root.append(h("div", { class: "grid g2 mt2" },
      h("div", { class: "card" }, h("h3", null, "Custom"),
        h("div", { class: "row" }, h("label", { class: "small muted" }, "Questions ", nIn), h("label", { class: "small muted" }, "Minutes ", mIn)),
        h("label", { class: "check small" }, cs, h("span", null, "End with a case study")),
        h("label", { class: "check small" }, sr, h("span", null, "Include a locked solution series")),
        h("button", { class: "btn primary mt1", type: "button", onclick: () => {
          const n = Math.max(5, Math.min(BANK.length, +nIn.value || 40)), m = Math.max(5, Math.min(240, +mIn.value || 75));
          self.begin({ label: "Custom (" + n + ")", n, minutes: m, caseStudy: cs.checked, series: sr.checked });
        } }, "Start custom exam")),
      h("div", { class: "card" }, h("h3", null, "How this mirrors the real exam"),
        h("ul", { class: "small", style: { margin: "0", paddingLeft: "1.1rem" } },
          h("li", null, "Sections lock behind you. Once you finish a section you can't reopen it, and the case study comes last."),
          h("li", null, "In a solution series every answer is final as soon as you move on."),
          h("li", null, "Multi-part items earn partial credit and wrong parts cost nothing, so never leave a blank."),
          h("li", null, "The pace readout shows minutes ahead of or behind an even pace. Candidates report running short before the case study."),
          h("li", null, "The score is your share of points on a 1000 scale. Microsoft scales real scores, so 700 is not exactly 70%.")))));

    const past = Store.data.exams.slice().reverse().slice(0, 8);
    if (past.length) {
      root.append(h("div", { class: "card mt2" }, h("h3", null, "Your attempts"),
        h("div", { class: "tblwrap" }, h("table", { class: "tbl" },
          h("thead", null, h("tr", null, ["When", "Exam", "Score", "Points", "Time used"].map(t => h("th", null, t)))),
          h("tbody", null, past.map(r => h("tr", null,
            h("td", null, new Date(r.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })),
            h("td", null, r.label),
            h("td", null, h("span", { class: "chip " + (r.e / r.t >= 0.7 ? "ok" : "bad") }, String(Math.round((1000 * r.e) / r.t)))),
            h("td", null, r.e + " / " + r.t + " (" + pct(r.e, r.t) + "%)"),
            h("td", null, clock(r.dur)))))))));
    }
  },
  begin(p) {
    this.S = buildExam({ label: p.label, n: p.n, minutes: p.minutes, caseStudy: p.caseStudy, series: p.series });
    this.caseUi = { tab: 0 };
    this.showResults = false;
    this.persist();
    this.render(this.root);
    window.scrollTo(0, 0);
  },

  /* ----- timer (wall-clock based so background-tab throttling can't slow it down) ----- */
  startTimer() {
    if (this.timer) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => {
      const S = this.S, now = Date.now();
      if (!S || S.done) { this.stopTimer(); return; }
      if (S.paused) { this.lastTick = now; return; }
      let whole = Math.floor((now - this.lastTick) / 1000);
      if (whole < 1) return;
      this.lastTick += whole * 1000;
      if (whole > 120) whole = 1; // the machine slept: don't charge the gap
      S.left -= whole;
      if (S.screen === "q") { const id = S.sections[S.si].qids[S.qi]; S.spent[id] = (S.spent[id] || 0) + whole; }
      this.paintClock();
      this.saveTick = (this.saveTick || 0) + whole;
      if (this.saveTick >= 10) { this.saveTick = 0; this.persist(); }
      if (S.left <= 0) { S.left = 0; toast("Time is up. Submitting your exam."); this.finish(); }
    }, 500);
  },
  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  paintClock() {
    const S = this.S;
    if (!S || !this.timerEl) return;
    this.timerEl.textContent = clock(S.left);
    this.timerEl.classList.toggle("low", S.left < 300);
    if (!this.paceEl) return;
    const done = this.offset(S, S.si) + (S.screen === "secreview" ? S.sections[S.si].qids.length : S.qi);
    const delta = Math.round(((done / this.totalQ(S)) * S.total - (S.total - S.left)) / 60);
    this.paceEl.textContent = delta >= 0 ? "Pace +" + delta + " min" : "Pace −" + Math.abs(delta) + " min";
    this.paceEl.style.color = delta >= 0 ? "var(--ok)" : delta > -4 ? "var(--warn)" : "var(--bad)";
  },
  togglePause() { this.S.paused = !this.S.paused; this.persist(); this.render(this.root); },
  quit() {
    modal("End this mock exam?", "<p>Submit now to score what you've answered so far, or discard the attempt.</p>", [
      { label: "Keep going" },
      { label: "Discard", kind: "danger", onClick: () => { this.stopTimer(); this.S = null; Store.data.current = null; Store.save(); this.render(this.root); } },
      { label: "Submit now", kind: "primary", onClick: () => this.finish() }]);
  },
  bar(sec, sub) {
    const self = this, S = this.S;
    this.timerEl = h("span", { class: "timer", title: "Time remaining" });
    this.paceEl = h("span", { class: "small b", title: "Minutes ahead of or behind an even pace" });
    const el = h("div", { class: "exambar" },
      h("span", { class: "chip" }, "Section " + (S.si + 1) + " of " + S.sections.length),
      h("span", { class: "b" }, sec.title),
      h("span", { class: "muted small" }, sub),
      h("span", { class: "spacer" }),
      this.paceEl, this.timerEl,
      h("button", { class: "btn sm", type: "button", onclick: () => self.togglePause() }, S.paused ? "▶ Resume" : "⏸ Pause"),
      h("button", { class: "btn sm danger", type: "button", onclick: () => self.quit() }, "End"));
    this.paintClock();
    return el;
  },

  /* ----- running ----- */
  renderRun(root) {
    const self = this, S = this.S, sec = S.sections[S.si], id = sec.qids[S.qi], q = QMAP[id], st = S.st[id];
    const num = this.offset(S, S.si) + S.qi + 1;
    root.append(this.bar(sec, "Question " + num + " of " + this.totalQ(S)));
    if (S.paused) {
      root.append(h("div", { class: "card", style: { textAlign: "center", padding: "3rem 1rem" } },
        h("h2", null, "Exam paused"), h("p", { class: "muted" }, "The clock is stopped and the question is hidden."),
        h("button", { class: "btn primary lg", type: "button", onclick: () => self.togglePause() }, "▶ Resume")));
      return;
    }
    const series = sec.kind === "series", last = S.qi === sec.qids.length - 1;
    const qel = renderQ(q, st, { meta: false, num, locked: !!st.lock, onChange: () => { self.persist(); self.paintPalette(); } });
    qel.append(h("div", { class: "q-foot" },
      h("button", { class: "btn ghost", type: "button", disabled: series || S.qi === 0 ? true : null, onclick: () => self.step(-1) }, "← Previous"),
      series ? null : h("button", { class: "btn ghost" + (st.flag ? " on" : ""), type: "button", onclick: () => { st.flag = !st.flag; self.persist(); self.render(self.root); } }, st.flag ? "⚑ Flagged for review" : "⚐ Flag for review"),
      h("span", { class: "spacer" }),
      h("button", { class: "btn primary", type: "button", onclick: () => self.step(1) }, last ? "Review section →" : "Next →")));
    this.palEl = h("div", { class: "palette" });
    const side = h("div", { class: "card" }, h("h4", null, "This section"), this.palEl,
      h("div", { class: "tiny muted mt1" }, "Filled = answered. Dot = flagged."),
      series ? null : h("button", { class: "btn sm mt1", type: "button", onclick: () => { S.screen = "secreview"; self.persist(); self.render(self.root); } }, "Review section"));
    const note = series ? h("div", { class: "callout warn small mb1" }, "Solution series: each answer is final once you move on, and you can't come back to it.") : null;
    if (sec.kind === "case" && CASEMAP[sec.caseId]) {
      root.append(h("div", { class: "caselayout" }, casePanel(CASEMAP[sec.caseId], this.caseUi), h("div", { class: "grid" }, qel, side)));
    } else {
      root.append(h("div", { class: "examgrid" }, h("div", null, note, qel), side));
    }
    this.paintPalette();
  },
  paintPalette() {
    const S = this.S, self = this;
    if (!S || !this.palEl) return;
    const sec = S.sections[S.si], off = this.offset(S, S.si);
    this.palEl.textContent = "";
    sec.qids.forEach((id, i) => {
      const st = S.st[id];
      const cls = "pal" + (isAnswered(QMAP[id], st.resp) ? " ans" : "") + (st.flag ? " flag" : "") + (i === S.qi && S.screen === "q" ? " cur" : "");
      this.palEl.append(h("button", {
        class: cls, type: "button", disabled: sec.kind === "series" ? true : null,
        onclick: () => { S.qi = i; S.screen = "q"; self.persist(); self.render(self.root); }
      }, String(off + i + 1)));
    });
  },
  step(d) {
    const S = this.S, sec = S.sections[S.si], id = sec.qids[S.qi], st = S.st[id];
    if (sec.kind === "series" && d > 0) {
      if (!isAnswered(QMAP[id], st.resp)) {
        modal("Leave this unanswered?", "<p>In a solution series you can't come back, and an unanswered question scores zero.</p>", [
          { label: "Stay" },
          { label: "Move on anyway", kind: "danger", onClick: () => { st.lock = true; this.advance(d); } }]);
        return;
      }
      st.lock = true;
    }
    this.advance(d);
  },
  advance(d) {
    const S = this.S, sec = S.sections[S.si], n = S.qi + d;
    if (n < 0) return;
    if (n >= sec.qids.length) S.screen = "secreview"; else S.qi = n;
    this.persist();
    this.render(this.root);
    window.scrollTo(0, 0);
  },

  onKey(e) {
    const S = this.S;
    if (!S || S.done || S.paused || S.screen !== "q" || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-8]$/.test(e.key)) { const b = $$(".q .opt", this.root)[+e.key - 1]; if (b) b.click(); }
  },

  /* ----- section review ----- */
  renderSecReview(root) {
    const self = this, S = this.S, sec = S.sections[S.si], lastSec = S.si === S.sections.length - 1, series = sec.kind === "series";
    root.append(this.bar(sec, "Section review"));
    if (S.paused) {
      root.append(h("div", { class: "card", style: { textAlign: "center", padding: "3rem 1rem" } }, h("h2", null, "Exam paused"),
        h("button", { class: "btn primary lg", type: "button", onclick: () => self.togglePause() }, "▶ Resume")));
      return;
    }
    const answered = sec.qids.filter(id => isAnswered(QMAP[id], S.st[id].resp)).length;
    const flagged = sec.qids.filter(id => S.st[id].flag).length, blank = sec.qids.length - answered;
    this.palEl = h("div", { class: "palette", style: { maxWidth: "640px" } });
    const go = () => {
      if (lastSec) { self.finish(); return; }
      S.si++; S.qi = 0; S.screen = "q"; self.caseUi = { tab: 0 };
      self.persist(); self.render(self.root); window.scrollTo(0, 0);
    };
    const confirmGo = () => {
      if (!blank && series) { go(); return; }
      modal(lastSec ? "Submit the exam?" : "Finish this section?",
        "<p>" + (blank ? "<b>" + blank + " unanswered</b> in this section. Unanswered questions score zero. " : "") +
        (lastSec ? "This ends the exam and shows your results." : "You won't be able to return to this section.") + "</p>",
        [{ label: "Go back" }, { label: lastSec ? "Submit exam" : "Finish section", kind: "primary", onClick: go }]);
    };
    root.append(h("div", { class: "card" },
      h("h2", null, "Review: " + sec.title),
      h("div", { class: "row mb1" },
        h("span", { class: "chip ok" }, answered + " answered"),
        h("span", { class: "chip " + (blank ? "bad" : "") }, blank + " unanswered"),
        h("span", { class: "chip " + (flagged ? "warn" : "") }, flagged + " flagged")),
      this.palEl,
      h("div", { class: "callout warn small mt2" }, lastSec ? "This is the last section. Submitting ends the exam."
        : "Once you finish this section you can't come back to it, the same as the real exam."),
      h("div", { class: "row mt2" },
        series ? null : h("button", { class: "btn", type: "button", onclick: () => { S.screen = "q"; self.persist(); self.render(self.root); } }, "← Back to questions"),
        h("span", { class: "spacer" }),
        h("button", { class: "btn primary lg", type: "button", onclick: confirmGo }, lastSec ? "Submit exam" : "Finish section and continue →"))));
    this.paintPalette();
  },

  /* ----- scoring ----- */
  summarize(S) {
    const out = { n: 0, e: 0, t: 0, dom: {}, obj: {}, type: {}, items: [] };
    S.sections.forEach(sec => sec.qids.forEach(id => {
      const q = QMAP[id];
      if (!q) return;
      const st = S.st[id], g = grade(q, st.resp);
      out.n++; out.e += g.earned; out.t += g.total;
      const add = (map, key) => { const m = map[key] || (map[key] = [0, 0]); m[0] += g.earned; m[1] += g.total; };
      add(out.dom, q.domain); add(out.obj, q.objective); add(out.type, typeLabel(q).replace(/Choose \d/, "Multiple answer"));
      out.items.push({ id, q, st, g, spent: S.spent[id] || 0 });
    }));
    return out;
  },
  finish() {
    const S = this.S;
    if (!S) return;
    this.stopTimer();
    S.done = true;
    S.finishedAt = Date.now();
    const sum = this.summarize(S);
    sum.items.forEach(x => { recordResult(x.q, x.g, false); if (x.st.flag) setFlag(x.id, true); x.st.done = true; });
    Store.data.exams.push({ ts: S.finishedAt, label: S.cfg.label, n: sum.n, e: sum.e, t: sum.t, dur: S.total - S.left });
    Store.data.current = null;
    Store.data.last = S;
    Store.save();
    this.R = S; this.S = null; this.showResults = true; this.revFilter = "all";
    if (App.view === "exam") { this.render(this.root); window.scrollTo(0, 0); } else App.go("exam");
  },

  /* ----- results ----- */
  renderResults(root) {
    const self = this, S = this.R, sum = this.summarize(S);
    const p = sum.t ? sum.e / sum.t : 0, pass = p >= 0.7, dur = S.total - S.left;
    const wrong = sum.items.filter(x => !x.g.full);
    const blind = wrong.filter(x => x.g.attempted && !x.st.flag);
    const blank = sum.items.filter(x => !x.g.attempted);
    const C = 2 * Math.PI * 72;
    const ring = h("div", { class: "ring", html:
      '<svg width="170" height="170" viewBox="0 0 170 170"><circle cx="85" cy="85" r="72" fill="none" stroke="var(--line)" stroke-width="13"/>' +
      '<circle cx="85" cy="85" r="72" fill="none" stroke="var(' + (pass ? "--ok" : "--bad") + ')" stroke-width="13" stroke-linecap="round" stroke-dasharray="' +
      (p * C).toFixed(1) + " " + C.toFixed(1) + '"/></svg><div class="mid"><div><b>' + Math.round(p * 1000) + '</b><span class="muted small">of 1000</span></div></div>' });
    const kpi = (v, l) => h("div", { class: "kpi" }, h("b", null, v), h("span", null, l));
    root.append(h("div", { class: "row between mb1" }, h("h1", { class: "mb0" }, "Mock exam results"),
      h("div", { class: "row" },
        wrong.length ? h("button", { class: "btn primary", type: "button", onclick: () => Practice.start({ ids: wrong.map(x => x.id), label: "Misses from your mock exam" }) }, "Drill the " + wrong.length + " you missed") : null,
        h("button", { class: "btn", type: "button", onclick: () => { self.showResults = false; self.render(root); } }, "New mock exam"))));
    root.append(h("div", { class: "card" }, h("div", { class: "row", style: { gap: "1.6rem" } }, ring,
      h("div", { style: { flex: "1", minWidth: "260px" } },
        h("div", { class: "row" }, h("span", { class: "chip " + (pass ? "ok" : "bad") }, pass ? "Above the 700 line" : "Below the 700 line"), h("span", { class: "muted small" }, S.cfg.label)),
        h("div", { class: "grid g4 mt1" },
          kpi(sum.e + " / " + sum.t, "points (" + pct(sum.e, sum.t) + "%)"),
          kpi(sum.items.filter(x => x.g.full).length + " / " + sum.n, "questions fully correct"),
          kpi(clock(dur), "used of " + clock(S.total)),
          kpi(clock(dur / Math.max(1, sum.n)), "average per question")),
        h("p", { class: "tiny muted mb0" }, "Indicative only: your share of points on a 1000 scale. Microsoft scales real scores, so 700 is not exactly 70%.")))));

    const domCard = h("div", { class: "card" }, h("h3", null, "By skill area"));
    DATA.domains.forEach(d => {
      const m = sum.dom[d.id];
      if (!m) return;
      domCard.append(h("div", { class: "domrow" },
        h("div", null, h("span", { class: "chip d" + d.id }, "D" + d.id), " ", h("span", { class: "small" }, d.short), h("span", { class: "tiny faint" }, "  " + d.weight[0] + "-" + d.weight[1] + "%")),
        h("div", { class: "bar" }, h("div", { class: "fill", style: { width: pct(m[0], m[1]) + "%", background: "var(--d" + d.id + ")" } }), h("div", { class: "mark", style: { left: "70%" } })),
        h("div", { class: "small b" }, pct(m[0], m[1]) + "%  ", h("span", { class: "muted", style: { fontWeight: "400" } }, m[0] + "/" + m[1]))));
    });
    const slow = sum.items.slice().sort((a, b) => b.spent - a.spent).slice(0, 3).filter(x => x.spent > 0);
    const ins = h("div", { class: "card" }, h("h3", null, "What to do with this"),
      h("div", { class: "rank" }, h("span", { class: "n" }, "!"), h("div", null, h("b", null, blind.length + " blind spots"), h("div", { class: "small muted" }, "Wrong and not flagged: you were confident and mistaken. These cost the most on exam day, so fix them first."),
        blind.length ? h("button", { class: "btn sm mt1", type: "button", onclick: () => Practice.start({ ids: blind.map(x => x.id), label: "Blind spots from your mock exam" }) }, "Drill blind spots") : null)),
      h("div", { class: "rank" }, h("span", { class: "n" }, "?"), h("div", null, h("b", null, sum.items.filter(x => x.st.flag).length + " flagged"), h("div", { class: "small muted" },
        sum.items.filter(x => x.st.flag && x.g.full).length + " of them were right anyway. Trust your first read on those topics."))),
      h("div", { class: "rank" }, h("span", { class: "n" }, "0"), h("div", null, h("b", null, blank.length + " unanswered"), h("div", { class: "small muted" }, "There is no penalty for a wrong answer. Guess, flag and move on."))),
      slow.length ? h("div", { class: "rank" }, h("span", { class: "n" }, "⏱"), h("div", null, h("b", null, "Slowest questions"),
        h("div", { class: "small muted" }, slow.map(x => "Q" + (sum.items.indexOf(x) + 1) + " (" + clock(x.spent) + ")").join(", ") + ". Past two minutes, flag it and move on."))) : null);
    root.append(h("div", { class: "grid g2 mt2" }, domCard, ins));

    const rows = Object.keys(sum.obj).map(k => ({ k, e: sum.obj[k][0], t: sum.obj[k][1] })).sort((a, b) => a.e / a.t - b.e / b.t);
    const typeRows = Object.keys(sum.type).map(k => ({ k, e: sum.type[k][0], t: sum.type[k][1] }));
    const tbl = (head, list, name) => h("div", { class: "tblwrap" }, h("table", { class: "tbl" },
      h("thead", null, h("tr", null, head.map(t => h("th", null, t)))),
      h("tbody", null, list.map(r => h("tr", null, h("td", null, name(r)), h("td", null, r.e + " / " + r.t),
        h("td", null, h("span", { class: "chip " + (r.e / r.t >= 0.8 ? "ok" : r.e / r.t >= 0.6 ? "warn" : "bad") }, pct(r.e, r.t) + "%")))))));
    root.append(h("div", { class: "grid g21 mt2" },
      h("div", { class: "card" }, h("h3", null, "By objective, weakest first"), tbl(["Objective", "Points", "Score"], rows, r => (OBJ[r.k] ? r.k + "  " + OBJ[r.k].name : r.k))),
      h("div", { class: "card" }, h("h3", null, "By question format"), tbl(["Format", "Points", "Score"], typeRows, r => r.k))));

    const filt = { all: () => true, wrong: x => !x.g.full, flagged: x => x.st.flag, blank: x => !x.g.attempted, right: x => x.g.full };
    const list = h("div");
    const paint = () => {
      list.textContent = "";
      list.append(h("div", { class: "pills mb1" }, [["all", "All"], ["wrong", "Incorrect or partial"], ["flagged", "Flagged"], ["blank", "Unanswered"], ["right", "Correct"]].map(([k, l]) =>
        h("button", { class: "pill" + (self.revFilter === k ? " on" : ""), type: "button", onclick: () => { self.revFilter = k; paint(); } }, l + " (" + sum.items.filter(filt[k]).length + ")"))));
      sum.items.forEach((x, i) => {
        if (!filt[self.revFilter](x)) return;
        const chip = x.g.full ? ["ok", "Correct"] : !x.g.attempted ? ["warn", "Blank"] : x.g.earned > 0 ? ["warn", x.g.earned + "/" + x.g.total] : ["bad", "Wrong"];
        const d = h("details", { class: "rev" }, h("summary", null,
          h("span", { class: "b" }, "Q" + (i + 1)), h("span", { class: "chip " + chip[0] }, chip[1]), h("span", { class: "chip d" + x.q.domain }, x.q.objective || "D" + x.q.domain),
          x.st.flag ? h("span", { class: "chip warn" }, "⚑") : null,
          h("span", { class: "t" }, String(x.q.stem).replace(/\s+/g, " ").slice(0, 170)), h("span", { class: "tiny faint" }, clock(x.spent))));
        d.addEventListener("toggle", () => {
          if (d.open && !d.getAttribute("data-done")) {
            d.setAttribute("data-done", "1");
            d.append(h("div", { class: "body" }, renderQ(x.q, x.st, { showAnswer: true, num: i + 1 })));
          }
        });
        list.append(d);
      });
    };
    paint();
    root.append(h("div", { class: "mt2" }, h("h3", null, "Question review"), list));
  }
};
