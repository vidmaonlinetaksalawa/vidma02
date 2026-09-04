import { auth, db, storage, currentMonthKey } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc, getDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const month = currentMonthKey();
document.getElementById("monthLabel").textContent = month;

document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) { window.location.href = "index.html"; return; }
  const userData = userSnap.data();

  if (userData.role === "admin") { window.location.href = "admin.html"; return; }

  document.getElementById("welcomeName").textContent = `Hi, ${userData.name || user.email}`;

  const isPaid = !!(userData.paidMonths && userData.paidMonths[month]);
  await renderPaymentStatus(isPaid);

  if (isPaid) {
    await unlockZoom();
    await unlockRecordings();
  }
});

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

  // Look up latest payment doc for this student + month
  const q = query(
    collection(db, "payments"),
    where("studentId", "==", currentUser.uid),
    where("month", "==", month),
    orderBy("submittedAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    badge.textContent = "Not submitted";
    badge.className = "badge none";
    formWrap.style.display = "block";
  } else {
    const latest = snap.docs[0].data();
    if (latest.status === "pending") {
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
    const path = `slips/${currentUser.uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const slipUrl = await getDownloadURL(storageRef);

    await addDoc(collection(db, "payments"), {
      studentId: currentUser.uid,
      month,
      slipUrl,
      note,
      status: "pending",
      submittedAt: serverTimestamp(),
    });

    await renderPaymentStatus(false);
  } catch (err) {
    errEl.textContent = "Upload failed: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit for Review";
  }
});

async function unlockZoom() {
  const settingsSnap = await getDoc(doc(db, "settings", "classInfo"));
  const zoomBtn = document.getElementById("joinZoomBtn");
  if (settingsSnap.exists() && settingsSnap.data().zoomLink) {
    zoomBtn.href = settingsSnap.data().zoomLink;
    zoomBtn.style.pointerEvents = "auto";
    zoomBtn.style.opacity = "1";
  } else {
    zoomBtn.textContent = "Link not set yet — check back later";
  }
}

async function unlockRecordings() {
  const settingsSnap = await getDoc(doc(db, "settings", "classInfo"));
  const wrap = document.getElementById("recordingsWrap");
  wrap.innerHTML = "";

  if (!settingsSnap.exists() || !(settingsSnap.data().recordings || []).length) {
    wrap.innerHTML = `<p class="muted">No recordings uploaded yet.</p>`;
    return;
  }

  const recordings = settingsSnap.data().recordings.slice().reverse(); // newest first
  for (const rec of recordings) {
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
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
