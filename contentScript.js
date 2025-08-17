// contentScript.js - Student Buddy (with Save feedback + toast + guards)
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const WIDGET_ID = "student-buddy-widget";
  const STYLE_ID = "student-buddy-styles";
  const TOAST_ID = "student-buddy-toast";
  const THEME_KEY = "sb_theme";
  const TOTAL_XP_KEY = "sb_total_xp";
  const XP_PER_HINT = 10;
  const LEVEL_XP = 50;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root { --sb-bg: rgba(7,16,26,0.95); --sb-ink:#e6eef8; --sb-muted: rgba(255,255,255,0.68); }
      .sb-light { --sb-bg:#fff; --sb-ink:#082432; --sb-muted: rgba(8,36,50,0.7); }
      #${WIDGET_ID}{
        position:fixed; right:20px; top:120px; width:340px; max-width:calc(100vw - 32px);
        background:var(--sb-bg); color:var(--sb-ink); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        border:1px solid rgba(255,255,255,0.06); border-radius:12px; box-shadow:0 10px 28px rgba(2,6,23,0.5);
        backdrop-filter:blur(6px); z-index:999999; overflow:hidden;
      }
      #${WIDGET_ID} .sb-hdr{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; font-weight:700; font-size:14px; border-bottom:1px solid rgba(255,255,255,0.06); }
      #${WIDGET_ID} .sb-title{ display:flex; gap:10px; align-items:center; }
      #${WIDGET_ID} .logo{ width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c5cff,#00d4ff); display:flex;align-items:center;justify-content:center;font-weight:800;color:#021026; }
      #${WIDGET_ID} .sb-ctrl{ display:flex; gap:8px; padding:10px 12px; }
      #${WIDGET_ID} select,#${WIDGET_ID} button{ appearance:none; border-radius:8px; padding:8px 10px; font-size:13px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:inherit; cursor:pointer; }
      #${WIDGET_ID} button[disabled]{ opacity:.6; cursor:not-allowed; }
      #${WIDGET_ID} .sb-body{ padding:0 12px 12px 12px; font-size:13px; line-height:1.4; }
      #${WIDGET_ID} .sb-hint{ background:rgba(0,0,0,0.12); padding:10px; border-radius:8px; min-height:70px; max-height:240px; overflow:auto; font-family:ui-monospace,Menlo,Consolas,monospace; }
      #${WIDGET_ID} .sb-foot{ padding:10px 12px 12px; display:flex; justify-content:space-between; gap:8px; font-size:12px; color:var(--sb-muted); }
      #${WIDGET_ID} .sb-mini{ font-size:12px; opacity:0.9; }
      #${WIDGET_ID} .sb-progress{ height:6px; background:rgba(255,255,255,0.07); border-radius:5px; overflow:hidden; margin-top:8px; }
      #${WIDGET_ID} .sb-progress > i{ display:block; height:100%; width:0%; background:linear-gradient(90deg,#7c5cff,#00d4ff); transition:width .4s ease; }
      #${TOAST_ID}{ position:fixed; left:20px; bottom:24px; background:linear-gradient(90deg,#7c5cff,#00d4ff); color:#021026; padding:10px 14px; border-radius:10px; box-shadow:0 8px 20px rgba(2,6,23,.45); z-index:1000000; opacity:0; transform:translateY(12px); transition:opacity .22s ease, transform .22s ease; }
      #${TOAST_ID}.show{ opacity:1; transform:translateY(0); }
      @media (max-width:420px){ #${WIDGET_ID}{ right:10px; left:10px; width:auto; top:90px; } }
    `;
    document.head.appendChild(style);
  }

  function toast(msg, ms = 1800) {
    let t = document.getElementById(TOAST_ID);
    if (!t) { t = document.createElement("div"); t.id = TOAST_ID; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); }, ms);
  }

  function detectProblem() {
    const titleEl =
      document.querySelector('div[data-cy="question-title"] h3') ||
      document.querySelector('div[data-cy="question-title"]') ||
      document.querySelector(".question-title h3") ||
      document.querySelector(".problem-title") ||
      document.querySelector("h1, h2, h3");
    const title = (titleEl && titleEl.textContent.trim()) || document.title || "Unknown problem";
    const slug = (location.pathname.split("/").filter(Boolean).pop() || "unknown").replace(/[^a-z0-9\-]/gi, "");
    return { title, slug, url: location.href };
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function parseStages(text) {
    const plain = String(text || "");
    const labels = ["Concept:", "Approach:", "Example:"];
    const lower = plain.toLowerCase();
    const idxs = [];
    labels.forEach((L) => {
      const i = lower.indexOf(L.toLowerCase());
      if (i !== -1) idxs.push({ label: L, i, len: L.length });
    });
    if (idxs.length) {
      idxs.sort((a, b) => a.i - b.i);
      const out = [];
      for (let k = 0; k < idxs.length; k++) {
        const start = idxs[k].i + idxs[k].len;
        const end = k + 1 < idxs.length ? idxs[k + 1].i : plain.length;
        out.push(`<b>${escapeHtml(idxs[k].label)}</b> ${escapeHtml(plain.slice(start, end).trim())}`);
      }
      return out;
    }
    return plain
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((p) => escapeHtml(p));
  }

  function addXp() {
    try {
      chrome.storage?.local?.get([TOTAL_XP_KEY], (res) => {
        const total = (res?.[TOTAL_XP_KEY] || 0) + XP_PER_HINT;
        chrome.storage?.local?.set({ [TOTAL_XP_KEY]: total }, () => {
          const w = document.getElementById(WIDGET_ID);
          if (!w) return;
          const xpEl = w.querySelector("#sb-xp");
          const bar = w.querySelector(".sb-progress > i");
          if (xpEl) xpEl.textContent = String(total);
          if (bar) {
            const pct = Math.min(100, ((total % LEVEL_XP) / LEVEL_XP) * 100);
            bar.style.width = pct + "%";
          }
        });
      });
    } catch (e) {}
  }

  let stages = [];
  let stageIdx = 0;

  function createWidget() {
    injectStyles();
    if (document.getElementById(WIDGET_ID)) return document.getElementById(WIDGET_ID);

    const el = document.createElement("div");
    el.id = WIDGET_ID;
    el.innerHTML = `
      <div class="sb-hdr">
        <div class="sb-title">
          <div class="logo">SB</div>
          <div>
            <div style="font-weight:800">Student Buddy</div>
            <div class="sb-mini" id="sb-prob-title">Detecting problem...</div>
            <div class="sb-mini" id="sb-prob-slug"></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <div class="sb-mini" id="sb-xp">0</div>
          <button id="sb-theme" title="Toggle theme">🌓</button>
          <button id="sb-close" title="Close">✕</button>
        </div>
      </div>

      <div class="sb-ctrl">
        <select id="sb-difficulty">
          <option value="easy">Easy</option>
          <option value="medium" selected>Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button id="sb-get">Get Hint</button>
        <button id="sb-discuss" title="Open discuss">Discuss</button>
      </div>

      <div class="sb-body">
        <div class="sb-hint" id="sb-hint">Hints will appear here. Click "Get Hint".</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button id="sb-copy" disabled>Copy</button>
          <button id="sb-save" disabled>Save</button>
        </div>
        <div class="sb-progress"><i></i></div>
      </div>

      <div class="sb-foot">
        <span>Tip: reveal hints step-by-step</span>
        <span>Status: <span id="sb-status">Ready</span></span>
      </div>
    `;
    document.body.appendChild(el);

    // Theme + XP init
    try {
      chrome.storage?.local?.get([THEME_KEY, TOTAL_XP_KEY], (res) => {
        if (res?.[THEME_KEY] === "light") el.classList.add("sb-light");
        const total = res?.[TOTAL_XP_KEY] || 0;
        el.querySelector("#sb-xp").textContent = String(total);
        const bar = el.querySelector(".sb-progress > i");
        if (bar) {
          const pct = Math.min(100, ((total % LEVEL_XP) / LEVEL_XP) * 100);
          bar.style.width = pct + "%";
        }
      });
    } catch (e) {}

    // Events
    el.querySelector("#sb-close").addEventListener("click", () => el.remove());
    el.querySelector("#sb-theme").addEventListener("click", () => {
      el.classList.toggle("sb-light");
      const mode = el.classList.contains("sb-light") ? "light" : "dark";
      try { chrome.storage?.local?.set({ [THEME_KEY]: mode }); } catch (e) {}
    });

    el.querySelector("#sb-get").addEventListener("click", () => {
      if (stages.length && stageIdx < stages.length) {
        revealStage(el);
        return;
      }
      requestHint(el);
    });

    el.querySelector("#sb-copy").addEventListener("click", () => {
      const last = stages[Math.max(0, stageIdx - 1)] || "";
      const text = last.replace(/<[^>]+>/g, "");
      if (!text) { toast("Reveal a hint first"); return; }
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => toast("Copied"));
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); toast("Copied"); } catch (e) {}
        ta.remove();
      }
    });

    el.querySelector("#sb-save").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const prob = detectProblem();
      const last = stages[Math.max(0, stageIdx - 1)] || "";
      const plain = last.replace(/<[^>]+>/g, "").trim();
      if (!plain) { toast("Reveal a hint first"); return; }
      try {
        chrome.storage?.local?.get(["sb_notes"], (res) => {
          const arr = res?.sb_notes || [];
          arr.unshift({ time: Date.now(), slug: prob.slug, title: prob.title, hint: plain });
          chrome.storage?.local?.set({ sb_notes: arr }, () => {
            btn.disabled = true;
            const old = btn.textContent;
            btn.textContent = "Saved ✓";
            toast("Saved to notes");
            setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1000);
          });
        });
      } catch (e) {
        toast("Save failed");
      }
    });

    el.querySelector("#sb-discuss").addEventListener("click", () => {
      const prob = detectProblem();
      const url = prob.url.endsWith("/") ? prob.url + "discuss" : prob.url + "/discuss";
      window.open(url, "_blank");
    });

    // Initial meta + store for popup
    renderMeta(el);
    try { chrome.runtime?.sendMessage({ type: "PROBLEM_META", payload: detectProblem() }, () => {}); } catch (e) {}

    return el;
  }

  function renderMeta(el) {
    const prob = detectProblem();
    el.querySelector("#sb-prob-title").textContent = prob.title || "Unknown problem";
    el.querySelector("#sb-prob-slug").textContent = prob.slug || "";
  }

  function revealStage(el) {
    const box = el.querySelector("#sb-hint");
    if (!box) return;
    if (stageIdx < stages.length) {
      box.innerHTML = stages[stageIdx];
      stageIdx++;
      el.querySelector("#sb-copy").disabled = false;
      el.querySelector("#sb-save").disabled = false;
      const btn = el.querySelector("#sb-get");
      btn.textContent = stageIdx >= stages.length ? "All shown" : "Reveal Next";
      if (stageIdx >= stages.length) btn.disabled = true;
    }
  }

  function requestHint(el) {
    const status = el.querySelector("#sb-status");
    const btn = el.querySelector("#sb-get");
    const prob = detectProblem();
    const diff = el.querySelector("#sb-difficulty").value;

    status.textContent = "Requesting hint...";
    btn.disabled = true;
    btn.textContent = "Loading...";

    try {
      chrome.runtime?.sendMessage(
        { type: "REQUEST_HINT", problem: prob, difficulty: diff },
        (resp) => {
          const fallback = "Concept: Restate the problem.\nApproach: Sketch brute-force and one optimization.\nExample: Walk a tiny case.";
          const text = resp?.hint || fallback;
          stages = parseStages(text);
          stageIdx = 0;
          status.textContent = `Hint (${resp?.category || 'general'}, ${resp?.difficulty || diff})`;
          btn.disabled = false;
          btn.textContent = "Get Hint";
          revealStage(el);
          addXp();
        }
      );
    } catch (e) {
      stages = parseStages("Concept: Restate.\nApproach: Brute then optimize.\nExample: Tiny path.");
      stageIdx = 0;
      status.textContent = "Offline (fallback)";
      btn.disabled = false;
      btn.textContent = "Get Hint";
      revealStage(el);
    }
  }

  const widget = createWidget();

  // Keep header fresh on SPA changes (throttled)
  let t = null;
  const mo = new MutationObserver(() => {
    if (t) return;
    t = setTimeout(() => { if (document.body.contains(widget)) renderMeta(widget); t = null; }, 500);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Popup support
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "GET_META" || msg.action === "getProblem") {
      const p = detectProblem();
      sendResponse({ ...p, problemName: p.title });
      return true;
    }
  });
})();
