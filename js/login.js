import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const toggleLink = document.getElementById("toggleLink");
const formTitle = document.getElementById("formTitle");
const loginError = document.getElementById("loginError");
const regError = document.getElementById("regError");

let showingLogin = true;
toggleLink.addEventListener("click", () => {
  showingLogin = !showingLogin;
  loginForm.style.display = showingLogin ? "block" : "none";
  registerForm.style.display = showingLogin ? "none" : "block";
  formTitle.textContent = showingLogin ? "Student / Admin Login" : "Create Student Account";
  toggleLink.textContent = showingLogin
    ? "New student? Create an account"
    : "Already have an account? Log in";
});

// If already logged in, skip straight to the right dashboard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await redirectByRole(user.uid);
  }
});

async function redirectByRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists() && snap.data().role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "dashboard.html";
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await redirectByRole(cred.user.uid);
  } catch (err) {
    loginError.textContent = friendlyError(err);
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regError.textContent = "";
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // New accounts are always students. Admins are promoted manually in Firestore.
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role: "student",
      paidMonths: {},
      createdAt: serverTimestamp(),
    });
    window.location.href = "dashboard.html";
  } catch (err) {
    regError.textContent = friendlyError(err);
  }
});

function friendlyError(err) {
  const map = {
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists for that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
  };
  return map[err.code] || err.message;
}
