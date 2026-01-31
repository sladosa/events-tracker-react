import { useState, useRef, useEffect } from 'react';
import { isMobileDevice } from '@/lib/constants';

interface PhotoUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string | null;  // Za Edit mode
  disabled?: boolean;
  className?: string;
}

export function PhotoUpload({
  value,
  onChange,
  existingUrl,
  disabled,
  className = '',
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Generate preview when file changes
  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (!existingUrl) {
      setPreview(null);
    }
  }, [value, existingUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image must be smaller than 10MB');
        return;
      }
      
      onChange(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setPreview(existingUrl || null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        📷 Photo
        <span className="font-normal text-gray-400 ml-1">(optional)</span>
      </label>

      {/* Preview */}
      {preview && (
        <div className="relative mb-3 inline-block">
          <img
            src={preview}
            alt="Preview"
            className="max-w-xs max-h-48 rounded-lg border border-gray-200 shadow-sm object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              title="Remove photo"
            >
              ×
            </button>
          )}
          {value && (
            <p className="text-xs text-gray-500 mt-1">
              {value.name} ({(value.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      )}

      {/* Upload button */}
      {!preview && (
        <div 
          onClick={disabled ? undefined : triggerInput}
          className={`
            border-2 border-dashed border-gray-300 rounded-lg p-6 text-center 
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50'}
            transition-colors
          `}
        >
          <div className="text-4xl mb-2">
            {isMobile ? '📸' : '📁'}
          </div>
          <p className="text-sm text-gray-600">
            {isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload image'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Max 10MB • JPG, PNG, GIF, WEBP
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={isMobile ? 'environment' : undefined}  // 'environment' = back camera
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {/* Change button when preview exists */}
      {preview && !disabled && (
        <button
          type="button"
          onClick={triggerInput}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
        >
          {isMobile ? 'Change photo' : 'Upload different image'}
        </button>
      )}
    </div>
  );
}
