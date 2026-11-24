"use strict";
/* ---------- tiny DOM + formatting helpers ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/* inline: `code` and **bold** only */
function fmt(s) {
  return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}
function fmtBlock(s) {
  return String(s == null ? "" : s).split(/\n{2,}/).map(p => "<p>" + fmt(p).replace(/\n/g, "<br>") + "</p>").join("");
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function clock(sec) {
  sec = Math.max(0, Math.round(sec));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const p = n => String(n).padStart(2, "0");
  return hh ? hh + ":" + p(mm) + ":" + p(ss) : p(mm) + ":" + p(ss);
}
function pct(a, b) { return b ? Math.round((100 * a) / b) : 0; }

/* ---------- code rendering with light syntax colouring + [[n]] blanks ---------- */
const KW = "from|import|as|def|return|if|else|elif|for|in|while|with|try|except|finally|class|async|await|not|and|or|is|None|True|False|true|false|null|lambda|raise|pass|break|continue|yield|const|let|var|function|new|param|resource";
const TOK = new RegExp(
  "(\\[\\[\\d+\\]\\])" +
  "|((?:^|(?<=\\s))(?:#|//).*$)" +
  "|(\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:[^\"\\\\\\n]|\\\\.)*\"|'(?:[^'\\\\\\n]|\\\\.)*')" +
  "|\\b(\\d+(?:\\.\\d+)?)\\b" +
  "|\\b(" + KW + ")\\b", "gm");
const BLANK = /(\[\[\d+\]\])/;

function codeNodes(code, mkBlank) {
  const frag = document.createDocumentFragment();
  const push = (text, cls) => { if (text) frag.append(cls ? h("span", { class: cls }, text) : document.createTextNode(text)); };
  const blank = tok => {
    const node = mkBlank ? mkBlank(+tok.slice(2, -2)) : null;
    frag.append(node || document.createTextNode(tok));
  };
  let last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(code))) {
    push(code.slice(last, m.index));
    const split = cls => tok => tok.split(BLANK).forEach(part => (/^\[\[\d+\]\]$/.test(part) ? blank(part) : push(part, cls)));
    if (m[1]) blank(m[1]);
    else if (m[2]) split("tok-com")(m[2]);
    else if (m[3]) split("tok-str")(m[3]);
    else if (m[4]) push(m[4], "tok-num");
    else if (m[5]) push(m[5], "tok-kw");
    last = m.index + m[0].length;
    if (!m[0].length) TOK.lastIndex++;
  }
  push(code.slice(last));
  return frag;
}
/* prose with optional [[n]] blanks */
function textNodes(text, mkBlank) {
  const frag = document.createDocumentFragment();
  String(text).split(BLANK).forEach(part => {
    if (/^\[\[\d+\]\]$/.test(part)) {
      const node = mkBlank ? mkBlank(+part.slice(2, -2)) : null;
      frag.append(node || document.createTextNode(part));
    } else if (part) frag.append(h("span", { html: fmt(part).replace(/\n/g, "<br>") }));
  });
  return frag;
}

/* ---------- persistence (falls back to memory if storage is unavailable) ---------- */
const Store = {
  key: "ai103.cram.v1",
  data: null,
  load() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { d = {}; }
    d.hist = d.hist || {};
    d.cards = d.cards || {};
    d.exams = d.exams || [];
    d.plan = d.plan || {};
    d.settings = Object.assign({ shuffle: true }, d.settings || {});
    d.theme = d.theme || "dark";
    this.data = d;
    return d;
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* memory only */ } },
  reset() { try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ } this.load(); }
};

/* ---------- toast + modal ---------- */
let toastTimer = null;
function toast(msg) {
  $$(".toast").forEach(t => t.remove());
  const t = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}
function modal(title, body, actions) {
  const back = h("div", { class: "modal-back" });
  const close = () => back.remove();
  const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true" },
    h("h2", null, title),
    typeof body === "string" ? h("div", { html: body }) : body,
    h("div", { class: "row mt2", style: { justifyContent: "flex-end" } },
      (actions || [{ label: "Close" }]).map(a => h("button", {
        class: "btn " + (a.kind || ""), type: "button",
        onclick: () => { close(); if (a.onClick) a.onClick(); }
      }, a.label))));
  back.append(box);
  back.addEventListener("click", e => { if (e.target === back) close(); });
  document.body.append(back);
  const first = box.querySelector(".btn.primary") || box.querySelector(".btn");
  if (first) first.focus();
  return close;
}
function typing(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
