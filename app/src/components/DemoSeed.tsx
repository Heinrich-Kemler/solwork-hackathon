"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { seedDemoProfiles } from "@/lib/seedDemoData";

export default function DemoSeed() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (searchParams.get("seed") === "true") {
      seedDemoProfiles();
    }
  }, [searchParams]);

  return null;
}
