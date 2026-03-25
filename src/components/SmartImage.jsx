import React, { memo, useEffect, useMemo, useState } from "react"

function buildImageSrc(src, apiBase, cacheKey) {
  if (!src || typeof src !== "string") return ""

  let nextSrc = src.trim()
  if (!nextSrc) return ""

  if (apiBase && nextSrc.startsWith("/") && !nextSrc.startsWith("//")) {
    nextSrc = `${apiBase}${nextSrc}`
  }

  if (
    cacheKey &&
    !nextSrc.startsWith("data:") &&
    !nextSrc.startsWith("blob:") &&
    !/[?&]v=/.test(nextSrc)
  ) {
    const separator = nextSrc.includes("?") ? "&" : "?"
    nextSrc = `${nextSrc}${separator}v=${encodeURIComponent(String(cacheKey))}`
  }

  return nextSrc
}

function SmartImageComponent({
  src,
  alt,
  apiBase,
  cacheKey,
  fallback = null,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  className,
  style,
  onResolveError,
  onError,
  ...rest
}) {
  const resolvedSrc = useMemo(
    () => buildImageSrc(src, apiBase, cacheKey),
    [apiBase, cacheKey, src]
  )
  const [imgSrc, setImgSrc] = useState(resolvedSrc)
  const [hasFailed, setHasFailed] = useState(!resolvedSrc)

  useEffect(() => {
    setImgSrc(resolvedSrc)
    setHasFailed(!resolvedSrc)
  }, [resolvedSrc])

  if (hasFailed) return fallback

  return (
    <img
      {...rest}
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onError={async event => {
        const nextSrc = onResolveError ? await onResolveError(event) : ""
        if (nextSrc && nextSrc !== imgSrc) {
          setImgSrc(nextSrc)
          return
        }

        setHasFailed(true)
        onError?.(event)
      }}
    />
  )
}

const SmartImage = memo(SmartImageComponent)

export default SmartImage
