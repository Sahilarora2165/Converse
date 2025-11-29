import { useState, useEffect, useCallback } from 'react';
import { getAllUsers } from '../../api/users';
import { createChatRoom } from '../../api/chatrooms';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../Common/Avatar';
import LoadingSpinner from '../Common/LoadingSpinner';
import toast from 'react-hot-toast';

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data.filter((u) => u.id !== user?.id));
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleUser = (selectedUser) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.id === selectedUser.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== selectedUser.id);
      }
      return [...prev, selectedUser];
    });
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedUsers.length < 1) {
      toast.error('Please select at least one participant');
      return;
    }

    setCreating(true);
    try {
      const chatRoom = await createChatRoom({
        name: groupName,
        isGroupChat: true,
        participantIds: selectedUsers.map((u) => u.id),
      });
      toast.success('Group created successfully');
      onGroupCreated(chatRoom);
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Create Group Chat</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCreateGroup}>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
            </div>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected ({selectedUsers.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                    >
                      {u.username}
                      <button
                        type="button"
                        onClick={() => toggleUser(u)}
                        className="hover:text-indigo-900"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add Participants
              </label>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border-t border-b">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <LoadingSpinner size="md" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-500">
                <p>No users available</p>
              </div>
            ) : (
              <div className="divide-y">
                {users.map((u) => {
                  const isSelected = selectedUsers.some((s) => s.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u)}
                      className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                        isSelected ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <Avatar user={u} size="sm" />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800 text-sm">{u.username}</h3>
                      </div>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4">
            <button
              type="submit"
              disabled={creating || !groupName.trim() || selectedUsers.length < 1}
              className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {creating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
