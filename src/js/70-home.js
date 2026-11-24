"use strict";
/* ---------- home dashboard ---------- */
const Home = {
  render(root) {
    root.textContent = "";
    const r = readiness(), intel = DATA.intel || {};
    const running = Exam.S && !Exam.S.done;
    const missed = ALLQ.filter(q => { const s = statusOf(q.id); return s === "bad" || s === "part"; });
    const hot = ALLQ.filter(q => q.hot);
    const tile = (title, sub, fn) => h("button", { class: "tile", type: "button", onclick: fn }, h("b", null, title), h("span", null, sub));

    root.append(h("div", { class: "hero" },
      h("div", { class: "row between top" },
        h("div", { style: { flex: "1", minWidth: "280px" } },
          h("div", { class: "tiny muted b" }, "EXAM AI-103  ·  AZURE AI APPS AND AGENTS DEVELOPER ASSOCIATE"),
          h("h1", null, "Developing AI Apps and Agents on Azure"),
          h("p", { class: "muted mt0 mb0" }, "Free practice exams, cheat sheets and flashcards, built from the official skills outline, current Microsoft Learn docs and what candidates report.")),
        h("div", { class: "row" },
          running ? h("button", { class: "btn primary lg", type: "button", onclick: () => App.go("exam") }, "Resume mock exam (" + clock(Exam.S.left) + " left)")
            : h("button", { class: "btn primary lg", type: "button", onclick: () => App.go("exam") }, "Start a mock exam"),
          h("button", { class: "btn lg", type: "button", onclick: () => Review.open("deltas") }, "Era traps: read first"))),
      h("div", { class: "facts" }, (intel.facts || []).map(f => h("div", { class: "fact" }, h("b", null, f.k), f.v)))));

    root.append(h("div", { class: "callout warn mt2" }, h("b", null, "This exam was written in April 2026, and Microsoft Learn has moved on since. "),
      "Azure AI Search is now called Foundry IQ, the Azure AI roles are now Foundry roles, and the Low and High content-filter labels have swapped meaning. Expect the April wording in the questions. ",
      h("a", { href: "#review", onclick: e => { e.preventDefault(); Review.open("deltas"); } }, "See all the era traps")));

    root.append(h("div", { class: "grid g4 mt2" },
      tile("Hot-topic drill", hot.length + " questions on what candidates report seeing", () => Practice.start({ hot: true })),
      tile("Weak spots", missed.length ? missed.length + " questions you missed or half-got" : "Nothing missed yet. Answer some questions first", () => {
        if (missed.length) Practice.start({ ids: missed.map(q => q.id), label: "Your weak spots" }); else Practice.start({});
      }),
      tile("Trigger phrases", DATA.triggers.length + " “when you see X, pick Y” rules", () => Review.open("triggers")),
      tile("Flashcards", DATA.flashcards.length + " cards, two correct in a row retires one", () => App.go("cards"))));

    const est = r.score != null && r.coverage >= 0.12
      ? h("span", { class: "chip " + (r.score >= 0.7 ? "ok" : "bad"), title: "Accuracy on your latest attempt at each question, weighted by the blueprint" }, "≈ " + Math.round(r.score * 1000) + " / 1000 on " + pct(r.coverage, 1) + "% of the bank")
      : h("span", { class: "chip" }, "Answer more questions for an estimate");
    const rc = h("div", { class: "card" }, h("div", { class: "row between mb1" }, h("h3", { class: "mb0" }, "Readiness by skill area"), est));
    DATA.domains.forEach(d => {
      const s = r.st[d.id], acc = s.t ? pct(s.e, s.t) : null;
      rc.append(h("div", { class: "domrow" },
        h("div", null, h("span", { class: "chip d" + d.id }, "D" + d.id), " ", h("span", { class: "small b" }, d.short),
          h("div", { class: "tiny faint" }, d.weight[0] + "-" + d.weight[1] + "% of the exam  ·  " + s.seen + " of " + s.total + " seen")),
        h("div", { class: "bar" }, h("div", { class: "fill", style: { width: (acc || 0) + "%", background: "var(--d" + d.id + ")" } }), h("div", { class: "mark", style: { left: "70%" } })),
        h("div", { class: "row nowrap" }, h("span", { class: "small b", style: { minWidth: "2.8rem", textAlign: "right" } }, acc == null ? "–" : acc + "%"),
          h("button", { class: "btn sm", type: "button", onclick: () => Practice.start({ dom: [d.id] }) }, "Drill"),
          h("button", { class: "btn sm ghost", type: "button", onclick: () => Review.open("d" + d.id) }, "Notes"))));
    });
    rc.append(h("p", { class: "tiny muted mb0 mt1" }, "The line marks 70%. Bars use your most recent attempt at each question, with partial credit."));

    const pc = h("div", { class: "card" }, h("h3", null, "One-evening plan"),
      h("p", { class: "small muted mt0" }, "Exam tomorrow? This order gets the most out of about four hours."));
    (DATA.plan || []).forEach(p => {
      const cb = h("input", { type: "checkbox" });
      cb.checked = !!Store.data.plan[p.id];
      const row = h("label", { class: "check" + (cb.checked ? " done" : "") }, cb,
        h("span", null, h("b", null, p.title), " ", h("span", { class: "chip" }, p.min), h("div", { class: "small muted" }, p.detail)));
      cb.addEventListener("change", () => { Store.data.plan[p.id] = cb.checked; Store.save(); row.classList.toggle("done", cb.checked); });
      pc.append(row);
    });
    root.append(h("div", { class: "grid g2 mt2" }, rc, pc));

    const hc = h("div", { class: "card" }, h("div", { class: "row between" }, h("h3", { class: "mb0" }, "What candidates say comes up"),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => App.go("intel") }, "All exam intel →")));
    (intel.hot || []).slice(0, 6).forEach((t, i) => {
      const qs = hotMatches(t);
      hc.append(h("div", { class: "rank" }, h("span", { class: "n" }, i + 1),
        h("div", { class: "row between nowrap top" }, h("div", null, h("b", null, t.title), h("div", { class: "small muted", html: fmt(t.why) })),
          h("button", { class: "btn sm", type: "button", style: { flex: "none" }, onclick: () => Practice.start({ ids: qs.map(q => q.id), label: "Hot topic: " + t.title }) }, "Drill " + qs.length))));
    });
    const types = {};
    ALLQ.forEach(q => { const k = typeLabel(q).replace(/Choose \d/, "Multiple answer"); types[k] = (types[k] || 0) + 1; });
    const bc = h("div", { class: "card" }, h("h3", null, "What's in here"),
      h("div", { class: "grid g2" },
        h("div", { class: "kpi" }, h("b", null, String(ALLQ.length)), h("span", null, "original questions, each with an explanation and a Learn link")),
        h("div", { class: "kpi" }, h("b", null, String((DATA.caseStudies || []).length)), h("span", null, "case studies, plus locked solution series")),
        h("div", { class: "kpi" }, h("b", null, String(DATA.domains.reduce((a, d) => a + (DATA.cheats[d.id] || []).length, 0))), h("span", null, "cheat-sheet sections")),
        h("div", { class: "kpi" }, h("b", null, String(DATA.flashcards.length)), h("span", null, "flashcards"))),
      h("div", { class: "pills mt2" }, Object.keys(types).map(k => h("span", { class: "chip" }, k + " " + types[k]))),
      h("p", { class: "tiny muted mb0 mt1" }, "Original practice questions written against Microsoft Learn documentation, not real exam items. Your progress is saved in this browser only."));
    root.append(h("div", { class: "grid g2 mt2" }, hc, bc));
  }
};

