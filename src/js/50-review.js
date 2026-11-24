"use strict";
/* ---------- rapid review: deltas, per-domain cheat sheets, trigger phrases, Learn lookup map ---------- */
function cheatCard(sec, domId) {
  const c = h("div", { class: "card cheat" + (sec.columns && sec.columns.length >= 3 ? " wide" : "") },
    h("div", { class: "row between nowrap top" }, h("h3", null, sec.title), domId ? h("span", { class: "chip d" + domId }, "D" + domId) : null));
  if (sec.columns && sec.rows) {
    c.append(h("div", { class: "tblwrap" }, h("table", null,
      h("thead", null, h("tr", null, sec.columns.map(t => h("th", { html: fmt(t) })))),
      h("tbody", null, sec.rows.map(r => h("tr", null, r.map((cell, i) => h("td", { html: fmt(cell), "data-label": sec.columns[i] || null }))))))));
  }
  if (sec.bullets) c.append(h("ul", null, sec.bullets.map(b => h("li", { html: fmt(b) }))));
  if (sec.code) { const pre = h("pre"); pre.append(codeNodes(sec.code)); c.append(pre); }
  if (sec.note) c.append(h("div", { class: "note", html: fmt(sec.note) }));
  if (sec.ref && sec.ref.url) c.append(h("div", { class: "small mt1" }, h("a", { href: sec.ref.url, target: "_blank", rel: "noopener" }, "Learn: " + (sec.ref.title || "reference"))));
  return c;
}
function simpleTable(head, rows) {
  return h("div", { class: "tblwrap" }, h("table", { class: "tbl" },
    h("thead", null, h("tr", null, head.map(t => h("th", null, t)))),
    h("tbody", null, rows.map(r => h("tr", null, r.map((cell, i) => (cell && cell.nodeType
      ? h("td", { "data-label": head[i] || null }, cell) : h("td", { html: fmt(cell), "data-label": head[i] || null }))))))));
}

