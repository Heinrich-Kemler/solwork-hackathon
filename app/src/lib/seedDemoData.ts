import type { LocalProfile } from "./useLocalProfile";

const STORAGE_KEY = "solwork-local-profile";

const DEMO_PROFILES: { wallet: string; profile: LocalProfile }[] = [
  {
    wallet: "A1ice1111111111111111111111111111111111111111",
    profile: {
      username: "alice.sol",
      bio: "Full-stack Solana dev. 3 years building on-chain.",
      github: "alice-sol",
      twitter: "@alice_sol",
      linkedin: "alice-sol",
      website: "https://alice.dev",
      telegram: "@alice_sol",
      avatar: "",
      skills: ["Rust", "Anchor", "React", "TypeScript"],
      available: true,
      email: "",
    },
  },
  {
    wallet: "B0b22222222222222222222222222222222222222222",
    profile: {
      username: "bob.crypto",
      bio: "Smart contract auditor. Security first.",
      github: "bob-audits",
      twitter: "@bob_crypto",
      linkedin: "",
      website: "",
      telegram: "@bob_audits",
      avatar: "",
      skills: ["Solidity", "Rust", "Security", "Auditing"],
      available: true,
      email: "",
    },
  },
  {
    wallet: "Car0133333333333333333333333333333333333333333",
    profile: {
      username: "carol.design",
      bio: "UI/UX designer specializing in Web3 products.",
      github: "carol-design",
      twitter: "@carol_design",
      linkedin: "carol-design",
      website: "https://carol.design",
      telegram: "",
      avatar: "",
      skills: ["Figma", "UI/UX", "Branding", "Design Systems"],
      available: false,
      email: "",
    },
  },
  {
    wallet: "Dav3444444444444444444444444444444444444444444",
    profile: {
      username: "dave.eth",
      bio: "Cross-chain builder. Solana + EVM.",
      github: "dave-builds",
      twitter: "@dave_eth",
      linkedin: "",
      website: "https://dave.build",
      telegram: "@dave_builds",
      avatar: "",
      skills: ["Solana", "Ethereum", "Bridge", "DeFi"],
      available: true,
      email: "",
    },
  },
  {
    wallet: "Eve55555555555555555555555555555555555555555555",
    profile: {
      username: "eve.sol",
      bio: "Technical writer and DevRel. Making docs better.",
      github: "eve-docs",
      twitter: "@eve_sol",
      linkedin: "eve-docs",
      website: "",
      telegram: "",
      avatar: "",
      skills: ["Documentation", "DevRel", "Writing", "Solana"],
      available: true,
      email: "",
    },
  },
];

export function seedDemoProfiles() {
  if (typeof window === "undefined") return;

  for (const { wallet, profile } of DEMO_PROFILES) {
    const key = `${STORAGE_KEY}:${wallet}`;
    // Only seed if not already present
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(profile));
    }
  }

  console.log("[Accord] Demo profiles seeded for leaderboard demo");
}
