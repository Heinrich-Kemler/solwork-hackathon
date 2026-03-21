"use client";

import { useSNS } from "@/lib/sns";

interface WalletNameProps {
  address: string;
  truncate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Displays a wallet address, resolving to .sol name if available.
 * Falls back to truncated address.
 */
export default function WalletName({
  address,
  truncate = true,
  className,
  style,
}: WalletNameProps) {
  const solName = useSNS(address);

  const display = solName
    ? solName
    : truncate
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : address;

  return (
    <span className={className} style={style} title={address}>
      {display}
    </span>
  );
}
