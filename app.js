const statusEl = document.getElementById("status");
const footerMeta = document.getElementById("footerMeta");

const todayBlock = document.getElementById("todayBlock");
const linksBlock = document.getElementById("linksBlock");
const notesBlock = document.getElementById("notesBlock");

const refreshBtn = document.getElementById("refreshBtn");

function setStatus(msg){
  if(statusEl) statusEl.textContent = msg;
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadHubJSON(){
  // cache: no-store ensures you actually pull updates from GitHub Pages
  const res = await fetch("./data/hub.json", { cache: "no-store" });
  if(!res.ok) throw new Error(`hub.json fetch failed (${res.status})`);
  return await res.json();
}

function renderToday(data){
  const t = data?.today || {};
  const headline = t.headline || "No headline set";
  const focus = Array.isArray(t.focus) ? t.focus : [];

  const focusHtml = focus.length
    ? `<div class="list">${focus.map(item => `
        <div class="row">
          <div>${esc(item)}</div>
        </div>
      `).join("")}</div>`
    : `<div class="muted">No focus items yet.</div>`;

  todayBlock.innerHTML = `
    <div style="font-weight:800; margin-bottom:10px;">${esc(headline)}</div>
    ${focusHtml}
  `;
}

function renderLinks(data){
  const links = Array.isArray(data?.links) ? data.links : [];
  if(!links.length){
    linksBlock.innerHTML = `<div class="muted">No links yet.</div>`;
    return;
  }

  linksBlock.innerHTML = `
    <div class="list">
      ${links.map(l => `
        <div class="row">
          <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>
          </div>
          <div class="muted" style="font-size:12px;">${esc(l.tag || "")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderNotes(data){
  const notes = data?.notes || "";
  notesBlock.innerHTML = notes.trim()
    ? `<div style="white-space:pre-wrap;">${esc(notes)}</div>`
    : `<div class="muted">No notes yet.</div>`;
}

function renderMeta(data){
  const updated = data?.meta?.updatedAt || "";
  const device = data?.meta?.source || "";
  footerMeta.textContent = `data: ${updated || "—"} ${device ? `· ${device}` : ""}`;
}

async function refresh(){
  try{
    setStatus("Loading cloud data…");
    const data = await loadHubJSON();

    renderToday(data);
    renderLinks(data);
    renderNotes(data);
    renderMeta(data);

    setStatus("Loaded from ./data/hub.json");
  }catch(err){
    console.error(err);
    setStatus("Could not load hub.json (check GitHub Pages + path).");
    todayBlock.innerHTML = `<div class="muted">Error loading data.</div>`;
    linksBlock.innerHTML = `<div class="muted">Error loading data.</div>`;
    notesBlock.innerHTML = `<div class="muted">Error loading data.</div>`;
    footerMeta.textContent = "data: —";
  }
}

refreshBtn?.addEventListener("click", refresh);

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}

refresh();
