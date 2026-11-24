"use strict";
/* ---------- app shell ---------- */
const App = {
  view: "home",
  views: null,
  navItems: [["home", "Home"], ["exam", "Mock exam"], ["practice", "Practice"], ["review", "Rapid review"], ["cards", "Flashcards"], ["intel", "Exam intel"]],
  go(v) {
    if (!this.views[v]) v = "home";
    if (this.view === "exam" && v !== "exam") Exam.leave();
    this.view = v;
    if (location.hash !== "#" + v) {
      try { history.replaceState(null, "", "#" + v); } catch (e) { location.hash = v; }
    }
    this.render();
    window.scrollTo(0, 0);
  },
  render() {
    $$("#nav button").forEach(b => {
      if (b.getAttribute("data-v") === this.view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    this.views[this.view].render($("#view"));
  },
  /* "Last updated" banner and footer links, from build-time metadata */
  chrome() {
    const m = DATA.meta || {}, o = m.outline || {}, el = $("#stamp"), asOf = o.asOf || "April 16, 2026";
    const day = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); };
    if (el) {
      el.append(h("b", null, "Last updated " + day(m.updated) + ". "));
      if (o.state === "changed") {
        el.classList.add("warn");
        el.append("Microsoft has changed the AI-103 skills outline" + (o.liveAsOf && o.liveAsOf !== asOf ? " (now: skills measured as of " + o.liveAsOf + ")" : "") +
          ". This content still matches the " + asOf + " version and is being updated. ");
      } else {
        el.append("Matches the AI-103 skills measured as of " + asOf + ". ");
        if (o.state === "match" && o.checkedAt) el.append("Outline checked " + day(o.checkedAt) + ": no changes. ");
      }
      if (m.repo) el.append(h("a", { href: m.repo + "/commits/main/content", target: "_blank", rel: "noopener" }, "Change history"));
    }
    const foot = $("#footLinks");
    if (foot && m.repo) {
      foot.append(h("a", { href: m.repo, target: "_blank", rel: "noopener" }, "Source on GitHub"), "  ·  ",
        h("a", { href: m.repo + "/issues/new/choose", target: "_blank", rel: "noopener" }, "Report a mistake or suggest a question"));
    }
  },
  init() {
    Store.load();
    this.chrome();
    this.views = { home: Home, exam: Exam, practice: Practice, review: Review, cards: Cards, intel: Intel };
    document.documentElement.setAttribute("data-theme", Store.data.theme);
    Exam.init();
    const nav = $("#nav");
    this.navItems.forEach(([v, l]) => nav.append(h("button", { type: "button", "data-v": v, onclick: () => App.go(v) }, l)));
    $("#themeBtn").addEventListener("click", () => {
      Store.data.theme = Store.data.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", Store.data.theme);
      Store.save();
    });
    $("#resetBtn").addEventListener("click", () => modal("Reset saved progress?",
      "<p>This clears your answer history, flags, flashcard progress and mock exam attempts stored in this browser.</p>",
      [{ label: "Cancel" }, { label: "Reset everything", kind: "danger", onClick: () => {
        Exam.stopTimer(); Store.reset(); Exam.S = null; Exam.R = null; Exam.showResults = false; Practice.built = false; Cards.built = false;
        App.go("home"); toast("Progress cleared.");
      } }]));
    document.addEventListener("keydown", e => {
      const v = App.views[App.view];
      if (v && v.onKey && !$(".modal-back")) v.onKey(e);
    });
    window.addEventListener("hashchange", () => {
      const v = location.hash.slice(1);
      if (v && v !== App.view && App.views[v]) App.go(v);
    });
    window.addEventListener("beforeunload", () => { if (Exam.S && !Exam.S.done) Exam.persist(); });
    const start = location.hash.slice(1);
    this.view = this.views[start] ? start : "home";
    this.render();
  }
};
window.APP = { App, Home, Practice, Exam, Review, Cards, Intel, Store, DATA, QMAP, ALLQ, grade, buildExam, makeState, allocate };
App.init();
