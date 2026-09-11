/**
 * Client-side image downsampling and optimization utility.
 *
 * Essential for low-end Android devices (Android Go / 2GB RAM):
 * Modern phone cameras capture 12MP–50MP images (8MB–20MB), which if read
 * raw into memory as Base64 strings or uncompressed bitmaps will exhaust the
 * WebView heap (~192MB) and cause instant OOM crashes.
 *
 * This utility downscales images to reasonable display/upload dimensions
 * (default max 1280x1280) and compresses to ~150KB–250KB before placing
 * in state or uploading to Supabase Storage.
 */

/**
 * Downscale and compress an image file.
 *
 * @param {File|Blob} file The input file from file input or camera.
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1280] Maximum width in pixels.
 * @param {number} [options.maxHeight=1280] Maximum height in pixels.
 * @param {number} [options.quality=0.82] JPEG compression quality (0 to 1).
 * @param {string} [options.mimeType='image/jpeg'] Target MIME type.
 * @returns {Promise<{ file: File|Blob, dataUrl: string, width: number, height: number }>}
 */
export async function downscaleImage(file, {
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82,
  mimeType = 'image/jpeg',
} = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    // Non-image or empty: pass through safely
    return { file, dataUrl: null, width: 0, height: 0 }
  }

  // SVGs don't need raster downscaling
  if (file.type === 'image/svg+xml') {
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(file)
    })
    return { file, dataUrl, width: 0, height: 0 }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img

      // Check if downscaling is actually needed
      if (width <= maxWidth && height <= maxHeight && file.size < 350 * 1024) {
        // Small enough already — generate a lightweight dataUrl or use objectUrl
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve({ file, dataUrl: e.target.result, width, height })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
        return
      }

      // Calculate proportional dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve({ file, dataUrl: null, width: img.width, height: img.height })
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL(mimeType, quality)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ file, dataUrl, width, height })
            return
          }

          // Retain original name with updated extension if converted to JPEG
          const originalName = file.name || 'photo.jpg'
          const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
          const ext = mimeType === 'image/webp' ? '.webp' : '.jpg'
          const optimizedFile = new File([blob], `${baseName}${ext}`, {
            type: mimeType,
            lastModified: Date.now(),
          })

          resolve({
            file: optimizedFile,
            dataUrl,
            width,
            height,
          })
        },
        mimeType,
        quality
      )
    }

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl)
      console.warn('Image downscaling failed, falling back to original:', err)
      resolve({ file, dataUrl: null, width: 0, height: 0 })
    }

    img.src = objectUrl
  })
}
