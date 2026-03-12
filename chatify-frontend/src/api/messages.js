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
  const response = await axios.put(`/api/messages/chatroom/${chatRoomId}/read-all`);
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await axios.delete(`/api/messages/${messageId}`);
  return response.data;
};

// Step 1 of file upload flow:
// Ask backend for a presigned S3 URL — backend validates type/size, returns presignedUrl + fileUrl
export const getPresignedUrl = async (fileName, contentType, fileSize) => {
  const response = await axios.post('/api/files/presigned-url', null, {
    params: { fileName, contentType, fileSize },
  });
  return response.data; // { fileName, fileUrl, presignedUrl, fileType, fileSize }
};

// Step 2 of file upload flow:
// PUT the actual file directly to S3 using the presigned URL
// No auth header — this goes directly to S3, not our backend
export const uploadFileToS3 = async (presignedUrl, file) => {
  await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });
};