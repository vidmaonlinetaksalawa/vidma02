import { supabase } from "./supabase-init.js";

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
init();
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await redirectByRole(session.user.id);
}

async function redirectByRole(uid) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  window.location.href = profile && profile.role === "admin" ? "admin.html" : "dashboard.html";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { loginError.textContent = friendlyError(error); return; }
  await redirectByRole(data.user.id);
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regError.textContent = "";
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  // A Postgres trigger (see supabase.sql) auto-creates the matching
  // `profiles` row with role='student' — nothing client-side can set role.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) { regError.textContent = friendlyError(error); return; }

  if (data.session) {
    // Email confirmation is OFF in your Supabase Auth settings — logged in immediately.
    window.location.href = "dashboard.html";
  } else {
    // Email confirmation is ON — no session yet.
    regError.style.color = "var(--success, #1f9d55)";
    regError.textContent = "Account created! Check your email to confirm, then log in.";
  }
});

function friendlyError(err) {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("already registered")) return "An account already exists for that email.";
  if (msg.includes("password")) return "Password should be at least 6 characters.";
  return err.message;
}
