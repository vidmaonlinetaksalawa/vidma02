// ============================================================
// FIREBASE INITIALIZATION
// Replace the config below with YOUR project's config values.
// Get them from: Firebase Console > Project Settings > General
//                 > Your apps > SDK setup and configuration
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCFaG8dPuy1cVlsCeaXezIYczrUk_0MSFk",
  authDomain: "vidma01-f4345.firebaseapp.com",
  projectId: "vidma01-f4345",
  storageBucket: "vidma01-f4345.firebasestorage.app",
  messagingSenderId: "532484996648",
  appId: "1:532484996648:web:2929bad8e971750fb1ff1d"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper: current month key, e.g. "2026-09"
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Helper: simple redirect-if-not-logged-in guard used on protected pages
export function requireLogin(onUser) {
  return new Promise((resolve) => {
    import(
      "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
    ).then(({ onAuthStateChanged }) => {
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          window.location.href = "index.html";
        } else {
          onUser && onUser(user);
          resolve(user);
        }
      });
    });
  });
}
