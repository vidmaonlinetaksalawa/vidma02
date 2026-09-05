import { supabase, currentMonthKey } from "./supabase-init.js";

const month = currentMonthKey();
document.getElementById("studentsMonthLabel").textContent = month;

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

init();
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "index.html"; return; }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (!profile || profile.role !== "admin") { window.location.href = "dashboard.html"; return; }

  document.getElementById("welcomeName").textContent = `Admin: ${profile.name || session.user.email}`;
  loadPending();
  loadStudents();
  loadSettings();
}

// ---------- Tabs ----------
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["payments", "students", "settings"].forEach((t) => {
      document.getElementById(`tab-${t}`).style.display = t === btn.dataset.tab ? "block" : "none";
    });
  });
});

// ---------- Payments tab ----------
async function loadPending() {
  const wrap = document.getElementById("pendingList");
  const { data: pending, error } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "pending");

  if (error) { wrap.innerHTML = `<p class="error-msg">${error.message}</p>`; return; }
  if (!pending || !pending.length) {
    wrap.innerHTML = `<p class="muted">No pending submissions 🎉</p>`;
    return;
  }

  wrap.innerHTML = "";
  for (const payment of pending) {
    const { data: student } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", payment.student_id)
      .single();

    let slipUrl = "#";
    if (payment.slip_path) {
      const { data: signed } = await supabase.storage
        .from("slips")
        .createSignedUrl(payment.slip_path, 3600);
      if (signed) slipUrl = signed.signedUrl;
    }

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center;">
        <a href="${slipUrl}" target="_blank" rel="noopener">
          <img class="slip-thumb" src="${slipUrl}" />
        </a>
        <div>
          <strong>${escapeHtml(student?.name || "Unknown")}</strong>
          <span class="muted">${escapeHtml(student?.email || "")}</span><br/>
          <span class="muted">Month: ${payment.month} ${payment.note ? "· Note: " + escapeHtml(payment.note) : ""}</span>
        </div>
      </div>
      <div>
        <button class="success" data-action="approve" data-id="${payment.id}" data-student="${payment.student_id}" data-month="${payment.month}">Approve</button>
        <button class="danger" data-action="reject" data-id="${payment.id}">Reject</button>
      </div>
    `;
    wrap.appendChild(row);
  }

  wrap.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const { action, id, student, month: pMonth } = btn.dataset;

      if (action === "approve") {
        await supabase.from("payments")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .eq("id", id);
        await setPaidMonth(student, pMonth, true);
      } else {
        await supabase.from("payments")
          .update({ status: "rejected", reviewed_at: new Date().toISOString() })
          .eq("id", id);
      }
      loadPending();
      loadStudents();
    });
  });
}

// paid_months is a jsonb map column — merge client-side then write the whole object back
async function setPaidMonth(studentId, targetMonth, value) {
  const { data: student } = await supabase
    .from("profiles")
    .select("paid_months")
    .eq("id", studentId)
    .single();

  const merged = { ...(student?.paid_months || {}), [targetMonth]: value };
  await supabase.from("profiles").update({ paid_months: merged }).eq("id", studentId);
}

// ---------- Students tab ----------
async function loadStudents() {
  const wrap = document.getElementById("studentsList");
  const { data: students, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student");

  if (error) { wrap.innerHTML = `<p class="error-msg">${error.message}</p>`; return; }
  if (!students || !students.length) {
    wrap.innerHTML = `<p class="muted">No students registered yet.</p>`;
    return;
  }

  wrap.innerHTML = "";
  students.forEach((s) => {
    const paid = !!(s.paid_months && s.paid_months[month]);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(s.name || "—")}</strong> <span class="muted">${escapeHtml(s.email || "")}</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="badge ${paid ? "paid" : "none"}">${paid ? "Paid" : "Unpaid"}</span>
        <button class="secondary" data-uid="${s.id}" data-paid="${paid}">
          Mark ${paid ? "Unpaid" : "Paid"} (override)
        </button>
      </div>
    `;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll("button[data-uid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      const nowPaid = btn.dataset.paid === "true";
      await setPaidMonth(uid, month, !nowPaid);
      loadStudents();
    });
  });
}

// ---------- Settings tab: zoom link + recordings ----------
let recordingsCache = [];

async function loadSettings() {
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "classInfo")
    .single();

  document.getElementById("zoomLinkInput").value = settings?.zoom_link || "";
  recordingsCache = settings?.recordings || [];
  renderRecordingsEditor();
}

document.getElementById("saveZoomBtn").addEventListener("click", async () => {
  const zoomLink = document.getElementById("zoomLinkInput").value.trim();
  await supabase.from("settings").upsert({ id: "classInfo", zoom_link: zoomLink });
  const msg = document.getElementById("zoomSavedMsg");
  msg.style.display = "inline";
  setTimeout(() => (msg.style.display = "none"), 2000);
});

function renderRecordingsEditor() {
  const wrap = document.getElementById("recordingsEditor");
  wrap.innerHTML = "";
  recordingsCache.forEach((rec, i) => {
    const div = document.createElement("div");
    div.className = "recording-item";
    div.innerHTML = `
      <label>Week / Label</label>
      <input type="text" data-field="week" data-idx="${i}" value="${escapeAttr(rec.week || "")}" placeholder="Week 3" />
      <label>Title</label>
      <input type="text" data-field="title" data-idx="${i}" value="${escapeAttr(rec.title || "")}" placeholder="Chapter 5 Recording" />
      <label>YouTube Video ID (unlisted)</label>
      <input type="text" data-field="youtubeId" data-idx="${i}" value="${escapeAttr(rec.youtubeId || "")}" placeholder="e.g. dQw4w9WgXcQ" />
      <button class="danger" type="button" data-remove="${i}">Remove</button>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const idx = Number(input.dataset.idx);
      recordingsCache[idx][input.dataset.field] = input.value;
    });
  });
  wrap.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      recordingsCache.splice(Number(btn.dataset.remove), 1);
      renderRecordingsEditor();
    });
  });
}

document.getElementById("addRecordingBtn").addEventListener("click", () => {
  recordingsCache.push({ week: "", title: "", youtubeId: "" });
  renderRecordingsEditor();
});

document.getElementById("saveRecordingsBtn").addEventListener("click", async () => {
  await supabase.from("settings").upsert({ id: "classInfo", recordings: recordingsCache });
  const msg = document.getElementById("recSavedMsg");
  msg.style.display = "inline";
  setTimeout(() => (msg.style.display = "none"), 2000);
});

// ---------- helpers ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, "&#96;");
}
