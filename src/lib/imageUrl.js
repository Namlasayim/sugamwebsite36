const failedImageWarnings = new Set()

function getConfiguredSupabaseOrigin() {
  try {
    return new URL(import.meta.env?.VITE_SUPABASE_URL).origin
  } catch {
    return null
  }
}

function getTransformedImageUrl(imageUrl, width) {
  if (!imageUrl) return ''

  try {
    const parsedUrl = new URL(imageUrl)
    const configuredOrigin = getConfiguredSupabaseOrigin()
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (!configuredOrigin || parsedUrl.origin !== configuredOrigin || !match) return imageUrl

    const [, bucket, objectPath] = match
    const transformedUrl = new URL(
      `/storage/v1/render/image/public/${bucket}/${objectPath}`,
      parsedUrl.origin,
    )
    transformedUrl.searchParams.set('width', String(width))
    transformedUrl.searchParams.set('height', String(width))
    transformedUrl.searchParams.set('resize', 'cover')
    transformedUrl.searchParams.set('quality', '75')
    return transformedUrl.toString()
  } catch {
    return imageUrl
  }
}

export function paintingHero(id, fallbackUrl) {
  if (!id) return fallbackUrl || ''
  return getTransformedImageUrl(fallbackUrl, 1600)
}

export function paintingThumb(id, fallbackUrl) {
  if (!id) return fallbackUrl || ''
  return getTransformedImageUrl(fallbackUrl, 640)
}

export function handleImageFallback(event, fallbackUrl) {
  const target = event?.currentTarget
  if (!target) return

  const safeLocation = (url) => {
    try {
      const parsedUrl = new URL(url, document.baseURI)
      return `${parsedUrl.origin}${parsedUrl.pathname}`
    } catch {
      return 'invalid image URL'
    }
  }

  const currentUrl = target.currentSrc || target.src
  const fallback = typeof fallbackUrl === 'string' ? fallbackUrl.trim() : ''
  let normalizedFallback = ''
  try {
    if (fallback) normalizedFallback = new URL(fallback, document.baseURI).href
  } catch {
    normalizedFallback = ''
  }

  if (target.dataset.fallbackApplied !== 'true' && normalizedFallback && currentUrl !== normalizedFallback) {
    target.dataset.fallbackApplied = 'true'
    if (import.meta.env?.DEV) {
      const warningKey = `fallback:${safeLocation(currentUrl)}`
      if (!failedImageWarnings.has(warningKey)) {
        failedImageWarnings.add(warningKey)
        console.warn('Painting image transformation failed; loading the original image.', {
          failedImage: safeLocation(currentUrl),
          fallbackImage: safeLocation(fallback),
        })
      }
    }
    target.src = fallback
    return
  }

  target.dataset.fallbackApplied = 'true'
  target.style.visibility = 'hidden'
  if (import.meta.env?.DEV) {
    const failedUrl = fallback || currentUrl
    const warningKey = `missing:${safeLocation(failedUrl)}`
    if (!failedImageWarnings.has(warningKey)) {
      failedImageWarnings.add(warningKey)
      console.warn('Painting image could not be loaded; check that its Storage object exists and the URL is valid.', {
        failedImage: safeLocation(failedUrl),
      })
    }
  }
}
