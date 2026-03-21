"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useComments } from "@/lib/useComments";

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function JobComments({ jobPubkey }: { jobPubkey: string }) {
  const { publicKey } = useWallet();
  const { comments, addComment } = useComments(jobPubkey);
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !text.trim()) return;
    addComment(publicKey.toBase58(), text.trim());
    setText("");
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Q&A ({comments.length})
      </h3>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-500">
          No comments yet. Ask a question or leave a note.
        </p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="border-l-2 border-gray-700 pl-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-mono text-purple-400">
                  {truncate(c.author)}
                </span>
                <span>&middot;</span>
                <span>{timeAgo(c.timestamp)}</span>
              </div>
              <p className="text-sm text-gray-300 mt-0.5">{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      {publicKey ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask a question..."
            maxLength={280}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
          >
            Post
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-500">
          Connect your wallet to post a comment.
        </p>
      )}
    </div>
  );
}
