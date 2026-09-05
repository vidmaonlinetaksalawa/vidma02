import { supabase, currentMonthKey } from "./supabase-init.js";

const month = currentMonthKey();
document.getElementById("monthLabel").textContent = month;

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

let currentUser = null;

init();
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "index.html"; return; }
  currentUser = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (!profile) { window.location.href = "index.html"; return; }
  if (profile.role === "admin") { window.location.href = "admin.html"; return; }

  document.getElementById("welcomeName").textContent = `Hi, ${profile.name || currentUser.email}`;

  const isPaid = !!(profile.paid_months && profile.paid_months[month]);
  await renderPaymentStatus(isPaid);

  if (isPaid) {
    await unlockZoom();
    await unlockRecordings();
  }
}

async function renderPaymentStatus(isPaid) {
  const badge = document.getElementById("statusBadge");
  const formWrap = document.getElementById("paymentFormWrap");
  const rejectedNote = document.getElementById("rejectedNote");

  if (isPaid) {
    badge.textContent = "Paid";
    badge.className = "badge paid";
    formWrap.style.display = "none";
    return;
  }

  const { data: latestRows } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", currentUser.id)
    .eq("month", month)
    .order("submitted_at", { ascending: false })
    .limit(1);

  const latest = latestRows && latestRows[0];

  if (!latest) {
    badge.textContent = "Not submitted";
    badge.className = "badge none";
    formWrap.style.display = "block";
  } else if (latest.status === "pending") {
    badge.textContent = "Pending review";
    badge.className = "badge pending";
    formWrap.style.display = "none";
  } else if (latest.status === "rejected") {
    badge.textContent = "Rejected";
    badge.className = "badge rejected";
    formWrap.style.display = "block";
    rejectedNote.style.display = "block";
  }
}

document.getElementById("submitSlipBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("slipFile");
  const note = document.getElementById("slipNote").value.trim();
  const errEl = document.getElementById("uploadError");
  errEl.textContent = "";

  const file = fileInput.files[0];
  if (!file) { errEl.textContent = "Please choose an image file first."; return; }
  if (file.size > 5 * 1024 * 1024) { errEl.textContent = "File is too large (max 5MB)."; return; }

  const btn = document.getElementById("submitSlipBtn");
  btn.disabled = true;
  btn.textContent = "Uploading…";

  try {
    const path = `${currentUser.id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("slips").upload(path, file);
    if (uploadErr) throw uploadErr;

    const { error: insertErr } = await supabase.from("payments").insert({
      student_id: currentUser.id,
      month,
      slip_path: path,
      note,
      status: "pending",
    });
    if (insertErr) throw insertErr;

    await renderPaymentStatus(false);
  } catch (err) {
    errEl.textContent = "Upload failed: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit for Review";
  }
});

async function unlockZoom() {
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "classInfo")
    .single();

  const zoomBtn = document.getElementById("joinZoomBtn");
  if (settings && settings.zoom_link) {
    zoomBtn.href = settings.zoom_link;
    zoomBtn.style.pointerEvents = "auto";
    zoomBtn.style.opacity = "1";
  } else {
    zoomBtn.textContent = "Link not set yet — check back later";
  }
}

async function unlockRecordings() {
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "classInfo")
    .single();

  const wrap = document.getElementById("recordingsWrap");
  wrap.innerHTML = "";

  const recordings = (settings && settings.recordings) || [];
  if (!recordings.length) {
    wrap.innerHTML = `<p class="muted">No recordings uploaded yet.</p>`;
    return;
  }

  recordings.slice().reverse().forEach((rec) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p style="margin:0 0 6px;"><strong>${escapeHtml(rec.title || "Class Recording")}</strong>
        <span class="muted">${escapeHtml(rec.week || "")}</span></p>
      <div class="video-embed">
        <iframe src="https://www.youtube.com/embed/${escapeHtml(rec.youtubeId)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>
      </div>
    `;
    wrap.appendChild(div);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
