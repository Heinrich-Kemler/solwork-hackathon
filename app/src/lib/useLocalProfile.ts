"use client";

import { useState, useEffect, useCallback } from "react";

export interface LocalProfile {
  username: string;
  bio: string;
  github: string;
  twitter: string;
  linkedin: string;
  website: string;
  telegram: string;
  avatar: string;
}

const STORAGE_KEY = "solwork-local-profile";

const EMPTY: LocalProfile = {
  username: "",
  bio: "",
  github: "",
  twitter: "",
  linkedin: "",
  website: "",
  telegram: "",
  avatar: "",
};

/** Load any wallet's local profile (for public viewing) */
export function getLocalProfileForWallet(walletAddress: string): LocalProfile {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${walletAddress}`);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return EMPTY;
}

export function useLocalProfile(walletAddress: string | null) {
  const [profile, setProfileState] = useState<LocalProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const key = walletAddress ? `${STORAGE_KEY}-${walletAddress}` : null;

  useEffect(() => {
    if (!key) {
      setProfileState(EMPTY);
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) setProfileState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    setLoaded(true);
  }, [key]);

  const saveProfile = useCallback(
    (data: LocalProfile) => {
      setProfileState(data);
      if (key) localStorage.setItem(key, JSON.stringify(data));
    },
    [key]
  );

  return { profile, saveProfile, loaded };
}
