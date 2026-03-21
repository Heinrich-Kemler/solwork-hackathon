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
  skills: string[];
  available: boolean;
  email: string;
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
  skills: [],
  available: false,
  email: "",
};

/** Calculate profile completeness (0-100) */
export function calcCompleteness(p: LocalProfile): { score: number; missing: string[] } {
  const checks: [boolean, number, string][] = [
    [!!p.username, 10, "Display name"],
    [!!p.bio, 15, "Bio"],
    [!!p.avatar, 10, "Profile picture"],
    [!!p.github, 15, "GitHub"],
    [!!p.twitter, 10, "Twitter/X"],
    [!!p.linkedin, 10, "LinkedIn"],
    [!!p.website, 5, "Website"],
    [!!p.telegram, 5, "Telegram"],
    [p.skills.length >= 3, 10, "3+ skills"],
    [p.available, 10, "Availability status"],
  ];
  let score = 0;
  const missing: string[] = [];
  for (const [done, pts, label] of checks) {
    if (done) score += pts;
    else missing.push(label);
  }
  return { score, missing };
}

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
