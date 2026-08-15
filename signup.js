import { signup, onAuth } from "./auth.js";

onAuth((user) => {
  if (user) {
    window.location.href = "index.html";
  }
});

const form = document.getElementById("signup-form");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const btn = document.getElementById("signup-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorEl.classList.remove("visible");
  successEl.classList.remove("visible");
  errorEl.textContent = "";
  successEl.textContent = "";

  const name = document.getElementById("name").value.trim();
  const birthDate = document.getElementById("birth").value;
  const gender = document.getElementById("gender").value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!name || !birthDate || !gender || !email || !password) {
    errorEl.textContent = "Please fill in all fields.";
    errorEl.classList.add("visible");
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters.";
    errorEl.classList.add("visible");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating account...";

  try {
    await signup(email, password, name, birthDate, gender);

    successEl.textContent = "Account created! Redirecting...";
    successEl.classList.add("visible");

  } catch (err) {
    let msg = err.message || "Signup failed. Please try again.";

    if (err.code === "auth/email-already-in-use") {
      msg = "This email is already registered. Try logging in.";
    } else if (err.code === "auth/invalid-email") {
      msg = "Invalid email address.";
    } else if (err.code === "auth/weak-password") {
      msg = "Password is too weak.";
    } else if (err.code === "permission-denied") {
      msg = "Permission denied. Check Firestore rules.";
    }

    errorEl.textContent =
      (err.code ? err.code + ": " : "") + msg;

    errorEl.classList.add("visible");

    btn.disabled = false;
    btn.textContent = "Create Account";
  }
});
