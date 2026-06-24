/* ============================================================
   AIHarness — architecture pipeline animation + nav + reveal
   Vanilla JS, no dependencies. Respects prefers-reduced-motion.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- pipeline data ---------- */
  var STAGES = [
    {
      stage: "Inputs",
      title: "Code in",
      meta: "paste · Git URL · CI/CD API · PR webhook",
      detail: "A scan starts from anywhere it's needed: pasted source, a Git repository URL, a call from your CI/CD pipeline, or a pull-request webhook that gates a merge.",
      standards: ["SSDF SP 800-218", "CI/PR gate"]
    },
    {
      stage: "Orchestrator",
      title: "Orchestrator Worker (Hono)",
      meta: "validate · envelope-encrypt key · enqueue",
      detail: "A Cloudflare Worker running Hono validates the request, envelope-encrypts your BYO model key, and enqueues the job. It never persists the plaintext key.",
      standards: ["ASVS 5.0", "ISO/IEC 27001"]
    },
    {
      stage: "Queue",
      title: "Cloudflare Queue",
      meta: "durable, fail-fast hand-off",
      detail: "The job is handed to a Cloudflare Queue for durable, decoupled processing. Configuration fails fast and honestly rather than silently degrading.",
      standards: ["NIST CSF 2.0"]
    },
    {
      stage: "ScanRunner",
      title: "ScanRunner — Durable Object + Container",
      meta: "Semgrep · deterministic SAST",
      detail: "A Durable Object drives a Container running Semgrep: deterministic static analysis with stable, pinnable rule IDs. Same code in, same findings out — fully reproducible and auditable.",
      standards: ["CWE", "CWE Top 25", "SARIF 2.1.0"]
    },
    {
      stage: "AI Triage",
      title: "AI Triage — model-agnostic adapter",
      meta: "Claude · OpenAI · Gemini",
      detail: "A model-agnostic adapter triages findings: CWE-grounded, code-as-data (prompt-injection defense), evidence-based confidence, and a never-hard-fail posture. The model fills a strict JSON schema only.",
      standards: ["OWASP LLM Top 10", "NIST AI RMF", "ISO/IEC 42001"]
    },
    {
      stage: "Output",
      title: "Output",
      meta: "SARIF 2.1.0 · findings · audit log",
      detail: "Results emit as SARIF 2.1.0 plus structured findings and an immutable audit log (model id, version, prompt hash, ruleset versions) — reproducible and defensible.",
      standards: ["SARIF 2.1.0 (OASIS)", "Immutable audit log"]
    }
  ];

  var track = document.getElementById("arch-track");
  var detail = document.getElementById("arch-detail");

  if (track && detail) {
    var nodes = [];

    STAGES.forEach(function (s, i) {
      var stage = document.createElement("div");
      stage.className = "arch-stage";
      stage.setAttribute("role", "listitem");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "arch-node";
      btn.setAttribute("aria-label", s.title + " — " + s.meta);

      var dot = document.createElement("span");
      dot.className = "node-dot";
      btn.appendChild(dot);

      var stageLabel = document.createElement("span");
      stageLabel.className = "node-stage";
      stageLabel.textContent = "0" + (i + 1) + " · " + s.stage;
      btn.appendChild(stageLabel);

      var title = document.createElement("span");
      title.className = "node-title";
      title.textContent = s.title;
      btn.appendChild(title);

      var meta = document.createElement("span");
      meta.className = "node-meta";
      meta.textContent = s.meta;
      btn.appendChild(meta);

      function select() { showDetail(i); }
      btn.addEventListener("click", select);
      btn.addEventListener("mouseenter", function () { showDetail(i, true); });
      btn.addEventListener("focus", select);

      stage.appendChild(btn);
      track.appendChild(stage);
      nodes.push(btn);
    });

    // traveling pulse rail (decorative, hidden under reduced motion via CSS)
    var rail = document.createElement("div");
    rail.className = "arch-pulse-rail";
    var pulse = document.createElement("div");
    pulse.className = "arch-pulse";
    rail.appendChild(pulse);
    track.parentNode.insertBefore(rail, detail);

    function showDetail(i, transient) {
      var s = STAGES[i];
      nodes.forEach(function (n, idx) { n.classList.toggle("active", idx === i); });

      detail.replaceChildren();

      var h = document.createElement("h3");
      h.textContent = s.title;
      detail.appendChild(h);

      var p = document.createElement("p");
      p.textContent = s.detail;
      detail.appendChild(p);

      var ul = document.createElement("ul");
      ul.className = "detail-standards";
      s.standards.forEach(function (label) {
        var li = document.createElement("li");
        li.textContent = label;
        ul.appendChild(li);
      });
      detail.appendChild(ul);
    }

    /* ---------- looping animation ---------- */
    if (!reduceMotion) {
      var lit = 0;
      var lastSwitch = 0;
      var STEP_MS = 1100;
      var startTs = null;

      function loop(ts) {
        if (startTs === null) { startTs = ts; lastSwitch = ts; }
        // light nodes in sequence
        if (ts - lastSwitch >= STEP_MS) {
          nodes[lit].classList.remove("lit");
          lit = (lit + 1) % nodes.length;
          lastSwitch = ts;
        }
        nodes.forEach(function (n, idx) { n.classList.toggle("lit", idx === lit); });

        // move the pulse left→right across the rail on a continuous cycle
        var cycle = (nodes.length * STEP_MS);
        var t = ((ts - startTs) % cycle) / cycle; // 0..1
        var railW = rail.clientWidth;
        var x = t * (railW + 64) - 64;
        pulse.style.transform = "translateX(" + x + "px)";

        rafId = requestAnimationFrame(loop);
      }
      var rafId = requestAnimationFrame(loop);

      // pause loop when section off-screen to save cycles
      if ("IntersectionObserver" in window) {
        var archSection = document.getElementById("architecture");
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting && !rafId) { startTs = null; rafId = requestAnimationFrame(loop); }
            else if (!e.isIntersecting && rafId) { cancelAnimationFrame(rafId); rafId = null; }
          });
        }, { threshold: 0.05 });
        io.observe(archSection);
      }
    } else {
      // static, legible state: light first node, show its detail
      nodes[0].classList.add("lit");
    }

    // show the first stage's detail by default so the panel is never empty
    showDetail(0);
  }

  /* ---------- mobile nav toggle ---------- */
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var ro = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { ro.observe(el); });
  }
})();
