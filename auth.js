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
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  collection,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { auth, db } from "./firebase.js";

export async function getActiveFocusSession(uid) {
  const q = query(
    collection(db, "focusSessions"),
    where("userId", "==", uid),
    where("status", "==", "active")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];

  return {
    id: docSnap.id,
    ...docSnap.data()
  };
}

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

// ---------------- FOCUS SESSION ----------------

export async function createFocusSession(
  uid,
  taskName,
  durationMinutes
) {
  const now = new Date();

  const endsAt = new Date(
    now.getTime() + durationMinutes * 60 * 1000
  );

  const sessionRef = await addDoc(
    collection(db, "focusSessions"),
    {
      userId: uid,
      taskName: taskName,
      durationMinutes: durationMinutes,

      startedAt: Timestamp.fromDate(now),
      endsAt: Timestamp.fromDate(endsAt),

      status: "active",
      rewardGranted: false,
      notificationSent: false,

      createdAt: serverTimestamp(),
    }
  );

  return sessionRef.id;
}
