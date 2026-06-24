const $ = (id) => document.getElementById(id);

$("scan").addEventListener("click", async () => {
  $("status").textContent = "submitting...";
  $("findings").innerHTML = "";
  $("sarif").hidden = true;
  const res = await fetch("/api/scans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      language: $("language").value,
      apiKey: $("apiKey").value,
      files: [{ path: "input." + ($("language").value === "python" ? "py" : "txt"), content: $("code").value }],
    }),
  });
  if (!res.ok) { $("status").textContent = "error: " + (await res.text()); return; }
  const { id } = await res.json();
  poll(id);
});

async function poll(id) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`/api/scans/${id}`);
    const { scan, findings } = await res.json();
    $("status").textContent = "status: " + scan.status;
    if (scan.status === "completed" || scan.status === "failed") {
      render(findings);
      $("sarif").href = `/api/scans/${id}/sarif`;
      $("sarif").hidden = false;
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function render(findings) {
  $("findings").innerHTML = findings.map((f) => `
    <div class="finding ${f.confidence}">
      <strong>${f.cwe ?? "—"}</strong> · ${f.severity} · confidence: ${f.confidence ?? "—"}
      <div>${f.file}:${f.startLine} — ${f.explanation ?? f.message}</div>
      <em>${f.remediation ?? ""}</em>
    </div>`).join("");
}
