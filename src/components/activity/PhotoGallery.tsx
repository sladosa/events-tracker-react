/**
 * PhotoGallery Component
 * 
 * Handles multiple photo uploads with:
 * - Image compression before storage
 * - 5MB total limit per event
 * - Thumbnail preview with remove option
 * - Mobile camera support
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';
import type { PendingPhoto, ExistingPhoto } from '@/types/activity';
import {
  MAX_PHOTOS_SIZE_BYTES,
  MAX_PHOTO_DIMENSION,
  JPEG_QUALITY,
  messages,
} from '@/types/activity';

// ============================================
// Image Compression
// ============================================

async function compressImage(file: File): Promise<{ base64: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height && width > MAX_PHOTO_DIMENSION) {
        height = (height * MAX_PHOTO_DIMENSION) / width;
        width = MAX_PHOTO_DIMENSION;
      } else if (height > MAX_PHOTO_DIMENSION) {
        width = (width * MAX_PHOTO_DIMENSION) / height;
        height = MAX_PHOTO_DIMENSION;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed JPEG
      const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      
      // Calculate approximate size (base64 is ~33% larger than binary)
      const base64Data = base64.split(',')[1];
      const sizeBytes = Math.ceil(base64Data.length * 0.75);
      
      // Cleanup
      URL.revokeObjectURL(img.src);
      
      resolve({ base64, sizeBytes });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

function calculateTotalSize(photos: PendingPhoto[]): number {
  return photos.reduce((total, photo) => total + photo.sizeBytes, 0);
}

function generatePhotoId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Component Props
// ============================================

interface PhotoGalleryProps {
  /** New photos (base64, not yet uploaded) */
  photos: PendingPhoto[];
  /** Existing photos from database (Edit mode) */
  existingPhotos?: ExistingPhoto[];
  /** Callback when photos change */
  onPhotosChange: (photos: PendingPhoto[]) => void;
  /** Callback to mark existing photo for deletion */
  onExistingPhotoRemove?: (photoId: string) => void;
  /** IDs of existing photos marked for deletion */
  photosToDelete?: string[];
  /** Disabled state */
  disabled?: boolean;
  /** Show compact version */
  compact?: boolean;
}

export function PhotoGallery({
  photos,
  existingPhotos = [],
  onPhotosChange,
  onExistingPhotoRemove,
  photosToDelete = [],
  disabled = false,
  compact = false,
}: PhotoGalleryProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Calculate current usage
  const currentSize = calculateTotalSize(photos);
  const remainingSize = MAX_PHOTOS_SIZE_BYTES - currentSize;
  const isAtLimit = remainingSize < 50000; // Less than ~50KB remaining
  
  // Filter out deleted existing photos for display
  const visibleExistingPhotos = existingPhotos.filter(
    photo => !photosToDelete.includes(photo.id)
  );
  
  const totalPhotoCount = photos.length + visibleExistingPhotos.length;
  
  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setError(null);
    setIsProcessing(true);
    
    try {
      const newPhotos: PendingPhoto[] = [...photos];
      let currentTotal = calculateTotalSize(newPhotos);
      
      for (const file of Array.from(files)) {
        // Check if it's an image
        if (!file.type.startsWith('image/')) {
          continue;
        }
        
        // Compress the image
        const { base64, sizeBytes } = await compressImage(file);
        
        // Check if adding this would exceed limit
        if (currentTotal + sizeBytes > MAX_PHOTOS_SIZE_BYTES) {
          setError(messages.errorPhotoLimit);
          break;
        }
        
        newPhotos.push({
          id: generatePhotoId(),
          base64,
          filename: file.name,
          sizeBytes,
        });
        
        currentTotal += sizeBytes;
      }
      
      onPhotosChange(newPhotos);
    } catch (err) {
      console.error('Failed to process photo:', err);
      setError(messages.errorPhotoProcess);
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [photos, onPhotosChange]);
  
  // Handle photo removal
  const handleRemovePhoto = useCallback((photoId: string) => {
    const newPhotos = photos.filter(p => p.id !== photoId);
    onPhotosChange(newPhotos);
    setError(null);
  }, [photos, onPhotosChange]);
  
  // Handle existing photo removal
  const handleRemoveExistingPhoto = useCallback((photoId: string) => {
    onExistingPhotoRemove?.(photoId);
  }, [onExistingPhotoRemove]);
  
  // Trigger file input
  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          📷 {messages.photos}
          {totalPhotoCount > 0 && (
            <span className="text-gray-400 font-normal ml-1">
              ({totalPhotoCount})
            </span>
          )}
        </label>
        
        {/* Size indicator */}
        {photos.length > 0 && (
          <span className={cn(
            "text-xs",
            isAtLimit ? "text-rose-500" : "text-gray-400"
          )}>
            {(currentSize / 1024 / 1024).toFixed(1)} / 5 MB
          </span>
        )}
      </div>
      
      {/* Photo grid */}
      <div className={cn(
        "flex flex-wrap gap-2",
        compact ? "gap-1" : "gap-2"
      )}>
        {/* Existing photos (Edit mode) */}
        {visibleExistingPhotos.map(photo => (
          <PhotoThumbnail
            key={`existing-${photo.id}`}
            src={photo.url}
            filename={photo.filename}
            onRemove={
              onExistingPhotoRemove 
                ? () => handleRemoveExistingPhoto(photo.id) 
                : undefined
            }
            disabled={disabled}
            compact={compact}
          />
        ))}
        
        {/* New photos */}
        {photos.map(photo => (
          <PhotoThumbnail
            key={photo.id}
            src={photo.base64}
            filename={photo.filename}
            onRemove={() => handleRemovePhoto(photo.id)}
            disabled={disabled}
            compact={compact}
            isNew
          />
        ))}
        
        {/* Add button */}
        <button
          type="button"
          onClick={handleAddClick}
          disabled={disabled || isAtLimit || isProcessing}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed",
            "transition-colors",
            compact ? "w-16 h-16" : "w-20 h-20",
            disabled || isAtLimit
              ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
              : "border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50"
          )}
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-500" />
          ) : (
            <>
              <span className={cn("font-bold", compact ? "text-lg" : "text-xl")}>+</span>
              <span className={cn("text-center leading-tight", compact ? "text-[10px]" : "text-xs")}>
                {compact ? 'Add' : 'Add Photo'}
              </span>
            </>
          )}
        </button>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isAtLimit}
        />
      </div>
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-rose-600 flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </p>
      )}
      
      {/* Limit reached message */}
      {isAtLimit && !error && (
        <p className="text-sm text-amber-600 flex items-center gap-1">
          <span>📷</span>
          {messages.photoLimitReached}
        </p>
      )}
    </div>
  );
}

