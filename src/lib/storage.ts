import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  url: string;
  source: 'firebase_storage' | 'compressed_fallback';
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return `"${file.name}" is not a supported image file.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" exceeds the 5MB upload limit.`;
  }
  return null;
}

export async function uploadListingImageToStorage(
  userId: string,
  file: File,
): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `listings/${userId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, objectPath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

/**
 * Compresses an image file via canvas to <= 120KB JPEG data URL.
 * Used ONLY when the user explicitly opts into fallback after a Firebase Storage bucket/CORS failure.
 */
export async function compressImageFallback(file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image data.'));
      img.onload = () => {
        const maxDim = 900;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (dataUrl.length > 320000) {
          reject(new Error('Compressed image still exceeds document limit. Please use a smaller image.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
