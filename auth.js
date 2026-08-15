// auth.js — Shared authentication helpers

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db } from "./firebase.js";

// ----- Default game state for new users -----
function getDefaultUserData(name, birthDate, email) {
  return {
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
    updatedAt: serverTimestamp(),
  };
}

// ----- Signup -----
export async function signup(email, password, name, birthDate, gender) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Set displayName
  await updateProfile(cred.user, { displayName: name });

  // Create user document in Firestore
  const userData = getDefaultUserData(name, birthDate, email, gender);
  await setDoc(doc(db, "users", cred.user.uid), userData);

  return cred.user;
}

// ----- Login -----
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ----- Logout -----
export async function logout() {
  await signOut(auth);
}

// ----- Auth state listener -----
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ----- Load user data from Firestore -----
export async function loadUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

// ----- Save user data -----
export async function saveUserData(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export { auth, db };

