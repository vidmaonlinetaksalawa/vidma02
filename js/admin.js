import { auth, db, currentMonthKey } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const month = currentMonthKey();
document.getElementById("studentsMonthLabel").textContent = month;
document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

// ---------- Auth guard: must be role === 'admin' ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }
  document.getElementById("welcomeName").textContent = `Admin: ${snap.data().name || user.email}`;
  loadPending();
  loadStudents();
  loadSettings();
});

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
  const q = query(collection(db, "payments"), where("status", "==", "pending"));
  const snap = await getDocs(q);

  if (snap.empty) {
    wrap.innerHTML = `<p class="muted">No pending submissions 🎉</p>`;
    return;
  }

  wrap.innerHTML = "";
  for (const d of snap.docs) {
    const payment = d.data();
    const studentSnap = await getDoc(doc(db, "users", payment.studentId));
    const student = studentSnap.exists() ? studentSnap.data() : { name: "Unknown", email: "" };

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center;">
        <a href="${payment.slipUrl}" target="_blank" rel="noopener">
          <img class="slip-thumb" src="${payment.slipUrl}" />
        </a>
        <div>
          <strong>${escapeHtml(student.name)}</strong> <span class="muted">${escapeHtml(student.email)}</span><br/>
          <span class="muted">Month: ${payment.month} ${payment.note ? "· Note: " + escapeHtml(payment.note) : ""}</span>
        </div>
      </div>
      <div>
        <button class="success" data-action="approve" data-id="${d.id}" data-student="${payment.studentId}" data-month="${payment.month}">Approve</button>
        <button class="danger" data-action="reject" data-id="${d.id}">Reject</button>
      </div>
    `;
    wrap.appendChild(row);
  }

  wrap.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const { action, id, student, month: pMonth } = btn.dataset;
      if (action === "approve") {
        await updateDoc(doc(db, "payments", id), { status: "approved", reviewedAt: serverTimestamp() });
        await updateDoc(doc(db, "users", student), { [`paidMonths.${pMonth}`]: true });
      } else {
        await updateDoc(doc(db, "payments", id), { status: "rejected", reviewedAt: serverTimestamp() });
      }
      loadPending();
      loadStudents();
    });
  });
}

// ---------- Students tab ----------
async function loadStudents() {
  const wrap = document.getElementById("studentsList");
  const q = query(collection(db, "users"), where("role", "==", "student"));
  const snap = await getDocs(q);

  if (snap.empty) {
    wrap.innerHTML = `<p class="muted">No students registered yet.</p>`;
    return;
  }

  wrap.innerHTML = "";
  snap.forEach((d) => {
    const s = d.data();
    const paid = !!(s.paidMonths && s.paidMonths[month]);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(s.name || "—")}</strong> <span class="muted">${escapeHtml(s.email || "")}</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="badge ${paid ? "paid" : "none"}">${paid ? "Paid" : "Unpaid"}</span>
        <button class="secondary" data-uid="${d.id}" data-paid="${paid}">
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
      await updateDoc(doc(db, "users", uid), { [`paidMonths.${month}`]: !nowPaid });
      loadStudents();
    });
  });
}

// ---------- Settings tab: zoom link + recordings ----------
let recordingsCache = [];

async function loadSettings() {
  const snap = await getDoc(doc(db, "settings", "classInfo"));
  const data = snap.exists() ? snap.data() : {};
  document.getElementById("zoomLinkInput").value = data.zoomLink || "";
  recordingsCache = data.recordings || [];
  renderRecordingsEditor();
}

document.getElementById("saveZoomBtn").addEventListener("click", async () => {
  const zoomLink = document.getElementById("zoomLinkInput").value.trim();
  await setDoc(doc(db, "settings", "classInfo"), { zoomLink }, { merge: true });
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
  await setDoc(doc(db, "settings", "classInfo"), { recordings: recordingsCache }, { merge: true });
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
