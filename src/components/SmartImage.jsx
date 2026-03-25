import React, { memo, useEffect, useMemo, useRef, useState } from "react"

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
  const imageRef = useRef(null)
  const [imgSrc, setImgSrc] = useState(resolvedSrc)
  const [hasFailed, setHasFailed] = useState(!resolvedSrc)
  const [isVisible, setIsVisible] = useState(loading === "eager")

  useEffect(() => {
    setImgSrc(resolvedSrc)
    setHasFailed(!resolvedSrc)
    setIsVisible(loading === "eager")
  }, [loading, resolvedSrc])

  useEffect(() => {
    if (loading === "eager") {
      setIsVisible(true)
      return
    }

    const node = imageRef.current
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "240px 0px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [imgSrc, loading])

  if (hasFailed) return fallback

  return (
    <img
      {...rest}
      ref={imageRef}
      src={isVisible ? imgSrc : undefined}
      alt={alt}
      className={className}
      style={loading === "eager" ? style : { contentVisibility: "auto", ...style }}
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