/* ---------- exam intel ---------- */
const Intel = {
  render(root) {
    root.textContent = "";
    const I = DATA.intel || {};
    const list = items => h("ul", { style: { margin: ".2rem 0", paddingLeft: "1.15rem" } }, (items || []).map(t => h("li", { html: fmt(t), style: { margin: ".35rem 0" } })));
    root.append(h("h1", null, "Exam intel"),
      h("p", { class: "muted mt0" }, "What the official pages say, and what people who sat AI-103 this year report. Recollections differ between forms, so treat counts as typical rather than guaranteed."));
    root.append(h("div", { class: "grid g2" },
      h("div", { class: "card" }, h("h3", null, "Format"), simpleTable(["", "What to expect"], I.format || [])),
      h("div", { class: "card" }, h("h3", null, "Time strategy"), list(I.strategy))));
    const hc = h("div", { class: "card mt2" }, h("h3", null, "Reported hot topics, ranked by how often they come up"));
    (I.hot || []).forEach((t, i) => {
      const qs = hotMatches(t);
      hc.append(h("div", { class: "rank" }, h("span", { class: "n" }, i + 1),
        h("div", { class: "row between nowrap top" },
          h("div", null, h("b", null, t.title), " ", t.src ? h("span", { class: "tiny faint" }, t.src) : null, h("div", { class: "small muted", html: fmt(t.why) })),
          h("button", { class: "btn sm", type: "button", style: { flex: "none" }, onclick: () => Practice.start({ ids: qs.map(q => q.id), label: "Hot topic: " + t.title }) }, "Drill " + qs.length))));
    });
    root.append(hc);
    root.append(h("div", { class: "grid g2 mt2" },
      h("div", { class: "card" }, h("h3", null, "How the questions are written"), list(I.styles)),
      h("div", { class: "card" }, h("h3", null, "Using Microsoft Learn during the exam"), list(I.learn),
        h("button", { class: "btn sm mt1", type: "button", onclick: () => Review.open("lookup") }, "Open the Learn lookup map"))));
    root.append(h("div", { class: "card mt2" }, h("h3", null, "Sources"),
      h("ul", { class: "src", style: { paddingLeft: "1.15rem" } }, (I.sources || []).map(s => h("li", null,
        h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title), s.note ? h("span", { class: "muted" }, "  " + s.note) : null))),
      I.caveat ? h("p", { class: "small muted mb0" }, I.caveat) : null));
  }
};
