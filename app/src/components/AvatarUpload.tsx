"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

interface AvatarUploadProps {
  value: string; // base64 or URL
  fallback: string; // initials
  onChange: (base64: string) => void;
  size?: number;
}

export default function AvatarUpload({
  value,
  fallback,
  onChange,
  size = 80,
}: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (file.size > MAX_SIZE) {
      setError("Image must be under 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onChange(base64);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="space-y-1">
      <div
        onClick={() => fileRef.current?.click()}
        className="relative cursor-pointer group"
        style={{ width: size, height: size }}
      >
        <div
          className="rounded-full flex items-center justify-center font-bold overflow-hidden"
          style={{
            width: size,
            height: size,
            background: "var(--accent-subtle)",
            border: "2px solid var(--border)",
            color: "var(--accent)",
            fontSize: size * 0.3,
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            fallback
          )}
        </div>

        {/* Camera overlay */}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <Camera size={size * 0.25} color="white" />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />

      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
