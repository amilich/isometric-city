// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Toggle verbose console logging for image processing
const DEBUG_IMAGE_LOADING = false;

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
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (DEBUG_IMAGE_LOADING) {
        // eslint-disable-next-line no-console
        console.debug('[imageLoader] Filtering background color', { width, height, threshold, background: BACKGROUND_COLOR });
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      // `willReadFrequently` helps browsers optimize for getImageData-heavy usage
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Compare squared distances to avoid expensive sqrt/pow in a tight loop
      const thresholdSq = threshold * threshold;
      const br = BACKGROUND_COLOR.r;
      const bg = BACKGROUND_COLOR.g;
      const bb = BACKGROUND_COLOR.b;

      for (let i = 0; i < data.length; i += 4) {
        // Skip already transparent pixels
        if (data[i + 3] === 0) continue;

        const dr = data[i] - br;
        const dg = data[i + 1] - bg;
        const db = data[i + 2] - bb;

        if (dr * dr + dg * dg + db * db <= thresholdSq) {
          data[i + 3] = 0; // alpha -> transparent
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
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  return loadImage(src).then((img) => {
    if (!applyFilter) return img;

    return filterBackgroundColor(img)
      .then((filteredImg) => {
        imageCache.set(cacheKey, filteredImg);
        notifyImageLoaded(); // Notify listeners that the filtered version is ready
        return filteredImg;
      })
      .catch((error) => {
        // If filtering fails for any reason, fall back to the unfiltered sprite sheet
        // eslint-disable-next-line no-console
        console.error('[imageLoader] Failed to filter sprite sheet background:', error);
        imageCache.set(cacheKey, img);
        notifyImageLoaded();
        return img;
      });
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
