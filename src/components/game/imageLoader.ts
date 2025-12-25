// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

/**
 * Register a callback to be notified when images are loaded
 * @returns Cleanup function to unregister the callback
 */
export function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

/**
 * Notify all registered callbacks that an image has loaded
 */
function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

function getOptimizedImageCandidates(src: string): string[] {
  // Only attempt alternate formats for PNGs served from /public
  if (!/\.png$/i.test(src)) return [src];

  const base = src.replace(/\.png$/i, '');
  // Prefer AVIF then WebP, fall back to PNG.
  return [`${base}.avif`, `${base}.webp`, src];
}

/**
 * Load an image from a source URL
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  
  return new Promise((resolve, reject) => {
    const candidates = getOptimizedImageCandidates(src);

    const tryLoad = (index: number) => {
      const candidate = candidates[index];
      if (!candidate) {
        reject(new Error(`Failed to load image: ${src}`));
        return;
      }

      if (imageCache.has(candidate)) {
        const cached = imageCache.get(candidate)!;
        imageCache.set(src, cached);
        resolve(cached);
        return;
      }

      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        // Cache under both the candidate path and the requested src
        imageCache.set(candidate, img);
        imageCache.set(src, img);
        notifyImageLoaded(); // Notify listeners that a new image is available
        resolve(img);
      };
      img.onerror = () => tryLoad(index + 1);
      img.src = candidate;
    };

    tryLoad(0);
  });
}

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw the original image to the canvas
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Process each pixel
      let filteredCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance using Euclidean distance in RGB space
        const distance = Math.sqrt(
          Math.pow(r - BACKGROUND_COLOR.r, 2) +
          Math.pow(g - BACKGROUND_COLOR.g, 2) +
          Math.pow(b - BACKGROUND_COLOR.b, 2)
        );
        
        // If the color is close to the background color, make it transparent
        if (distance <= threshold) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
          filteredCount++;
        }
      }
      
      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Create a new image from the processed canvas.
      // Prefer a Blob URL (less memory pressure than a base64 data URL).
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Fallback if blob creation fails for some reason.
            const filteredImg = new Image();
            filteredImg.onload = () => resolve(filteredImg);
            filteredImg.onerror = () => reject(new Error('Failed to create filtered image'));
            filteredImg.src = canvas.toDataURL();
            return;
          }

          const objectUrl = URL.createObjectURL(blob);
          const filteredImg = new Image();
          filteredImg.decoding = 'async';
          filteredImg.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(filteredImg);
          };
          filteredImg.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to create filtered image'));
          };
          filteredImg.src = objectUrl;
        },
        // Request WebP where supported; browsers will fall back to PNG if not supported.
        'image/webp',
        0.92
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

/**
 * Check if an image is cached
 * @param src The image source path
 * @param filtered Whether to check for the filtered version
 */
export function isImageCached(src: string, filtered: boolean = false): boolean {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.has(cacheKey);
}

/**
 * Get a cached image if available
 * @param src The image source path
 * @param filtered Whether to get the filtered version
 */
export function getCachedImage(src: string, filtered: boolean = false): HTMLImageElement | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.get(cacheKey);
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
