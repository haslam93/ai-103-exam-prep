"use strict";
/* ---------- question rendering (shared by practice, exam and review) ---------- */
const LETTERS = "ABCDEFGH";
let uidSeq = 0;

function qHead(q, opt) {
  if (opt.meta === false) {
    return h("div", { class: "q-head" },
      opt.num ? h("span", { class: "b" }, "Question " + opt.num) : null,
      h("span", { class: "chip" }, typeLabel(q)));
  }
  const d = DOM[q.domain], o = OBJ[q.objective], lvl = q.difficulty || 1;
  return h("div", { class: "q-head" },
    opt.num ? h("span", { class: "b" }, "Q" + opt.num) : null,
    h("span", { class: "chip d" + q.domain, title: d ? d.name : "" }, d ? d.short : "Domain " + q.domain),
    q.objective ? h("span", { class: "chip", title: o ? o.name : "" }, q.objective) : null,
    h("span", { class: "chip" }, typeLabel(q)),
    q.hot ? h("span", { class: "chip hot", title: "Candidates report this topic on the exam" }, "hot topic") : null,
    q.caseId ? h("span", { class: "chip" }, "Case study") : null,
    h("span", { class: "dots", title: "Difficulty " + lvl + " of 3", html: "<b>" + "●".repeat(lvl) + "</b>" + "●".repeat(3 - lvl) }),
    h("span", { class: "spacer" }),
    h("span", { class: "tiny faint mono" }, q.id));
}

function blankMaker(q, st, opt) {
  const locked = opt.locked || opt.showAnswer;
  return n => {
    const i = n - 1, b = q.blanks[i];
    if (!b) return null;
    const ord = (st.bord && st.bord[i]) || b.options.map((_, k) => k);
    const sel = h("select", { class: "dd", "aria-label": "Drop-down " + n, disabled: locked ? true : null });
    sel.append(h("option", { value: "" }, "Select…"));
    ord.forEach(oi => sel.append(h("option", { value: String(oi) }, b.options[oi])));
    sel.value = st.resp[i] == null ? "" : String(st.resp[i]);
    sel.addEventListener("change", () => {
      st.resp[i] = sel.value === "" ? null : +sel.value;
      if (opt.onChange) opt.onChange();
    });
    if (!opt.showAnswer) return sel;
    const good = st.resp[i] === b.answer;
    sel.classList.add(good ? "correct" : "wrong");
    return h("span", null, sel, good ? null : h("span", { class: "dd-fix" }, "✓ " + b.options[b.answer]));
  };
}

