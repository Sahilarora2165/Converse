import api from '../services/api';

export const getPresignedUrl = async (fileName, contentType, fileSize) => {
  const response = await api.post('/files/presigned-url', null, {
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

export const sendMessage = async (messageData) => {
  const response = await api.post('/messages', messageData);
  return response.data;
};
