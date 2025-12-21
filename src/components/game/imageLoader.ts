// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering

// Background color to filter from sprite sheets (red for existing sprites)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Cyan background for AI-generated sprites (unlikely to appear in buildings)
export const AI_BACKGROUND_COLOR = { r: 0, g: 255, b: 255 }; // #00FFFF
export const AI_COLOR_THRESHOLD = 80; // Tighter threshold for AI images

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
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded(); // Notify listeners that a new image is available
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Filters colors close to a background color from an image, making them transparent
 * @param img The source image to process
 * @param bgColor The background color to filter (default: red for sprite sheets)
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(
  img: HTMLImageElement,
  bgColor: { r: number; g: number; b: number } = BACKGROUND_COLOR,
  threshold: number = COLOR_THRESHOLD
): Promise<HTMLImageElement> {
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

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const distance = Math.sqrt(
          Math.pow(r - bgColor.r, 2) +
          Math.pow(g - bgColor.g, 2) +
          Math.pow(b - bgColor.b, 2)
        );

        if (distance <= threshold) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const filteredImg = new Image();
      filteredImg.onload = () => resolve(filteredImg);
      filteredImg.onerror = () => reject(new Error('Failed to create filtered image'));
      filteredImg.src = canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Resize an image maintaining aspect ratio and return as data URL
 * @param img The source image to resize
 * @param maxSize Maximum width or height
 * @returns Data URL of the resized image
 */
export function resizeImageToDataUrl(img: HTMLImageElement, maxSize: number): string {
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  let newWidth = srcWidth;
  let newHeight = srcHeight;

  if (srcWidth > maxSize || srcHeight > maxSize) {
    const scale = Math.min(maxSize / srcWidth, maxSize / srcHeight);
    newWidth = Math.round(srcWidth * scale);
    newHeight = Math.round(srcHeight * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  return canvas.toDataURL('image/png');
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

/**
 * Load and cache a custom building image from a data URL
 * @param id The custom building ID
 * @param dataUrl The image data URL
 * @returns Promise resolving to the loaded image
 */
export function loadCustomBuildingImage(id: string, dataUrl: string): Promise<HTMLImageElement> {
  const cacheKey = `custom_${id}`;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(cacheKey, img);
      notifyImageLoaded();
      resolve(img);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Get a cached custom building image
 * @param id The custom building ID
 */
export function getCustomBuildingImage(id: string): HTMLImageElement | undefined {
  return imageCache.get(`custom_${id}`);
}
