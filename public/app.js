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

const CONF = ["low", "medium", "high"];

function render(findings) {
  const c = $("findings");
  c.replaceChildren();
  for (const f of findings) {
    const div = document.createElement("div");
    div.className = "finding" + (CONF.includes(f.confidence) ? " " + f.confidence : "");

    const strong = document.createElement("strong");
    strong.textContent = f.cwe ?? "—";
    div.appendChild(strong);

    div.appendChild(document.createTextNode(" · " + (f.severity ?? "") + " · confidence: " + (f.confidence ?? "—")));

    const detail = document.createElement("div");
    detail.textContent = (f.file ?? "") + ":" + (f.startLine ?? "") + " — " + (f.explanation ?? f.message ?? "");
    div.appendChild(detail);

    const em = document.createElement("em");
    em.textContent = f.remediation ?? "";
    div.appendChild(em);

    c.appendChild(div);
  }
}
