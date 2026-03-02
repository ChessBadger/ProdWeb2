import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirebaseRuntimeConfig } from "./runtimeConfig";

const firebaseConfig = getFirebaseRuntimeConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;

googleProvider?.setCustomParameters({
  prompt: "select_account",
});
