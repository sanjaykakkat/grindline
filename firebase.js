// firebase.js — Firebase initialization (shared)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbSgeDSprxcTqerRMA_GoxHFEGBzhdUmM",
  authDomain: "grindline-5626d.firebaseapp.com",
  projectId: "grindline-5626d",
  storageBucket: "grindline-5626d.firebasestorage.app",
  messagingSenderId: "240209061395",
  appId: "1:240209061395:web:7d3b10eca7cbc2691981e6",
  measurementId: "G-HVX6WWVQCX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

