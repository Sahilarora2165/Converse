export const API_URL = import.meta.env.VITE_API_URL || '';
export const WS_URL = import.meta.env.VITE_WS_URL || '/ws';

export const MESSAGE_TYPES = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  FILE: 'FILE',
};

export const USER_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  AWAY: 'AWAY',
};

// matches FileStorageService.ALLOWED_TYPES exactly — no extras, no missing
export const ALLOWED_FILE_TYPES = {
  'image/jpeg':       { maxMB: 5,  extensions: ['.jpg', '.jpeg'] },
  'image/png':        { maxMB: 5,  extensions: ['.png'] },
  'image/gif':        { maxMB: 5,  extensions: ['.gif'] },
  'image/webp':       { maxMB: 5,  extensions: ['.webp'] },
  'application/pdf':  { maxMB: 10, extensions: ['.pdf'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { maxMB: 10, extensions: ['.docx'] },
  'video/mp4':        { maxMB: 50, extensions: ['.mp4'] },
  'video/quicktime':  { maxMB: 50, extensions: ['.mov'] },
  'video/x-msvideo':  { maxMB: 50, extensions: ['.avi'] },
};

// flat list for quick "is this type allowed?" checks
export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED_FILE_TYPES);

// absolute max across all types
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (videos)ax