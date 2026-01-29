import React, { useState } from 'react';
import { searchUsers, createChatRoom } from '../services/api';
import useAuth from '../hooks/useAuth';
import toast from 'react-hot-toast';

const NewChatModal = ({ onClose, onChatCreated }) => {
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        try {
            // If you don't have a specific search API yet, use getAllUsers() and filter locally
            // For now, let's assume searchUsers works or returns all users
            const { data } = await searchUsers(searchTerm);

            // Filter out myself
            const filtered = data.filter(u => u.id !== currentUser.id);
            setResults(filtered);
        } catch (err) {
            console.error(err);
            toast.error("Failed to search users");
        }
    };

    const toggleUserSelect = (user) => {
        if (selectedUsers.find(u => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
        } else {
            if (!isGroup) {
                // If single chat, simplify selection
                startSingleChat(user);
            } else {
                setSelectedUsers([...selectedUsers, user]);
            }
        }
    };

    const startSingleChat = async (targetUser) => {
        try {
            // Check if backend handles "get existing chat" logic, or just creates new
            const { data } = await createChatRoom(
                                     targetUser.username,
                                     false,
                                     [targetUser.id]
                                   );
            onChatCreated(data);
            onClose();
            toast.success("Chat started!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to start chat");
        }
    };

    const createGroup = async () => {
        if (!groupName || selectedUsers.length === 0) return;
        try {
            const ids = selectedUsers.map(u => u.id);;
            const { data } = await createChatRoom(groupName, true, ids);
            onChatCreated(data);
            onClose();
            toast.success("Group created!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to create group");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                <div className="flex justify-between mb-4">
                    <h2 className="text-xl font-bold">New Message</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500">✕</button>
                </div>

                {/* Toggle Group Mode */}
                <div className="mb-4 flex gap-4 text-sm">
                    <button
                        className={`pb-1 ${!isGroup ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                        onClick={() => { setIsGroup(false); setSelectedUsers([]); }}
                    >
                        Direct Message
                    </button>
                    <button
                        className={`pb-1 ${isGroup ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                        onClick={() => setIsGroup(true)}
                    >
                        Group Chat
                    </button>
                </div>

                {/* Group Name Input */}
                {isGroup && (
                    <input
                        type="text"
                        placeholder="Group Name"
                        className="w-full border p-2 rounded mb-4"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                    />
                )}

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="flex-1 border p-2 rounded"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <button className="bg-blue-600 text-white px-4 rounded">🔍</button>
                </form>

                {/* Results List */}
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {results.map(u => (
                        <div
                            key={u.id}
                            onClick={() => toggleUserSelect(u)}
                            className={`p-2 border rounded cursor-pointer flex justify-between items-center hover:bg-gray-50
                                ${selectedUsers.find(s => s.id === u.id) ? 'bg-blue-50 border-blue-500' : ''}`}
                        >
                            <span>{u.username}</span>
                            {isGroup && selectedUsers.find(s => s.id === u.id) && <span>✓</span>}
                        </div>
                    ))}
                </div>

                {/* Create Group Button */}
                {isGroup && (
                    <button
                        onClick={createGroup}
                        className="w-full mt-4 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                    >
                        Create Group ({selectedUsers.length})
                    </button>
                )}
            </div>
        </div>
    );
};

export default NewChatModal;