function renderChoices(q, st, opt) {
  const locked = opt.locked || opt.showAnswer;
  const single = q.type === "single";
  const box = h("div", { class: "opts", role: single ? "radiogroup" : "group" });
  const isSel = oi => (single ? st.resp === oi : st.resp.includes(oi));
  const paint = () => $$(".opt", box).forEach(b => {
    const on = isSel(+b.getAttribute("data-oi"));
    b.classList.toggle("sel", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
  st.ord.forEach((oi, pos) => {
    const sel = isSel(oi), ans = q.answer.includes(oi);
    let cls = "opt", tag = null;
    if (opt.showAnswer) {
      cls += " locked" + (ans ? " correct" : sel ? " wrong" : "");
      tag = ans && sel ? "your answer ✓" : ans ? "correct answer" : sel ? "your answer ✗" : null;
    } else {
      if (sel) cls += " sel";
      if (locked) cls += " locked";
    }
    const b = h("button", {
      class: cls, type: "button", role: single ? "radio" : "checkbox",
      "aria-checked": sel ? "true" : "false", "data-oi": oi, tabindex: locked ? "-1" : "0"
    },
      h("span", { class: "key" }, LETTERS[pos]),
      h("span", { html: fmt(q.options[oi]) }),
      tag ? h("span", { class: "tag", style: { color: ans ? "var(--ok)" : "var(--bad)" } }, tag) : null);
    if (!locked) {
      b.addEventListener("click", () => {
        if (single) st.resp = oi;
        else if (st.resp.includes(oi)) st.resp = st.resp.filter(x => x !== oi);
        else if (st.resp.length >= q.answer.length) { toast("Only " + q.answer.length + " answers allowed. Deselect one first."); return; }
        else st.resp = st.resp.concat(oi);
        paint();
        if (opt.onChange) opt.onChange();
      });
    }
    box.append(b);
  });
  return box;
}

function renderYesNo(q, st, opt) {
  const locked = opt.locked || opt.showAnswer;
  const gid = "yn" + (++uidSeq);
  const tb = h("tbody");
  q.statements.forEach((s, i) => {
    const radio = val => {
      const inp = h("input", { type: "radio", name: gid + "_" + i, "aria-label": val ? "Yes" : "No", disabled: locked ? true : null });
      inp.checked = st.resp[i] === val;
      inp.addEventListener("change", () => { st.resp[i] = val; if (opt.onChange) opt.onChange(); });
      return inp;
    };
    const good = st.resp[i] === s.answer;
    tb.append(h("tr", { class: opt.showAnswer ? (good ? "correct" : "wrong") : "" },
      h("td", null, h("span", { html: fmt(s.text) }),
        opt.showAnswer ? h("div", { class: "tiny b", style: { color: good ? "var(--ok)" : "var(--bad)" } }, "Answer: " + (s.answer ? "Yes" : "No")) : null),
      h("td", { class: "c" }, radio(true)),
      h("td", { class: "c" }, radio(false))));
  });
  return h("table", { class: "yn" },
    h("thead", null, h("tr", null, h("th", null, "Statement"), h("th", { class: "c" }, "Yes"), h("th", { class: "c" }, "No"))), tb);
}

function renderOrder(q, st, opt) {
  const all = q.items.concat(q.distractors || []);
  const locked = opt.locked || opt.showAnswer;
  const root = h("div");
  const changed = () => { paint(); if (opt.onChange) opt.onChange(); };
  const drag = (el, i) => {
    if (locked) return;
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; });
  };
  function paint() {
    root.textContent = "";
    const poolL = h("div", { class: "order-list" }), ansL = h("div", { class: "order-list" });
    st.pool.filter(i => !st.resp.includes(i)).forEach(i => {
      const it = h("div", { class: "order-item", title: locked ? "" : "Click to add to the answer area" },
        h("span", { class: "txt", html: fmt(all[i]) }),
        locked ? null : h("span", { class: "mv" }, h("button", { type: "button", "aria-label": "Add to answer area" }, "→")));
      if (!locked) it.addEventListener("click", () => { st.resp.push(i); changed(); });
      drag(it, i);
      poolL.append(it);
    });
    st.resp.forEach((i, pos) => {
      const swap = (a, b) => { [st.resp[a], st.resp[b]] = [st.resp[b], st.resp[a]]; changed(); };
      const it = h("div", { class: "order-item" + (opt.showAnswer ? (i === pos && i < q.items.length ? " correct" : " wrong") : ""), "data-pos": pos },
        h("span", { class: "n" }, pos + 1),
        h("span", { class: "txt", html: fmt(all[i]) }),
        locked ? null : h("span", { class: "mv" },
          h("button", { type: "button", "aria-label": "Move up", onclick: () => { if (pos > 0) swap(pos, pos - 1); } }, "↑"),
          h("button", { type: "button", "aria-label": "Move down", onclick: () => { if (pos < st.resp.length - 1) swap(pos, pos + 1); } }, "↓"),
          h("button", { type: "button", "aria-label": "Remove", onclick: () => { st.resp.splice(pos, 1); changed(); } }, "✕")));
      drag(it, i);
      ansL.append(it);
    });
    if (!locked) {
      [poolL, ansL].forEach(list => {
        list.addEventListener("dragover", e => { e.preventDefault(); list.classList.add("over"); });
        list.addEventListener("dragleave", () => list.classList.remove("over"));
      });
      ansL.addEventListener("drop", e => {
        e.preventDefault();
        const i = +e.dataTransfer.getData("text/plain");
        const target = e.target.closest ? e.target.closest(".order-item") : null;
        let to = target && target.hasAttribute("data-pos") ? +target.getAttribute("data-pos") : st.resp.length;
        const from = st.resp.indexOf(i);
        if (from >= 0) { st.resp.splice(from, 1); if (from < to) to--; }
        st.resp.splice(to, 0, i);
        changed();
      });
      poolL.addEventListener("drop", e => {
        e.preventDefault();
        const from = st.resp.indexOf(+e.dataTransfer.getData("text/plain"));
        if (from >= 0) { st.resp.splice(from, 1); changed(); }
      });
    }
    root.append(h("div", { class: "order" },
      h("div", null, h("h4", null, "Actions"), poolL),
      h("div", null, h("h4", null, "Answer area"), ansL)));
    if (opt.showAnswer) {
      root.append(h("div", { class: "mt1" }, h("h4", { class: "muted" }, "Correct sequence"),
        h("div", { class: "order-list" }, q.items.map((t, i) => h("div", { class: "order-item correct" },
          h("span", { class: "n" }, i + 1), h("span", { class: "txt", html: fmt(t) }))))));
    }
  }
  paint();
  return root;
}

function renderExplain(q, st, g) {
  let cls = "explain", verdict = st.peek ? "Answer revealed" : "Not answered";
  if (g && g.attempted && !st.peek) {
    if (g.full) { cls += " ok"; verdict = "Correct"; }
    else if (g.earned > 0) { cls += " part"; verdict = "Partly correct: " + g.earned + " of " + g.total + " parts"; }
    else { cls += " bad"; verdict = "Incorrect"; }
  }
  return h("div", { class: cls },
    h("div", { class: "verdict" }, verdict),
    h("div", { html: fmtBlock(q.explanation) }),
    q.ref && q.ref.url ? h("div", { class: "ref" }, "Microsoft Learn: ",
      h("a", { href: q.ref.url, target: "_blank", rel: "noopener" }, q.ref.title || q.ref.url)) : null,
    DATA.meta && DATA.meta.repo ? h("div", { class: "tiny mt1" }, h("a", {
      class: "faint", target: "_blank", rel: "noopener",
      href: DATA.meta.repo + "/issues/new?template=question-error.yml&title=" + encodeURIComponent("[" + q.id + "] ") + "&question=" + encodeURIComponent(q.id)
    }, "Report a problem with this question")) : null);
}

/* opt: { showAnswer, locked, onChange, num, meta } */
function renderQ(q, st, opt) {
  opt = opt || {};
  const el = h("div", { class: "q" }, qHead(q, opt));
  const mk = q.type === "dropdown" ? blankMaker(q, st, opt) : null;
  const stem = h("div", { class: "q-stem" });
  String(q.stem).split(/\n{2,}/).forEach(p => { const pe = h("p"); pe.append(textNodes(p, mk)); stem.append(pe); });
  el.append(stem);
  if (q.code) { const pre = h("pre"); pre.append(codeNodes(q.code, mk)); el.append(pre); }
  if (q.type === "multi") el.append(h("div", { class: "q-instr" }, "Select " + q.answer.length + " answers."));
  if (q.type === "order") el.append(h("div", { class: "q-instr" }, "Move actions to the answer area and arrange them in the correct order."));
  if (q.type === "dropdown") el.append(h("div", { class: "q-instr" }, "Choose the correct option in each drop-down."));
  if (q.type === "single" || q.type === "multi") el.append(renderChoices(q, st, opt));
  else if (q.type === "yesno") el.append(renderYesNo(q, st, opt));
  else if (q.type === "order") el.append(renderOrder(q, st, opt));
  if (opt.showAnswer) el.append(renderExplain(q, st, grade(q, st.resp)));
  return el;
}

/* ---------- case study panel ---------- */
function richText(body) {
  const root = h("div", { class: "casebody" });
  let ul = null;
  String(body).split("\n").forEach(line => {
    const t = line.trim();
    if (!t) { ul = null; return; }
    if (t.slice(0, 2) === "- ") {
      if (!ul) { ul = h("ul"); root.append(ul); }
      ul.append(h("li", { html: fmt(t.slice(2)) }));
    } else {
      ul = null;
      root.append(t.slice(0, 3) === "## " ? h("h4", { class: "mt1", html: fmt(t.slice(3)) }) : h("p", { html: fmt(t) }));
    }
  });
  return root;
}
function casePanel(cs, ui) {
  const body = h("div"), tabs = h("div", { class: "tabs" });
  const paint = () => {
    tabs.textContent = "";
    cs.tabs.forEach((t, i) => tabs.append(h("button", {
      type: "button", class: i === ui.tab ? "on" : "", onclick: () => { ui.tab = i; paint(); }
    }, t.title)));
    body.textContent = "";
    body.append(richText(cs.tabs[ui.tab].body));
  };
  paint();
  return h("div", { class: "card casepanel" }, h("div", { class: "tiny muted b" }, "CASE STUDY"), h("h3", null, cs.title), tabs, body);
}
