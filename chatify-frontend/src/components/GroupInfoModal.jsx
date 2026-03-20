import React, { useState } from "react";
import { updateGroupName, removeParticipant, leaveGroup, transferAdmin } from "../services/api";
import { X, Crown, LogOut, UserMinus, Edit3, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const GroupInfoModal = ({ chatRoom, currentUserId, onClose, onUpdate, onLeave }) => {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(chatRoom.name);
  const [saving, setSaving] = useState(false);

  const isAdmin = chatRoom.admin?.id === currentUserId;
  const participants = Array.from(chatRoom.participants || []);

  const handleUpdateName = async () => {
    if (!newName.trim() || newName === chatRoom.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateGroupName(chatRoom.id, newName.trim());
      toast.success("Group name updated");
      setEditingName(false);
      onUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveParticipant = async (userId) => {
    try {
      await removeParticipant(chatRoom.id, userId);
      toast.success("Participant removed");
      onUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove participant");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup(chatRoom.id);
      toast.success("Left the group");
      onLeave?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to leave group");
    }
  };

  const handleTransferAdmin = async (newAdminId) => {
    try {
      await transferAdmin(chatRoom.id, newAdminId);
      toast.success("Admin transferred");
      onUpdate?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to transfer admin");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Group Info</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Group name */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
              {chatRoom.name?.[0]?.toUpperCase() || "G"}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                    className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={saving}
                    className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-white truncate">{chatRoom.name}</p>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-zinc-300"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-zinc-500">{participants.length} members</p>
            </div>
          </div>

          {/* Participants */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Members</p>
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-white/5">
                      {p.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${p.status === "ONLINE" ? "bg-emerald-400" : "bg-zinc-700"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">{p.username}</span>
                      {p.id === chatRoom.admin?.id && (
                        <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                      {p.id === currentUserId && (
                        <span className="text-[9px] text-zinc-600 font-bold uppercase">You</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && p.id !== currentUserId && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTransferAdmin(p.id)}
                        className="p-1.5 rounded-lg hover:bg-amber-500/10 text-zinc-600 hover:text-amber-400 transition-colors"
                        title="Make admin"
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Leave group */}
          <button
            onClick={handleLeave}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Leave Group
          </button>

          {chatRoom.createdAt && (
            <p className="text-center text-[10px] text-zinc-600">
              Created {new Date(chatRoom.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
