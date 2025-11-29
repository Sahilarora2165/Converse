import axios from './axios';

export const getMessages = async (chatRoomId) => {
  const response = await axios.get(`/api/messages/chatroom/${chatRoomId}`);
  return response.data;
};

export const getMessagesPaginated = async (chatRoomId, page = 0, size = 20) => {
  const response = await axios.get(
    `/api/messages/chatroom/${chatRoomId}/paginated`,
    { params: { page, size } }
  );
  return response.data;
};

export const sendMessage = async (messageData) => {
  const response = await axios.post('/api/messages', messageData);
  return response.data;
};

export const markMessageAsRead = async (messageId) => {
  const response = await axios.put(`/api/messages/${messageId}/read`);
  return response.data;
};

export const markAllMessagesAsRead = async (chatRoomId) => {
  const response = await axios.put(
    `/api/messages/chatroom/${chatRoomId}/read-all`
  );
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await axios.delete(`/api/messages/${messageId}`);
  return response.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post('/api/messages/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const sendMessageWithFile = async (chatRoomId, content, file) => {
  const formData = new FormData();
  formData.append('chatRoomId', chatRoomId);
  formData.append('content', content);
  formData.append('file', file);

  const response = await axios.post('/api/messages/with-file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
