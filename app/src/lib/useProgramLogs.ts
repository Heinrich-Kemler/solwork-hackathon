"use client";

import { useEffect, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_ID } from "./anchor";

/**
 * Subscribes to on-chain logs for the Accord program.
 * Calls `onEvent` whenever a transaction touches the program,
 * which triggers a refresh of job data.
 */
export function useProgramLogs(onEvent: () => void) {
  const { connection } = useConnection();
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    let subId: number | null = null;

    try {
      subId = connection.onLogs(
        PROGRAM_ID,
        (logs) => {
          if (logs.err) return;
          // Debounce — wait a beat for the tx to finalize
          setTimeout(() => callbackRef.current(), 1500);
        },
        "confirmed"
      );
    } catch (err) {
      console.warn("Failed to subscribe to program logs:", err);
    }

    return () => {
      if (subId !== null) {
        connection.removeOnLogsListener(subId).catch(() => {});
      }
    };
  }, [connection]);
}
