/* ============================================================
   AIHarness — live demo. Calls the real /api/* contract.
   SECURITY: finding fields derive from untrusted scanned code.
   They are rendered with createElement + textContent ONLY.
   No finding field is ever interpolated into innerHTML.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var form = $("scan-form");
  var scanBtn = $("scan");
  var loadBtn = $("load-sample");
  var langSel = $("language");
  var keyInput = $("apiKey");
  var codeArea = $("code");

  var statusWrap = $("status-wrap");
  var statusLine = $("status");
  var progress = $("progress");
  var findingsHead = $("findings-head");
  var findingsCount = $("findings-count");
  var findingsBox = $("findings");
  var sarifLink = $("sarif");

  /* ---------- allowlists (validate untrusted values before className use) ---------- */
  var CONF = ["low", "medium", "high"];
  var SEV = ["info", "low", "medium", "high", "critical"];
  var VERDICT = ["confirmed", "refuted", "uncertain"];
  var STEP_ORDER = ["queued", "scanning", "triaging", "completed"];

  /* ---------- planted-vulnerability sample (Python) ---------- */
  var SAMPLE = [
    "import subprocess",
    "import sqlite3",
    "from flask import Flask, request",
    "",
    "app = Flask(__name__)",
    "",
    "@app.route('/ping')",
    "def ping():",
    "    host = request.args.get('host')",
    "    # CWE-78: OS command injection via shell=True with untrusted input",
    "    return subprocess.check_output('ping -c 1 ' + host, shell=True)",
    "",
    "@app.route('/user')",
    "def get_user():",
    "    uid = request.args.get('id')",
    "    conn = sqlite3.connect('app.db')",
    "    cur = conn.cursor()",
    "    # CWE-89: SQL injection via string concatenation",
    "    cur.execute(\"SELECT * FROM users WHERE id = '\" + uid + \"'\")",
    "    return str(cur.fetchall())",
    ""
  ].join("\n");

  if (loadBtn) {
    loadBtn.addEventListener("click", function () {
      if (langSel) langSel.value = "python";
      codeArea.value = SAMPLE;
      codeArea.focus();
    });
  }

  /* ---------- progress UI ---------- */
  function resetProgress() {
    var items = progress.querySelectorAll("li");
    items.forEach(function (li) { li.classList.remove("active", "done", "error"); });
  }

  function setProgress(status) {
    var idx = STEP_ORDER.indexOf(status);
    var items = progress.querySelectorAll("li");
    items.forEach(function (li) {
      var step = li.getAttribute("data-step");
      var sIdx = STEP_ORDER.indexOf(step);
      li.classList.remove("active", "done", "error");
      if (idx === -1) return;
      if (sIdx < idx) li.classList.add("done");
      else if (sIdx === idx) li.classList.add(status === "completed" ? "done" : "active");
    });
  }

  function setError(msg) {
    statusLine.textContent = msg;
    statusLine.classList.add("is-error");
    var items = progress.querySelectorAll("li");
    items.forEach(function (li) {
      if (li.classList.contains("active")) {
        li.classList.remove("active");
        li.classList.add("error");
      }
    });
  }

  function setStatus(msg) {
    statusLine.textContent = msg;
    statusLine.classList.remove("is-error");
  }

  /* ---------- finding rendering (XSS-safe) ---------- */
  function badge(text, cls) {
    var span = document.createElement("span");
    span.className = "badge" + (cls ? " " + cls : "");
    span.textContent = text;
    return span;
  }

  function renderFindings(findings) {
    findingsBox.replaceChildren();
    findingsHead.hidden = false;

    var count = Array.isArray(findings) ? findings.length : 0;
    findingsCount.textContent = count === 1 ? "1 finding" : count + " findings";

    if (!count) {
      var empty = document.createElement("p");
      empty.className = "findings-empty";
      empty.textContent = "No findings. The scanner and triage found nothing to report on this input.";
      findingsBox.appendChild(empty);
      return;
    }

    findings.forEach(function (f) {
      var sev = SEV.indexOf(f && f.severity) !== -1 ? f.severity : null;
      var conf = CONF.indexOf(f && f.confidence) !== -1 ? f.confidence : null;
      var verdict = VERDICT.indexOf(f && f.verdict) !== -1 ? f.verdict : null;

      var card = document.createElement("article");
      card.className = "finding" + (sev ? " sev-" + sev : "");

      var top = document.createElement("div");
      top.className = "finding-top";

      // CWE badge
      top.appendChild(badge((f && f.cwe) ? f.cwe : "CWE: n/a", "badge-cwe"));

      // severity badge
      top.appendChild(badge("severity: " + (sev || "unknown"), "badge-sev" + (sev ? " sev-" + sev : "")));

      // confidence badge
      top.appendChild(badge("confidence: " + (conf || "unknown"), "badge-conf" + (conf ? " conf-" + conf : "")));

      // verdict badge
      if (verdict) top.appendChild(badge("verdict: " + verdict, "badge-verdict"));

      // honest "needs review" label for LLM-only / low-confidence non-confirmed
      if (conf !== "high" && verdict !== "confirmed") {
        top.appendChild(badge("needs review", "badge-needs-review"));
      }

      card.appendChild(top);

      // location
      var loc = document.createElement("p");
      loc.className = "finding-loc";
      var file = (f && f.file != null) ? String(f.file) : "(unknown file)";
      var line = (f && f.startLine != null) ? String(f.startLine) : "?";
      loc.textContent = file + ":" + line;
      card.appendChild(loc);

      // message
      if (f && f.message) {
        var msg = document.createElement("p");
        msg.className = "finding-msg";
        msg.textContent = f.message;
        card.appendChild(msg);
      }

      // explanation
      if (f && f.explanation) {
        var ex = document.createElement("p");
        ex.className = "finding-explain";
        ex.textContent = f.explanation;
        card.appendChild(ex);
      }

      // remediation
      if (f && f.remediation) {
        var rem = document.createElement("p");
        rem.className = "finding-remed";
        var label = document.createElement("strong");
        label.textContent = "Remediation: ";
        rem.appendChild(label);
        rem.appendChild(document.createTextNode(f.remediation));
        card.appendChild(rem);
      }

      findingsBox.appendChild(card);
    });
  }

  /* ---------- scan flow ---------- */
  var polling = false;

  function setBusy(busy) {
    scanBtn.disabled = busy;
    scanBtn.textContent = busy ? "Scanning…" : "Scan";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (polling) return;
    startScan();
  });

  function startScan() {
    var code = codeArea.value.trim();
    statusWrap.hidden = false;
    findingsHead.hidden = true;
    findingsBox.replaceChildren();
    sarifLink.hidden = true;
    resetProgress();
    statusLine.classList.remove("is-error");

    if (!code) { setError("Add some source code to scan (or load the sample)."); return; }

    setBusy(true);
    polling = true;
    setProgress("queued");
    setStatus("Submitting scan…");

    var lang = langSel.value;
    var ext = { python: "py", javascript: "js", java: "java", go: "go" }[lang] || "txt";

    fetch("/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: lang,
        apiKey: keyInput.value,
        files: [{ path: "input." + ext, content: code }]
      })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("Scan rejected (" + res.status + "): " + (t || res.statusText));
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.id) throw new Error("Unexpected response: missing scan id.");
        setStatus("Scan accepted. Booting scanner…");
        poll(data.id);
      })
      .catch(function (err) {
        setError(err && err.message ? err.message : "Failed to submit scan.");
        setBusy(false);
        polling = false;
      });
  }

  function poll(id) {
    var attempts = 0;
    var MAX = 75;        // ~150s at 2s interval
    var INTERVAL = 2000;

    function tick() {
      attempts++;
      fetch("/api/scans/" + encodeURIComponent(id))
        .then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) {
              throw new Error("Polling failed (" + res.status + "): " + (t || res.statusText));
            });
          }
          return res.json();
        })
        .then(function (data) {
          var scan = data && data.scan ? data.scan : {};
          var status = scan.status || "unknown";
          var findings = data && data.findings ? data.findings : [];

          if (status === "completed") {
            setProgress("completed");
            setStatus("Scan complete.");
            renderFindings(findings);
            sarifLink.href = "/api/scans/" + encodeURIComponent(id) + "/sarif";
            sarifLink.hidden = false;
            setBusy(false);
            polling = false;
            return;
          }

          if (status === "failed") {
            setProgress("triaging");
            setError("Scan failed. " + (scan.error ? String(scan.error) : "The job did not complete."));
            // still render any partial findings safely
            if (Array.isArray(findings) && findings.length) renderFindings(findings);
            setBusy(false);
            polling = false;
            return;
          }

          setProgress(STEP_ORDER.indexOf(status) !== -1 ? status : "queued");
          setStatus("Status: " + status + " (" + (attempts * 2) + "s)…");

          if (attempts >= MAX) {
            setError("Timed out waiting for the scan after ~" + (MAX * 2) + "s. The job may still be running — try again shortly.");
            setBusy(false);
            polling = false;
            return;
          }
          setTimeout(tick, INTERVAL);
        })
        .catch(function (err) {
          // transient network error: retry a few times before giving up
          if (attempts < MAX) {
            setStatus("Reconnecting… (" + (attempts * 2) + "s)");
            setTimeout(tick, INTERVAL);
            return;
          }
          setError(err && err.message ? err.message : "Lost connection while polling.");
          setBusy(false);
          polling = false;
        });
    }

    setTimeout(tick, INTERVAL);
  }
})();
