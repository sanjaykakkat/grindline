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


// ---------------- SIGNUP ----------------

export async function signup(email, password, name) {

  const cred = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await updateProfile(cred.user, {
    displayName: name
  });

  return cred.user;
}


// ---------------- LOGIN ----------------

export async function login(email, password) {

  const cred = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return cred.user;
}


// ---------------- LOGOUT ----------------

export async function logout() {
  await signOut(auth);
}


// ---------------- AUTH STATE ----------------

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}


// ---------------- LOAD USER DATA ----------------

export async function loadUserData(uid) {

  const snap = await getDoc(
    doc(db, "users", uid)
  );

  if (snap.exists()) {
    return snap.data();
  }

  return null;
}


// ---------------- SAVE USER DATA ----------------

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
