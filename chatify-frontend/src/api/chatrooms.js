import axios from './axios';

export const getChatRooms = async () => {
  const response = await axios.get('/api/chatrooms');
  return response.data;
};

export const getChatRoomById = async (id) => {
  const response = await axios.get(`/api/chatrooms/${id}`);
  return response.data;
};

export const createChatRoom = async (chatRoomData) => {
  const response = await axios.post('/api/chatrooms', chatRoomData);
  return response.data;
};

export const addParticipant = async (chatRoomId, userId) => {
  const response = await axios.post(`/api/chatrooms/${chatRoomId}/participants`, {
    userId,
  });
  return response.data;
};

export const removeParticipant = async (chatRoomId, userId) => {
  const response = await axios.delete(
    `/api/chatrooms/${chatRoomId}/participants/${userId}`
  );
  return response.data;
};
