import type { FirebaseOptions } from "firebase/app";

type RuntimeConfig = {
  firebase?: Partial<FirebaseOptions>;
  auth?: {
    allowedDomain?: string;
    allowedEmails?: string[];
  };
};

declare global {
  interface Window {
    __BADGER_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const FIREBASE_KEYS: Array<keyof FirebaseOptions> = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDomain(value: string | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__BADGER_RUNTIME_CONFIG__ || {};
}

export function getFirebaseRuntimeConfig(): FirebaseOptions | null {
  const firebase = getRuntimeConfig().firebase;
  if (!firebase) {
    return null;
  }

  const config = {} as FirebaseOptions;
  for (const key of FIREBASE_KEYS) {
    const value = firebase[key];
    if (!value || typeof value !== "string") {
      return null;
    }
    config[key] = value;
  }

  return config;
}

export function isAllowedUserEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(String(email || ""));
  if (!normalizedEmail) {
    return false;
  }

  const auth = getRuntimeConfig().auth || {};
  const allowedEmails = new Set(
    (auth.allowedEmails || []).map((value) => normalizeEmail(String(value || ""))),
  );
  if (allowedEmails.has(normalizedEmail)) {
    return true;
  }

  const allowedDomain = normalizeDomain(auth.allowedDomain);
  return Boolean(allowedDomain) && normalizedEmail.endsWith(`@${allowedDomain}`);
}