const Review = {
  tab: "deltas", q: "", root: null, body: null,
  tabs() {
    return [["deltas", "Era traps: read first"]].concat(DATA.domains.map(d => ["d" + d.id, "D" + d.id + " " + d.short]),
      [["triggers", "Trigger phrases"], ["lookup", "Learn lookup map"]]);
  },
  open(tab) { this.tab = tab; this.q = ""; App.go("review"); },
  render(root) {
    const self = this;
    this.root = root;
    root.textContent = "";
    const search = h("input", { class: "search", type: "search", placeholder: "Search every cheat sheet, trigger and delta…", value: this.q, "aria-label": "Search review content" });
    search.addEventListener("input", () => { self.q = search.value; self.paint(); });
    this.nav = h("div", { class: "subnav" });
    this.body = h("div");
    root.append(h("div", { class: "row between top" },
      h("div", null, h("h1", null, "Rapid review"), h("p", { class: "muted mt0" }, "Decision tables, traps and current SDK shapes, written from today's Microsoft Learn docs. Skips what an expert already knows.")),
      h("button", { class: "btn", type: "button", onclick: () => window.print() }, "Print / save as PDF")),
      h("div", { class: "row mb1" }, search), this.nav, this.body);
    this.paint();
  },
  paint() {
    const self = this, q = this.q.trim().toLowerCase(), body = this.body;
    this.nav.textContent = "";
    this.tabs().forEach(([k, l]) => this.nav.append(h("button", {
      class: "pill" + (!q && this.tab === k ? " on" : ""), type: "button", onclick: () => { self.tab = k; self.q = ""; self.render(self.root); }
    }, l)));
    body.textContent = "";
    const hit = obj => !q || JSON.stringify(obj).toLowerCase().includes(q);
    const trigTable = list => simpleTable(["When the question says", "Pick", "Why"], list.map(t => [t.when, "**" + t.pick + "**", t.why]));
    const deltaTable = list => simpleTable(["Before", "Now", "Why it matters"], list.map(d => [d.old, "**" + d.now + "**", d.note || ""]));
    const lookTable = list => simpleTable(["Topic", "Type this into Learn search", "Page"], list.map(l => [l.topic, "`" + l.search + "`",
      h("a", { href: l.url, target: "_blank", rel: "noopener" }, "open")]));

    if (q) {
      let n = 0;
      const deltas = (DATA.deltas || []).filter(hit), trig = DATA.triggers.filter(hit), look = DATA.lookup.filter(hit);
      const cards = h("div", { class: "cols2" });
      DATA.domains.forEach(d => (DATA.cheats[d.id] || []).filter(hit).forEach(sec => { cards.append(cheatCard(sec, d.id)); n++; }));
      if (n) body.append(cards);
      if (deltas.length) body.append(h("div", { class: "card mb1" }, h("h3", null, "Era traps"), deltaTable(deltas)));
      if (trig.length) body.append(h("div", { class: "card mb1" }, h("h3", null, "Trigger phrases"), trigTable(trig)));
      if (look.length) body.append(h("div", { class: "card mb1" }, h("h3", null, "Learn lookup map"), lookTable(look)));
      if (!n && !deltas.length && !trig.length && !look.length) body.append(h("div", { class: "card muted" }, "Nothing matches “" + this.q + "”."));
      return;
    }
    if (this.tab === "deltas") {
      const all = DATA.deltas || [], era = all.filter(d => d.group === "era"), old = all.filter(d => d.group !== "era");
      body.append(h("div", { class: "callout warn mb1" }, h("b", null, "The exam is frozen at the April 16, 2026 outline. Microsoft Learn is not. "),
        "Several things were renamed, replaced or retired after the questions were written. Expect the April wording in the questions, and today's wording when you look something up in Learn during the exam."),
        h("div", { class: "card mb1" }, h("h3", null, "Exam era versus Learn today"),
          simpleTable(["On the exam (April 2026)", "In Learn today", "What to do with it"], era.map(d => [d.old, "**" + d.now + "**", d.note || ""]))),
        h("div", { class: "card" }, h("h3", null, "If you last studied this stack for AI-102"), deltaTable(old)));
    } else if (this.tab === "triggers") {
      DATA.domains.forEach(d => {
        const list = DATA.triggers.filter(t => t.domain === d.id);
        if (list.length) body.append(h("div", { class: "card mb1" }, h("h3", null, h("span", { class: "chip d" + d.id }, "D" + d.id), " " + d.name), trigTable(list)));
      });
    } else if (this.tab === "lookup") {
      body.append(h("div", { class: "callout mb1" }, h("b", null, "Microsoft Learn is open during the exam, but candidates say pages load slowly. "),
        "Know the search phrase before you need it, look up only exact parameter or role names, and cap each lookup at about two minutes."));
      DATA.domains.forEach(d => {
        const list = DATA.lookup.filter(t => t.domain === d.id);
        if (list.length) body.append(h("div", { class: "card mb1" }, h("h3", null, h("span", { class: "chip d" + d.id }, "D" + d.id), " " + d.name), lookTable(list)));
      });
    } else {
      const d = DOM[+this.tab.slice(1)];
      body.append(h("div", { class: "card mb1" },
        h("div", { class: "row between" }, h("h2", { class: "mb0" }, d.name), h("span", { class: "chip d" + d.id }, d.weight[0] + "-" + d.weight[1] + "% of the exam")),
        h("details", { class: "mt1" }, h("summary", { class: "small muted", style: { cursor: "pointer" } }, "Official objectives in this skill area"),
          d.objectives.map(o => h("div", { class: "mt1" }, h("b", { class: "small" }, o.id + "  " + o.name), h("ul", { class: "small muted", style: { margin: ".2rem 0", paddingLeft: "1.1rem" } }, o.bullets.map(b => h("li", null, b)))))),
        h("div", { class: "row mt1" }, h("button", { class: "btn sm primary", type: "button", onclick: () => Practice.start({ dom: [d.id] }) }, "Practice this area"))));
      body.append(h("div", { class: "cols2" }, (DATA.cheats[d.id] || []).map(sec => cheatCard(sec))));
      const trig = DATA.triggers.filter(t => t.domain === d.id);
      if (trig.length) body.append(h("div", { class: "card mt1" }, h("h3", null, "Trigger phrases"), trigTable(trig)));
    }
  }
};

