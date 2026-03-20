import React, { useState, useEffect } from "react";
import { getOwnProfile, updateOwnProfile } from "../services/api";
import { X, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";

const ProfileModal = ({ onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await getOwnProfile();
        setProfile(data);
        setBio(data.bio || "");
        setDisplayName(data.displayName || "");
      } catch (err) {
        console.error(err);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await updateOwnProfile({ bio, displayName });
      setProfile(data);
      toast.success("Profile updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">My Profile</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : profile && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-black text-white">
                {profile.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{profile.username}</p>
                <p className="text-xs text-zinc-500">{profile.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Set a display name..."
                className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Tell us about yourself..."
                rows={3}
                className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
              <p className="text-[10px] text-zinc-600 mt-1 text-right">{bio.length}/500</p>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span>Status: <span className={profile.status === "ONLINE" ? "text-emerald-400" : "text-zinc-500"}>{profile.status}</span></span>
              {profile.lastSeen && (
                <span>Last seen: {new Date(profile.lastSeen).toLocaleString()}</span>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-indigo-400 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
