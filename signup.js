import { signup, onAuth } from "./auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { db } from "./firebase.js";


const form = document.getElementById("signup-form");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const btn = document.getElementById("signup-btn");


form.addEventListener("submit", async (e) => {

  e.preventDefault();

  errorEl.classList.remove("visible");
  successEl.classList.remove("visible");

  const name =
    document.getElementById("name").value.trim();

  const birthDate =
    document.getElementById("birth").value;

  const gender =
    document.getElementById("gender").value;

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;


  if (!name || !birthDate || !gender || !email || !password) {

    errorEl.textContent = "Please fill in all fields.";
    errorEl.classList.add("visible");

    return;
  }


  if (password.length < 6) {

    errorEl.textContent =
      "Password must be at least 6 characters.";

    errorEl.classList.add("visible");

    return;
  }


  btn.disabled = true;
  btn.textContent = "Creating account...";


  try {

    /* ---------- CREATE AUTH ACCOUNT ---------- */

    const user = await signup(
      email,
      password,
      name
    );


    /* ---------- CREATE FIRESTORE USER ---------- */

    await setDoc(
      doc(db, "users", user.uid),
      {

        email,
        name,
        birthDate,
        gender,

        level: 1,
        xp: 0,
        xpToNext: 100,

        bounty: 0,

        stamina: 100,
        maxStamina: 100,

        currentFormId: "fake",
        unlockedForms: ["fake"],

        totalFocusMinutes: 0,
        totalSessions: 0,

        lastStaminaUpdate: Date.now(),

        isResting: false,
        restEndsAt: null,

        setupDone: true,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()

      }
    );


    /* ---------- SUCCESS ---------- */

    successEl.textContent =
      "Account created! Redirecting...";

    successEl.classList.add("visible");


    setTimeout(() => {
      window.location.replace("index.html");
    }, 1000);


  } catch (err) {

    console.error(err);

    console.log("CODE:", err.code);
    console.log("MESSAGE:", err.message);


    let msg =
      err.message ||
      "Signup failed. Please try again.";


    if (err.code === "auth/email-already-in-use") {

      msg =
        "This email is already registered. Try logging in.";

    }


    errorEl.textContent =
      (err.code ? err.code + ": " : "") + msg;

    errorEl.classList.add("visible");


    btn.disabled = false;
    btn.textContent = "Create Account";

  }

});
