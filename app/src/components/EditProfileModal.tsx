"use client";

import { useState, useEffect } from "react";
import { Github, Twitter, Linkedin, Globe, Send, X } from "lucide-react";
import type { LocalProfile } from "@/lib/useLocalProfile";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: LocalProfile;
  onSave: (data: LocalProfile) => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSave,
}: EditProfileModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [github, setGithub] = useState(profile.github);
  const [twitter, setTwitter] = useState(profile.twitter);
  const [linkedin, setLinkedin] = useState(profile.linkedin);
  const [website, setWebsite] = useState(profile.website);
  const [telegram, setTelegram] = useState(profile.telegram);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [available, setAvailable] = useState(profile.available || false);
  const [email, setEmail] = useState(profile.email || "");

  // Sync state when profile changes
  useEffect(() => {
    setUsername(profile.username);
    setBio(profile.bio);
    setAvatar(profile.avatar);
    setGithub(profile.github);
    setTwitter(profile.twitter);
    setLinkedin(profile.linkedin);
    setWebsite(profile.website);
    setTelegram(profile.telegram);
    setSkills(profile.skills || []);
    setAvailable(profile.available || false);
    setEmail(profile.email || "");
  }, [profile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s) && skills.length < 10) {
      setSkills([...skills, s]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = () => {
    onSave({
      username: username.trim(),
      bio: bio.trim(),
      avatar: avatar.trim(),
      github: github.trim(),
      twitter: twitter.trim(),
      linkedin: linkedin.trim(),
      website: website.trim(),
      telegram: telegram.trim(),
      skills,
      available,
      email: email.trim(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-out panel */}
      <div className="relative h-full w-full max-w-md overflow-y-auto animate-slide-up" style={{ background: 'var(--bg-base)', borderLeft: '1px solid var(--border)' }}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Edit Profile</h2>
            <button onClick={onClose} className="p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Profile picture URL</label>
            <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." className="input w-full px-3 py-1.5 text-sm" />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Display name</label>
            <input type="text" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} className="input w-full px-3 py-2" />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Bio</label>
            <textarea maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input w-full px-3 py-2" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{bio.length}/300</p>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Skills</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="e.g. Solidity, React..."
                className="input flex-1 px-3 py-1.5 text-sm"
              />
              <button onClick={addSkill} className="btn-ghost px-3 py-1.5 text-sm">Add</button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    {s}
                    <button onClick={() => removeSkill(s)} className="hover:opacity-70"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Available for work</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Show clients you are open to new projects</p>
            </div>
            <button
              onClick={() => setAvailable(!available)}
              className="w-10 h-5 rounded-full relative transition-colors"
              style={{ background: available ? 'var(--success)' : 'var(--border)' }}
            >
              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ left: available ? '22px' : '2px' }} />
            </button>
          </div>

          {/* Email for notifications */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email for notifications</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input w-full px-3 py-1.5 text-sm" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Never shared. Used only for job notifications.</p>
          </div>

          {/* Social links */}
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Social links</p>
            {[
              { icon: Github, value: github, set: setGithub, placeholder: "GitHub username" },
              { icon: Twitter, value: twitter, set: setTwitter, placeholder: "@handle" },
              { icon: Linkedin, value: linkedin, set: setLinkedin, placeholder: "LinkedIn username" },
              { icon: Globe, value: website, set: setWebsite, placeholder: "https://yoursite.com" },
              { icon: Send, value: telegram, set: setTelegram, placeholder: "@telegram" },
            ].map((field) => (
              <div key={field.placeholder} className="flex items-center gap-2">
                <field.icon size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                <input type="text" value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} className="input flex-1 px-3 py-1.5 text-sm" />
              </div>
            ))}
          </div>

          <button onClick={handleSave} className="btn-primary w-full py-2.5">Save Profile</button>
        </div>
      </div>
    </div>
  );
}
