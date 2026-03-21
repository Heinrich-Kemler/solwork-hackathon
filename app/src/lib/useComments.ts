"use client";

import { useState, useEffect, useCallback } from "react";

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

function storageKey(jobPubkey: string) {
  return `solwork-comments-${jobPubkey}`;
}

export function useComments(jobPubkey: string) {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(jobPubkey));
      if (raw) setComments(JSON.parse(raw));
    } catch {
      setComments([]);
    }
  }, [jobPubkey]);

  const addComment = useCallback(
    (author: string, text: string) => {
      const newComment: Comment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author,
        text,
        timestamp: Date.now(),
      };
      setComments((prev) => {
        const updated = [...prev, newComment];
        localStorage.setItem(storageKey(jobPubkey), JSON.stringify(updated));
        return updated;
      });
    },
    [jobPubkey]
  );

  return { comments, addComment };
}
