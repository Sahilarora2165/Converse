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

export const getPresignedUrl = async (fileName, contentType, fileSize) => {
  const response = await axios.post('/api/files/presigned-url', null, {
    params: { fileName, contentType, fileSize },
  });
  return response.data;
};

// upload directly to S3 — no ACL header needed, bucket policy handles read access
export const uploadFileToS3 = async (presignedUrl, file) => {
  const rawAxios = await import('axios');
  await rawAxios.default.put(presignedUrl, file, {
    headers: {
      'Content-Type': file.type,
    },
  });
};