// ============================================
// Photo Thumbnail Component
// ============================================

interface PhotoThumbnailProps {
  src: string;
  filename?: string;
  onRemove?: () => void;
  disabled?: boolean;
  compact?: boolean;
  isNew?: boolean;
}

function PhotoThumbnail({
  src,
  filename,
  onRemove,
  disabled = false,
  compact = false,
  isNew = false,
}: PhotoThumbnailProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const handleRemoveClick = () => {
    if (showConfirm) {
      onRemove?.();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };
  
  const handleCancelRemove = () => {
    setShowConfirm(false);
  };
  
  return (
    <div 
      className={cn(
        "relative rounded-lg overflow-hidden bg-gray-100 group",
        compact ? "w-16 h-16" : "w-20 h-20"
      )}
    >
      {/* Image */}
      <img
        src={src}
        alt={filename || 'Photo'}
        className="w-full h-full object-cover"
      />
      
      {/* New badge */}
      {isNew && (
        <div className="absolute top-0.5 left-0.5 bg-green-500 text-white text-[8px] px-1 rounded">
          NEW
        </div>
      )}
      
      {/* Remove button */}
      {onRemove && !disabled && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          "bg-black/0 group-hover:bg-black/40 transition-colors",
          showConfirm && "bg-black/50"
        )}>
          {showConfirm ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleRemoveClick}
                className="p-1 bg-rose-500 text-white rounded text-xs hover:bg-rose-600"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={handleCancelRemove}
                className="p-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRemoveClick}
              className={cn(
                "p-1.5 bg-black/60 text-white rounded-full",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-rose-500"
              )}
              title="Remove photo"
            >
              <svg 
                className={cn(compact ? "w-3 h-3" : "w-4 h-4")} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Simple Photo Upload (single photo, legacy)
// ============================================

interface SimplePhotoUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function SimplePhotoUpload({
  value,
  onChange,
  disabled = false,
}: SimplePhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // Generate preview when value changes (from parent)
  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
    }
  }, [value]);
  
  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange(file);
  }, [onChange]);
  
  const handleRemove = useCallback(() => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onChange]);
  
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        📷 Photo
        <span className="text-gray-400 font-normal ml-2 text-xs">optional</span>
      </label>
      
      {preview ? (
        <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-rose-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed",
            "transition-colors",
            disabled
              ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
              : "border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50"
          )}
        >
          <span>📷</span>
          <span>Add Photo</span>
        </button>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
