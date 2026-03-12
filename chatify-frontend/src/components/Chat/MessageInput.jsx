import { useState, useRef } from 'react';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import { useWebSocket } from '../../context/WebSocketContext';
import { sendMessage, getPresignedUrl, uploadFileToS3 } from '../../api/messages';
import FileUpload from './FileUpload';
import toast from 'react-hot-toast';

// per-type size limits matching backend
const MAX_SIZES = {
  'image/jpeg': 5, 'image/png': 5, 'image/gif': 5, 'image/webp': 5,
  'application/pdf': 10,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10,
  'video/mp4': 50, 'video/quicktime': 50, 'video/x-msvideo': 50,
};

const getMessageType = (contentType) => {
  if (contentType?.startsWith('image/')) return 'IMAGE';
  if (contentType?.startsWith('video/')) return 'VIDEO';
  return 'FILE';
};

const MessageInput = ({ chatRoomId, onMessageSent }) => {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const { startTyping, stopTyping } = useTypingIndicator(chatRoomId);
  const { isConnected } = useWebSocket();

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (e.target.value.trim()) startTyping();
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    const maxMB = MAX_SIZES[file.type];
    if (!maxMB) {
      toast.error('File type not allowed');
      return;
    }

    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Max size for this file type is ${maxMB}MB`);
      return;
    }

    setSelectedFile(file);

    // image preview only
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() && !selectedFile) return;
    if (sending) return;

    setSending(true);
    stopTyping();

    try {
      let sentMessage;

      if (selectedFile) {
        // Step 1 — get presigned URL from our backend
        const { presignedUrl, fileUrl } = await getPresignedUrl(
          selectedFile.name,
          selectedFile.type,
          selectedFile.size
        );

        // Step 2 — PUT file directly to S3 (never touches our server)
        await uploadFileToS3(presignedUrl, selectedFile);

        // Step 3 — send message with the permanent S3 fileUrl via REST
        sentMessage = await sendMessage({
          chatRoomId,
          content: message || '',
          messageType: getMessageType(selectedFile.type),
          fileUrl,
          fileName: selectedFile.name,
        });
      } else {
        sentMessage = await sendMessage({
          chatRoomId,
          content: message,
          messageType: 'TEXT',
        });
      }

      setMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);

      if (onMessageSent && sentMessage) onMessageSent(sentMessage);
      inputRef.current?.focus();

      if (!isConnected) {
        toast('Message sent. Real-time updates may be delayed.', { icon: '⚠️' });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white border-t p-4">
      {/* File preview bar */}
      {selectedFile && (
        <div className="mb-3 p-3 bg-gray-100 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="h-16 w-16 object-cover rounded" />
            ) : (
              <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium text-sm truncate max-w-[200px]">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button type="button" onClick={handleRemoveFile} className="p-1 text-gray-500 hover:text-red-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <FileUpload onFileSelect={handleFileSelect} disabled={sending} />

        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full px-4 py-2.5 bg-gray-100 border-0 rounded-full focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            disabled={sending}
          />
        </div>

        <button
          type="submit"
          disabled={(!message.trim() && !selectedFile) || sending}
          className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;