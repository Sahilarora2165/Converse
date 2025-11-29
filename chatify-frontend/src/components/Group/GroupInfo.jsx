import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { addParticipant, removeParticipant } from '../../api/chatrooms';
import { getAllUsers } from '../../api/users';
import Avatar from '../Common/Avatar';
import LoadingSpinner from '../Common/LoadingSpinner';
import toast from 'react-hot-toast';

const GroupInfo = ({ chatRoom, onClose, onChatRoomUpdated }) => {
  const { user } = useAuth();
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const isAdmin = chatRoom.admin?.id === user?.id;

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const allUsers = await getAllUsers();
      const participantIds = chatRoom.participants?.map((p) => p.id) || [];
      const available = allUsers.filter((u) => !participantIds.includes(u.id));
      setAvailableUsers(available);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddParticipant = async (userId) => {
    setActionLoading(userId);
    try {
      const updated = await addParticipant(chatRoom.id, userId);
      toast.success('Participant added');
      onChatRoomUpdated(updated);
      setShowAddParticipant(false);
    } catch (error) {
      console.error('Failed to add participant:', error);
      toast.error(error.response?.data?.message || 'Failed to add participant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveParticipant = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this participant?')) {
      return;
    }

    setActionLoading(userId);
    try {
      const updated = await removeParticipant(chatRoom.id, userId);
      toast.success('Participant removed');
      onChatRoomUpdated(updated);
    } catch (error) {
      console.error('Failed to remove participant:', error);
      toast.error(error.response?.data?.message || 'Failed to remove participant');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Group Info</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* Group Name */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-medium">
              {chatRoom.name?.charAt(0)?.toUpperCase() || 'G'}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{chatRoom.name}</h3>
              <p className="text-sm text-gray-500">
                {chatRoom.participants?.length} participants
              </p>
            </div>
          </div>

          {/* Participants */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">Participants</h4>
              {isAdmin && !showAddParticipant && (
                <button
                  onClick={() => {
                    setShowAddParticipant(true);
                    loadAvailableUsers();
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  + Add
                </button>
              )}
            </div>

            {showAddParticipant ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 border-b flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Select user to add</span>
                  <button
                    onClick={() => setShowAddParticipant(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center h-20">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-gray-500 text-sm">
                      No users available
                    </div>
                  ) : (
                    <div className="divide-y">
                      {availableUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleAddParticipant(u.id)}
                          disabled={actionLoading === u.id}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left disabled:opacity-50"
                        >
                          <Avatar user={u} size="sm" />
                          <span className="text-sm">{u.username}</span>
                          {actionLoading === u.id && (
                            <LoadingSpinner size="sm" className="ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {chatRoom.participants?.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar user={participant} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {participant.username}
                          {participant.id === user?.id && ' (You)'}
                        </p>
                        {participant.id === chatRoom.admin?.id && (
                          <span className="text-xs text-indigo-600">Admin</span>
                        )}
                      </div>
                    </div>
                    {isAdmin && participant.id !== user?.id && (
                      <button
                        onClick={() => handleRemoveParticipant(participant.id)}
                        disabled={actionLoading === participant.id}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === participant.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupInfo;
