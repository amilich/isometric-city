// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering
// and WebP optimization for faster loading on slow connections.

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Cache for content bounds analysis (for custom buildings)
export interface ContentBounds {
  // Bounding box of non-transparent content (in pixels)
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  // Content dimensions
  contentWidth: number;
  contentHeight: number;
  // Center of content relative to image center (as ratio of image size)
  // Positive = content is shifted right/down from center
  centerOffsetX: number; // -0.5 to 0.5
  centerOffsetY: number; // -0.5 to 0.5
  // How much of the image is actually content (0 to 1)
  contentRatioX: number;
  contentRatioY: number;
}

const contentBoundsCache = new Map<string, ContentBounds>();

// Track WebP support (detected once on first use)
let webpSupported: boolean | null = null;

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

/**
 * Check if the browser supports WebP format
 * Uses a small test image to detect support
 */
async function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) {
    return webpSupported;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.width > 0 && img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    // Tiny 1x1 WebP image
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
}

/**
 * Get the WebP path for a PNG image
 */
function getWebPPath(src: string): string | null {
  if (src.endsWith('.png')) {
    return src.replace(/\.png$/, '.webp');
  }
  return null;
}

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
 * Load an image directly without WebP optimization
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
function loadImageDirect(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Set crossOrigin for external URLs (like fal.ai CDN) to enable CORS
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded();
      resolve(img);
    };
    img.onerror = (err) => {
      console.warn(`Failed to load image: ${src}`, err);
      reject(err);
    };
    img.src = src;
  });
}

/**
 * Load an image from a source URL, preferring WebP if available
 * @param src The image source path (PNG)
 * @returns Promise resolving to the loaded image
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  // Return cached image if available
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }
  
  // Check if we should try WebP
  const webpPath = getWebPPath(src);
  if (webpPath) {
    const supportsWebP = await checkWebPSupport();
    
    if (supportsWebP) {
      // Try loading WebP first
      try {
        const img = await loadImageDirect(webpPath);
        // Also cache under the PNG path for future lookups
        imageCache.set(src, img);
        return img;
      } catch {
        // WebP failed (file might not exist), fall back to PNG
        console.debug(`WebP not available for ${src}, using PNG`);
      }
    }
  }
  
  // Load PNG directly
  return loadImageDirect(src);
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
      console.log('Starting background color filtering...', { 
        imageSize: `${img.naturalWidth || img.width}x${img.naturalHeight || img.height}`,
        threshold,
        backgroundColor: BACKGROUND_COLOR
      });
      
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
      
      console.log(`Processing ${data.length / 4} pixels...`);
      
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
      
      // Debug: log filtering results
      const totalPixels = data.length / 4;
      const percentage = filteredCount > 0 ? ((filteredCount / totalPixels) * 100).toFixed(2) : '0.00';
      console.log(`Filtered ${filteredCount} pixels (${percentage}%) from sprite sheet`);
      
      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Create a new image from the processed canvas
      const filteredImg = new Image();
      filteredImg.onload = () => {
        console.log('Filtered image created successfully');
        resolve(filteredImg);
      };
      filteredImg.onerror = (error) => {
        console.error('Failed to create filtered image:', error);
        reject(new Error('Failed to create filtered image'));
      };
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
  contentBoundsCache.clear();
}

/**
 * Analyze an image to find the bounding box of non-transparent content.
 * This is used to properly center AI-generated sprites that may not be
 * perfectly centered in their image frame.
 * @param img The image to analyze
 * @returns ContentBounds with positioning information
 */
export function analyzeContentBounds(img: HTMLImageElement): ContentBounds {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  
  // Create a temporary canvas to read pixel data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: assume content fills entire image
    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      contentWidth: width,
      contentHeight: height,
      centerOffsetX: 0,
      centerOffsetY: 0,
      contentRatioX: 1,
      contentRatioY: 1,
    };
  }
  
  ctx.drawImage(img, 0, 0);
  
  // getImageData can throw SecurityError on CORS-tainted canvases
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    // Fallback: assume content fills entire image
    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      contentWidth: width,
      contentHeight: height,
      centerOffsetX: 0,
      centerOffsetY: 0,
      contentRatioX: 1,
      contentRatioY: 1,
    };
  }
  const data = imageData.data;
  
  // Find bounds of non-transparent pixels
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  
  // Alpha threshold - consider pixels with alpha > this as "content"
  const alphaThreshold = 10;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  
  // Handle edge case: no content found
  if (minX > maxX || minY > maxY) {
    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      contentWidth: width,
      contentHeight: height,
      centerOffsetX: 0,
      centerOffsetY: 0,
      contentRatioX: 1,
      contentRatioY: 1,
    };
  }
  
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  
  // Calculate center of content
  const contentCenterX = minX + contentWidth / 2;
  const contentCenterY = minY + contentHeight / 2;
  
  // Calculate offset from image center (as ratio of image size)
  // Positive means content is shifted right/down from where it should be
  const imageCenterX = width / 2;
  const imageCenterY = height / 2;
  
  const centerOffsetX = (contentCenterX - imageCenterX) / width;
  const centerOffsetY = (contentCenterY - imageCenterY) / height;
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    contentWidth,
    contentHeight,
    centerOffsetX,
    centerOffsetY,
    contentRatioX: contentWidth / width,
    contentRatioY: contentHeight / height,
  };
}

/**
 * Get cached content bounds for an image, or analyze if not cached
 * @param src Image source URL
 * @param img The loaded image element
 * @returns ContentBounds for the image
 */
export function getContentBounds(src: string, img: HTMLImageElement): ContentBounds {
  if (contentBoundsCache.has(src)) {
    return contentBoundsCache.get(src)!;
  }
  
  const bounds = analyzeContentBounds(img);
  contentBoundsCache.set(src, bounds);
  return bounds;
}