/* ---------- flashcards with a tiny Leitner box ---------- */
const Cards = {
  dom: [], deck: "all", hideKnown: true, queue: [], i: 0, flipped: false, root: null, built: false, map: null,
  build() {
    if (!this.map) { this.map = {}; DATA.flashcards.forEach(c => { this.map[c.id] = c; }); }
    let list = DATA.flashcards.filter(c => (!this.dom.length || this.dom.includes(c.domain)) && (this.deck === "all" || c.kind === this.deck));
    if (this.hideKnown) list = list.filter(c => (Store.data.cards[c.id] || 0) < 2);
    this.queue = shuffle(list).map(c => c.id);
    this.i = 0;
    this.flipped = false;
    this.built = true;
  },
  render(root) {
    const self = this;
    this.root = root;
    if (!this.built) this.build();
    root.textContent = "";
    const known = DATA.flashcards.filter(c => (Store.data.cards[c.id] || 0) >= 2).length;
    const pill = (label, on, fn) => h("button", { type: "button", class: "pill" + (on ? " on" : ""), onclick: fn }, label);
    const redo = () => { self.build(); self.render(root); };
    root.append(h("h1", null, "Flashcards"),
      h("p", { class: "muted mt0" }, "Facts and trigger phrases. Two “Got it” in a row retires a card. ", h("b", null, known + " of " + DATA.flashcards.length), " mastered."),
      h("div", { class: "subnav" },
        DATA.domains.map(d => pill("D" + d.id + " " + d.short, this.dom.includes(d.id), () => { const k = self.dom.indexOf(d.id); if (k >= 0) self.dom.splice(k, 1); else self.dom.push(d.id); redo(); })),
        h("span", { class: "faint" }, "|"),
        [["all", "All cards"], ["fact", "Facts"], ["trigger", "Triggers"]].map(([k, l]) => pill(l, this.deck === k, () => { self.deck = k; redo(); })),
        h("span", { class: "faint" }, "|"),
        pill("Hide mastered", this.hideKnown, () => { self.hideKnown = !self.hideKnown; redo(); })));
    if (this.i >= this.queue.length) {
      root.append(h("div", { class: "card", style: { textAlign: "center", padding: "2.5rem 1rem" } },
        h("h2", null, this.queue.length ? "Deck complete" : "Nothing left in this deck"),
        h("p", { class: "muted" }, this.hideKnown ? "Mastered cards are hidden. Turn off “Hide mastered” to run them again." : "Run it again or change the filters."),
        h("button", { class: "btn primary", type: "button", onclick: redo }, "Shuffle and restart")));
      return;
    }
    const c = this.map[this.queue[this.i]];
    const card = h("div", { class: "fc" + (this.flipped ? " flipped" : ""), role: "button", tabindex: "0", "aria-label": "Flashcard. Press space to flip.", onclick: () => self.flip() },
      h("div", { class: "fc-face fc-front" }, h("span", { class: "lbl" }, (c.kind === "trigger" ? "When you see" : "Question") + "  ·  D" + c.domain), h("div", { html: fmt(c.front).replace(/\n/g, "<br>") })),
      h("div", { class: "fc-face fc-back" }, h("span", { class: "lbl" }, c.kind === "trigger" ? "Pick" : "Answer"), h("div", { html: fmt(c.back).replace(/\n/g, "<br>") })));
    this.cardEl = card;
    root.append(h("div", { class: "row mb1 nowrap", style: { maxWidth: "720px", margin: "0 auto .6rem" } },
      h("span", { class: "b small" }, (this.i + 1) + " / " + this.queue.length),
      h("div", { class: "bar thin", style: { flex: "1" } }, h("div", { class: "fill", style: { width: pct(this.i, this.queue.length) + "%" } }))),
      h("div", { class: "fc-stage" }, card),
      h("div", { class: "row mt2", style: { justifyContent: "center" } },
        h("button", { class: "btn danger", type: "button", onclick: () => self.rate(false) }, "Again ", h("kbd", null, "1")),
        h("button", { class: "btn", type: "button", onclick: () => self.flip() }, "Flip ", h("kbd", null, "Space")),
        h("button", { class: "btn primary", type: "button", onclick: () => self.rate(true) }, "Got it ", h("kbd", null, "2"))));
  },
  flip() { this.flipped = !this.flipped; if (this.cardEl) this.cardEl.classList.toggle("flipped", this.flipped); },
  rate(good) {
    const id = this.queue[this.i];
    if (!id) return;
    Store.data.cards[id] = good ? Math.min(3, (Store.data.cards[id] || 0) + 1) : 0;
    Store.save();
    if (!good) this.queue.push(id);
    this.i++;
    this.flipped = false;
    this.render(this.root);
  },
  onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " " || e.key === "Enter") { if (e.target && e.target.tagName === "BUTTON") return; e.preventDefault(); this.flip(); }
    else if (e.key === "1") this.rate(false);
    else if (e.key === "2" || e.key === "ArrowRight") this.rate(true);
  }
};
