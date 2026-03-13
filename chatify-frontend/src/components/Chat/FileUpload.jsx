import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

const FileUpload = ({ onFileSelect, disabled }) => {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // reset so same file can be selected again
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.docx,video/mp4,video/quicktime,video/x-msvideo"
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="p-2.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Attach file"
      >
        <Paperclip className="w-[18px] h-[18px]" />
      </button>
    </>
  );
};

export default FileUpload;