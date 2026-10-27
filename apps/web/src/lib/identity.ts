import { useSyncExternalStore } from "react";

export interface Identity {
  id: string;
  name: string;
}

const STORAGE_KEY = "pod-widgets:identity";

const listeners = new Set<() => void>();
// Where the identity lives when localStorage throws (private windows).
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;
let cachedIdentity: Identity | null = null;

const readRaw = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
};

const parse = (raw: string | null): Identity | null => {
  if (raw === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      "name" in value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      value.id !== "" &&
      value.name.trim() !== ""
    ) {
      return { id: value.id, name: value.name };
    }
  } catch {
    // Corrupt JSON reads as no identity, so the name prompt reappears.
  }
  return null;
};

/** Referentially stable until the stored string changes, as the hook needs. */
const getIdentity = (): Identity | null => {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIdentity = parse(raw);
  }
  return cachedIdentity;
};

/** The headers the API's identity rungs read; empty before a name is saved. */
export const identityHeaders = (): Record<string, string> => {
  const identity = getIdentity();
  // Encoded: fetch rejects header characters above U+00FF, e.g. "Zoë".
  return identity
    ? {
        "x-identity-id": identity.id,
        "x-identity-name": encodeURIComponent(identity.name),
      }
    : {};
};

/** Keeps the id when one exists, so renaming does not become a new author. */
const saveIdentityName = (name: string): void => {
  const raw = JSON.stringify({
    id: getIdentity()?.id ?? crypto.randomUUID(),
    name: name.trim(),
  });
  memoryRaw = raw;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // The in-memory copy still carries this session.
  }
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

export const useIdentity = () => ({
  identity: useSyncExternalStore(subscribe, getIdentity, () => null),
  saveName: saveIdentityName,
});
