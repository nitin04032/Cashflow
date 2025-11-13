// js/auth.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!window?.supabase?.createClient) {
  console.error("Supabase CDN missing. Add <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'></script>");
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const tabLogin = document.getElementById("tabLogin");
const tabSignUp = document.getElementById("tabSignUp");
const tabForgot = document.getElementById("tabForgot");
const authForm = document.getElementById("authForm");
const submitBtn = document.getElementById("submitBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authMsg = document.getElementById("authMsg");
const signupExtras = document.getElementById("signupExtras");
const forgotView = document.getElementById("forgotView");

let mode = "LOGIN"; // LOGIN | SIGNUP | FORGOT

function setMode(m) {
  mode = m;
  if (tabLogin) tabLogin.className = m === "LOGIN" ? "button" : "ghost";
  if (tabSignUp) tabSignUp.className = m === "SIGNUP" ? "button" : "ghost";
  if (tabForgot) tabForgot.className = m === "FORGOT" ? "button" : "ghost";
  if (signupExtras) signupExtras.style.display = m === "SIGNUP" ? "block" : "none";
  if (forgotView) forgotView.style.display = m === "FORGOT" ? "block" : "none";
  submitBtn.textContent = m === "LOGIN" ? "Sign in" : m === "SIGNUP" ? "Create account" : "Send reset email";
}

tabLogin?.addEventListener("click", () => setMode("LOGIN"));
tabSignUp?.addEventListener("click", () => setMode("SIGNUP"));
tabForgot?.addEventListener("click", () => setMode("FORGOT"));

function showMsg(msg, isError = false) {
  if (!authMsg) return;
  authMsg.textContent = msg;
  authMsg.style.color = isError ? "var(--red)" : "#475569";
}

authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  showMsg("");

  const email = document.getElementById("email").value?.trim();
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("passwordConfirm")?.value;
  const fullName = document.getElementById("fullName")?.value?.trim();

  try {
    if (mode === "LOGIN") {
      if (!email || !password) { showMsg("Enter email and password", true); submitBtn.disabled = false; return; }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { showMsg(error.message || "Login failed", true); submitBtn.disabled = false; return; }
      showMsg("Signed in");
      const redirect = new URLSearchParams(location.search).get("redirect") || "index.html";
      setTimeout(() => location.href = redirect, 700);
    } else if (mode === "SIGNUP") {
      if (!email || !password) { showMsg("Email and password required", true); submitBtn.disabled = false; return; }
      if (password !== passwordConfirm) { showMsg("Passwords do not match", true); submitBtn.disabled = false; return; }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || null } }
      });
      if (error) { showMsg(error.message || "Sign up failed", true); submitBtn.disabled = false; return; }
      showMsg("Sign up successful — check your email for confirmation (if enabled).");
      setTimeout(() => setMode("LOGIN"), 1200);
    } else if (mode === "FORGOT") {
      if (!email) { showMsg("Enter your email", true); submitBtn.disabled = false; return; }
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) { showMsg(error.message || "Request failed", true); submitBtn.disabled = false; return; }
      showMsg("Reset email sent — check your inbox.");
    }
  } catch (err) {
    console.error(err);
    showMsg(err?.message || "Unexpected error", true);
  } finally {
    submitBtn.disabled = false;
  }
});

signOutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showMsg("Signed out");
  signOutBtn.style.display = "none";
});

/* Init */
(async function init() {
  setMode("LOGIN");
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      showMsg("Already signed in");
      signOutBtn.style.display = "inline-block";
    }
  } catch (err) {
    console.warn("auth init error", err);
  }
})();

/* Reset page handling */
async function handleResetPageIfPresent() {
  const resetForm = document.getElementById("resetForm");
  if (!resetForm) return;

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const qs = new URLSearchParams(hash || window.location.search);
  const access_token = qs.get("access_token");
  const refresh_token = qs.get("refresh_token");

  if (access_token && refresh_token) {
    try {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error("setSession error", error);
        document.getElementById("resetMsg").textContent = "Invalid or expired reset link. Request a new reset email.";
        return;
      }
      document.getElementById("resetMsg").textContent = "Session restored. Set a new password below.";
    } catch (err) { console.error(err); }
  } else {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        document.getElementById("resetMsg").textContent = "Open this page from the reset email link. If you don't have it, request a new reset from login.";
      }
    } catch (err) { console.warn(err); }
  }

  resetForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const newPassword = document.getElementById("newPassword").value;
    const confirm = document.getElementById("newPasswordConfirm").value;
    const msgEl = document.getElementById("resetMsg");
    msgEl.textContent = "";
    if (!newPassword || newPassword.length < 6) { msgEl.textContent = "Password must be at least 6 characters"; return; }
    if (newPassword !== confirm) { msgEl.textContent = "Passwords do not match"; return; }

    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        msgEl.textContent = error.message || "Failed to update password";
        console.error(error);
        return;
      }
      msgEl.textContent = "Password updated — you are now signed in.";
      setTimeout(()=> location.href = "index.html", 1000);
    } catch (err) {
      console.error(err);
      msgEl.textContent = "Unexpected error";
    }
  });
}
handleResetPageIfPresent();
