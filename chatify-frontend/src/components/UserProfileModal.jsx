import React, { useState, useEffect } from "react";
import { getUserProfile } from "../services/api";
import { X, Loader2 } from "lucide-react";

const UserProfileModal = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await getUserProfile(userId);
        setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">User Profile</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : profile ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-black text-white">
                {profile.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {profile.displayName || profile.username}
                </p>
                {profile.displayName && (
                  <p className="text-xs text-zinc-500">@{profile.username}</p>
                )}
              </div>
            </div>

            {profile.bio && (
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Bio</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-xs text-zinc-600 pt-2">
              <span>
                Status:{" "}
                <span className={profile.status === "ONLINE" ? "text-emerald-400 font-bold" : "text-zinc-500"}>
                  {profile.status}
                </span>
              </span>
              {profile.createdAt && (
                <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 text-sm">User not found</div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
