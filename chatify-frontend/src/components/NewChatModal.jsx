import React, { useState, useEffect, useCallback } from 'react';
import { searchUsers, getAllUsers, createChatRoom } from '../services/api';
import useAuth from '../hooks/useAuth';
import Avatar from './Common/Avatar'; // Assuming path based on previous files
import LoadingSpinner from './Common/LoadingSpinner';
import toast from 'react-hot-toast';

const NewChatModal = ({ onClose, onChatCreated }) => {
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');

    // Load all users initially so the list isn't empty
    const loadInitialUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await getAllUsers();
            // Filter out current user from the list
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
            // In Direct Message mode, clicking a user starts the chat immediately
            handleCreateChat(user.username, false, [user.id]);
        } else {
            // In Group mode, toggle selection
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
            // This matches api.js: createChatRoom(name, isGroup, participantIds)
            // Which then sends { name, isGroupChat: groupFlag, participantIds } to backend
            const { data } = await createChatRoom(name, groupFlag, participantIds);

            onChatCreated(data); // Pass the new ChatRoomDTO to Chat.jsx
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">New Collaboration</h2>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                            {isGroup ? 'Assemble your team' : 'Start a private secure line'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-4 gap-6 border-b border-slate-800/50">
                    <button
                        className={`pb-3 text-sm font-bold transition-all ${!isGroup ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                        onClick={() => { setIsGroup(false); setSelectedUsers([]); }}
                    >
                        DIRECT MESSAGE
                    </button>
                    <button
                        className={`pb-3 text-sm font-bold transition-all ${isGroup ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                        onClick={() => setIsGroup(true)}
                    >
                        GROUP CHAT
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Group Name Input */}
                    {isGroup && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Group Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Project Alpha"
                                className="w-full bg-slate-950 border border-slate-800 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative group">
                        <input
                            type="text"
                            placeholder="Search users by name..."
                            className="w-full bg-slate-950 border border-slate-800 text-white pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500">
                            🔍
                        </span>
                    </form>

                    {/* Users List */}
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="py-10 flex justify-center"><LoadingSpinner /></div>
                        ) : users.length === 0 ? (
                            <p className="text-center py-10 text-slate-500 text-sm italic">No agents found on the network.</p>
                        ) : (
                            users.map(u => {
                                const isSelected = selectedUsers.find(s => s.id === u.id);
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => toggleUserSelect(u)}
                                        disabled={creating}
                                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border text-left
                                            ${isSelected
                                                ? 'bg-blue-600/10 border-blue-600/50'
                                                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 border border-slate-700">
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-200 truncate">{u.username}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                        </div>
                                        {isGroup && (
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all
                                                ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-700'}`}>
                                                {isSelected && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                {isGroup && (
                    <div className="p-6 bg-slate-950/50 border-t border-slate-800">
                        <button
                            onClick={() => handleCreateChat(groupName, true, selectedUsers.map(u => u.id))}
                            disabled={creating || selectedUsers.length === 0 || !groupName}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
                        >
                            {creating ? 'Establishing Connection...' : `CREATE GROUP (${selectedUsers.length})`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewChatModal;