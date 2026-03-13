import React, { useState, useEffect, useCallback } from 'react';
import { searchUsers, getAllUsers, createChatRoom } from '../services/api';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { X, Search, Users, MessageSquare, Loader2, Check } from 'lucide-react';

const NewChatModal = ({ onClose, onChatCreated }) => {
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');

    const loadInitialUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await getAllUsers();
            setUsers(data.filter(u => u.id !== currentUser?.id));
        } catch (err) {
            console.error("Failed to load users", err);
            toast.error("Could not load user list");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        loadInitialUsers();
    }, [loadInitialUsers]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            loadInitialUsers();
            return;
        }
        setLoading(true);
        try {
            const { data } = await searchUsers(searchTerm);
            setUsers(data.filter(u => u.id !== currentUser?.id));
        } catch (err) {
            toast.error("Search failed");
        } finally {
            setLoading(false);
        }
    };

    const toggleUserSelect = (user) => {
        if (!isGroup) {
            handleCreateChat(user.username, false, [user.id]);
        } else {
            const isSelected = selectedUsers.find(u => u.id === user.id);
            if (isSelected) {
                setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
            } else {
                setSelectedUsers([...selectedUsers, user]);
            }
        }
    };

    const handleCreateChat = async (name, groupFlag, participantIds) => {
        if (groupFlag && !name.trim()) {
            toast.error("Please enter a group name");
            return;
        }
        setCreating(true);
        try {
            const { data } = await createChatRoom(name, groupFlag, participantIds);
            onChatCreated(data);
            onClose();
            toast.success(groupFlag ? "Group created!" : "Chat started!");
        } catch (err) {
            console.error("Chat Creation Error:", err.response?.data || err.message);
            toast.error("Failed to create conversation");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-zinc-950 border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white tracking-tight">New Conversation</h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                            {isGroup ? 'Add members to your group' : 'Select a user to message'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all duration-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tab Switcher — matches sidebar tabs exactly */}
                <div className="mx-6 flex p-0.5 bg-zinc-900/50 rounded-xl border border-white/[0.03] mb-4">
                    <button
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                            !isGroup
                                ? 'bg-zinc-800 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        onClick={() => { setIsGroup(false); setSelectedUsers([]); }}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Direct
                    </button>
                    <button
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                            isGroup
                                ? 'bg-zinc-800 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        onClick={() => setIsGroup(true)}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Group
                    </button>
                </div>

                <div className="px-6 pb-2 space-y-3">
                    {/* Group Name Input */}
                    {isGroup && (
                        <div>
                            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider ml-0.5 mb-1 block">
                                Group Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Project Alpha"
                                className="w-full bg-zinc-900 border border-white/[0.06] text-zinc-100 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500/40 placeholder-zinc-600 transition-all duration-200"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="w-full bg-zinc-900 border border-white/[0.06] text-zinc-100 text-sm pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500/40 placeholder-zinc-600 transition-all duration-200"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </form>

                    {/* Selected chips for group mode */}
                    {isGroup && selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {selectedUsers.map(u => (
                                <span
                                    key={u.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/[0.12] border border-indigo-500/20 text-indigo-300 text-[11px] font-medium rounded-lg"
                                >
                                    {u.username}
                                    <button
                                        onClick={() => setSelectedUsers(selectedUsers.filter(s => s.id !== u.id))}
                                        className="hover:text-white transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Users List */}
                <div className="max-h-64 overflow-y-auto px-6 pb-4 space-y-1 custom-scrollbar">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center gap-3">
                            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                            <p className="text-xs text-zinc-600">Loading users</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-sm text-zinc-600">No users found</p>
                        </div>
                    ) : (
                        users.map(u => {
                            const isSelected = selectedUsers.find(s => s.id === u.id);
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => toggleUserSelect(u)}
                                    disabled={creating}
                                    className={`w-full px-3 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 text-left border ${
                                        isSelected
                                            ? 'bg-indigo-500/[0.08] border-indigo-500/20'
                                            : 'border-transparent hover:bg-white/[0.03]'
                                    } disabled:opacity-50`}
                                >
                                    {/* user avatar — matches sidebar avatar style */}
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                                        isSelected
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                        {u.username.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold text-zinc-200 truncate">{u.username}</p>
                                        <p className="text-[11px] text-zinc-600 truncate">{u.email}</p>
                                    </div>

                                    {/* checkbox for group mode */}
                                    {isGroup && (
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                                            isSelected
                                                ? 'bg-indigo-500 border-indigo-500'
                                                : 'border-zinc-700'
                                        }`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer — Group create button */}
                {isGroup && (
                    <div className="px-6 pb-6 pt-2">
                        <button
                            onClick={() => handleCreateChat(groupName, true, selectedUsers.map(u => u.id))}
                            disabled={creating || selectedUsers.length === 0 || !groupName.trim()}
                            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_rgba(99,102,241,0.2)] active:scale-[0.98]"
                        >
                            {creating ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                `Create Group · ${selectedUsers.length} member${selectedUsers.length !== 1 ? 's' : ''}`
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewChatModal;