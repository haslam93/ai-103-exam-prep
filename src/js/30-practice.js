"use strict";
/* ---------- practice mode: instant check / reveal ---------- */
const Practice = {
  f: { dom: [], type: [], status: "all", hot: false, obj: "" },
  ids: null, label: "", queue: [], i: 0, st: {}, session: { n: 0, ok: 0 }, caseUi: { tab: 0 }, root: null, main: null, built: false, filtersOpen: null,

  start(o) {
    o = o || {};
    this.ids = o.ids || null;
    this.label = o.label || "";
    this.f = { dom: o.dom || [], type: [], status: o.status || "all", hot: !!o.hot, obj: "" };
    this.rebuild();
    App.go("practice");
  },
  pool() {
    const f = this.f;
    let list = this.ids ? this.ids.map(id => QMAP[id]).filter(Boolean) : ALLQ.slice();
    if (f.dom.length) list = list.filter(q => f.dom.includes(q.domain));
    if (f.obj) list = list.filter(q => q.objective === f.obj);
    if (f.type.length) list = list.filter(q => f.type.includes(q.type));
    if (f.hot) list = list.filter(q => q.hot);
    if (f.status !== "all") {
      list = list.filter(q => {
        const s = statusOf(q.id), r = histOf(q.id);
        if (f.status === "unseen") return s === "unseen";
        if (f.status === "missed") return s === "bad" || s === "part";
        return !!(r && r.flag);
      });
    }
    return list;
  },
  rebuild() {
    const rank = { unseen: 0, bad: 1, part: 2, ok: 3 };
    this.queue = shuffle(this.pool()).sort((a, b) => rank[statusOf(a.id)] - rank[statusOf(b.id)]).map(q => q.id);
    this.i = 0;
    this.st = {};
    this.session = { n: 0, ok: 0 };
    this.built = true;
  },
  refresh() { this.rebuild(); this.render(this.root); },

  render(root) {
    this.root = root;
    if (!this.built) this.rebuild();
    root.textContent = "";
    this.main = h("div");
    root.append(h("div", { class: "practice" }, this.filtersEl(), this.main));
    this.paintMain();
  },

  filtersEl() {
    const f = this.f, self = this;
    const pill = (label, on, fn, title) => h("button", { type: "button", class: "pill" + (on ? " on" : ""), title: title || null, onclick: fn }, label);
    const tog = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); self.refresh(); };
    const group = (title, kids) => h("div", { class: "fgroup" }, h("h4", null, title), h("div", { class: "pills" }, kids));
    const el = h("details", { class: "card filters" });
    el.open = this.filtersOpen != null ? this.filtersOpen : window.innerWidth > 980;
    el.addEventListener("toggle", () => { self.filtersOpen = el.open; });
    el.append(h("summary", null, "Filters", h("span", { class: "chip" }, this.queue.length + " questions")));
    if (this.ids) {
      el.append(h("div", { class: "callout mb1 small" }, h("b", null, this.label || "Custom set"),
        h("div", { class: "muted" }, this.ids.length + " questions in this set"),
        h("button", { class: "btn sm mt1", type: "button", onclick: () => { self.ids = null; self.label = ""; self.refresh(); } }, "Back to the full bank")));
    }
    el.append(group("Domain", DATA.domains.map(d => pill("D" + d.id + " " + d.short, f.dom.includes(d.id), () => { f.obj = ""; tog(f.dom, d.id); }, d.name))));
    const objSel = h("select", { class: "search", style: { width: "100%" }, "aria-label": "Objective" }, h("option", { value: "" }, "All objectives"));
    DATA.domains.filter(d => !f.dom.length || f.dom.includes(d.id)).forEach(d => d.objectives.forEach(o => objSel.append(h("option", { value: o.id }, o.id + "  " + o.name))));
    objSel.value = f.obj;
    objSel.addEventListener("change", () => { f.obj = objSel.value; self.refresh(); });
    el.append(h("div", { class: "fgroup" }, h("h4", null, "Objective"), objSel));
    el.append(group("Status", [["all", "All"], ["unseen", "Unseen"], ["missed", "Missed"], ["flagged", "Flagged"]]
      .map(([v, l]) => pill(l, f.status === v, () => { f.status = v; self.refresh(); }))));
    el.append(group("Format", [["single", "Single"], ["multi", "Multi"], ["yesno", "Yes/No"], ["dropdown", "Drop-down"], ["order", "Sequence"]]
      .map(([v, l]) => pill(l, f.type.includes(v), () => tog(f.type, v)))));
    el.append(group("Focus", [pill("Hot topics only", f.hot, () => { f.hot = !f.hot; self.refresh(); }, "Topics candidates report seeing")]));
    const sh = h("input", { type: "checkbox" });
    sh.checked = !!Store.data.settings.shuffle;
    sh.addEventListener("change", () => { Store.data.settings.shuffle = sh.checked; Store.save(); self.refresh(); });
    el.append(h("label", { class: "check small" }, sh, h("span", null, "Shuffle answer options")));
    el.append(h("div", { class: "small muted mt1" }, h("b", null, String(this.queue.length)), " questions match. Unseen and missed come first."));
    el.append(h("div", { class: "tiny faint mt1" }, h("kbd", null, "1"), "-", h("kbd", null, "6"), " pick  ", h("kbd", null, "Enter"), " check/next  ",
      h("kbd", null, "R"), " reveal  ", h("kbd", null, "F"), " flag  ", h("kbd", null, "←"), h("kbd", null, "→"), " move"));
    return el;
  },

  cur() {
    const id = this.queue[this.i];
    if (!id) return null;
    const q = QMAP[id];
    if (!this.st[id]) {
      const r = histOf(id);
      this.st[id] = Object.assign(makeState(q, Store.data.settings.shuffle), { flag: !!(r && r.flag) });
    }
    return { id, q, st: this.st[id] };
  },

  paintMain() {
    const m = this.main, self = this;
    m.textContent = "";
    if (!this.queue.length) {
      m.append(h("div", { class: "card" }, h("h3", null, "No questions match these filters"), h("p", { class: "muted" }, "Loosen a filter on the left.")));
      return;
    }
    if (this.i >= this.queue.length) { m.append(this.doneCard()); return; }
    const { id, q, st } = this.cur();
    m.append(h("div", { class: "row mb1 nowrap" },
      h("span", { class: "b" }, (this.i + 1) + " / " + this.queue.length),
      h("div", { class: "bar thin", style: { flex: "1" } }, h("div", { class: "fill", style: { width: pct(this.i + 1, this.queue.length) + "%" } })),
      h("span", { class: "chip" }, "Session " + this.session.ok + "/" + this.session.n + " correct")));
    if (q.caseId && CASEMAP[q.caseId]) {
      m.append(h("details", { class: "rev" }, h("summary", null, h("span", { class: "chip" }, "Case study"), h("span", { class: "t" }, CASEMAP[q.caseId].title + " (open to read the scenario)")),
        h("div", { class: "body" }, casePanel(CASEMAP[q.caseId], this.caseUi))));
    }
    const qel = renderQ(q, st, { showAnswer: st.done });
    qel.append(h("div", { class: "q-foot" },
      h("button", { class: "btn primary", type: "button", disabled: st.done ? true : null, onclick: () => self.check() }, "Check answer"),
      h("button", { class: "btn", type: "button", disabled: st.done ? true : null, onclick: () => self.reveal() }, "Reveal answer"),
      h("button", { class: "btn ghost" + (st.flag ? " on" : ""), type: "button", onclick: () => self.flag() }, st.flag ? "⚑ Flagged" : "⚐ Flag"),
      h("span", { class: "spacer" }),
      h("button", { class: "btn ghost", type: "button", disabled: this.i === 0 ? true : null, onclick: () => self.move(-1) }, "← Prev"),
      h("button", { class: "btn" + (st.done ? " primary" : ""), type: "button", onclick: () => self.move(1) }, this.i === this.queue.length - 1 ? "Finish set" : "Next →")));
    m.append(qel);
  },

  doneCard() {
    const self = this, s = this.session;
    const missed = this.queue.filter(id => { const st = this.st[id]; return st && st.done && (st.peek || !grade(QMAP[id], st.resp).full); });
    return h("div", { class: "card" },
      h("h2", null, "Set complete"),
      h("p", null, "You got ", h("b", null, s.ok + " of " + s.n), " fully correct in this session", s.n ? " (" + pct(s.ok, s.n) + "%)." : "."),
      h("div", { class: "row mt1" },
        missed.length ? h("button", { class: "btn primary", type: "button", onclick: () => self.start({ ids: missed, label: "Misses from your last set" }) }, "Redo the " + missed.length + " you missed") : null,
        h("button", { class: "btn", type: "button", onclick: () => self.refresh() }, "Reshuffle this set"),
        h("button", { class: "btn ghost", type: "button", onclick: () => App.go("home") }, "Home")));
  },

  check() {
    const c = this.cur();
    if (!c || c.st.done) return;
    const g = grade(c.q, c.st.resp);
    if (!g.attempted) { toast("Pick an answer first, or use Reveal."); return; }
    c.st.done = true;
    c.st.peek = false;
    recordResult(c.q, g, false);
    this.session.n++;
    if (g.full) this.session.ok++;
    this.paintMain();
  },
  reveal() {
    const c = this.cur();
    if (!c || c.st.done) return;
    c.st.done = true;
    c.st.peek = true;
    recordResult(c.q, grade(c.q, c.st.resp), true);
    this.session.n++;
    this.paintMain();
  },
  flag() {
    const c = this.cur();
    if (!c) return;
    c.st.flag = !c.st.flag;
    setFlag(c.id, c.st.flag);
    this.paintMain();
  },
  move(d) {
    const n = this.i + d;
    if (n < 0 || n > this.queue.length) return;
    this.i = n;
    this.paintMain();
    window.scrollTo(0, 0);
  },
  onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const c = this.cur();
    if (!c || this.i >= this.queue.length) return;
    const k = e.key, onBtn = e.target && e.target.tagName === "BUTTON" && !e.target.classList.contains("opt");
    if (k === "Enter") {
      if (onBtn) return;
      e.preventDefault();
      if (c.st.done) this.move(1); else this.check();
    } else if (k === "r" || k === "R") this.reveal();
    else if (k === "f" || k === "F") this.flag();
    else if (k === "ArrowRight") this.move(1);
    else if (k === "ArrowLeft") this.move(-1);
    else if (/^[1-8]$/.test(k)) { const b = $$(".q .opt", this.main)[+k - 1]; if (b) b.click(); }
  }
};
