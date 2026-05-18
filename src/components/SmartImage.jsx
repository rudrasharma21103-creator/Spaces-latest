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
  showFallbackWhileLoading = false,
  className,
  style,
  onResolveError,
  onLoad,
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
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(loading === "eager")

  useEffect(() => {
    setImgSrc(resolvedSrc)
    setHasFailed(!resolvedSrc)
    setHasLoaded(false)
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

  useEffect(() => {
    if (!isVisible || hasFailed || hasLoaded) return

    const node = imageRef.current
    if (!node) return

    if (node.complete && node.naturalWidth > 0) {
      setHasFailed(false)
      setHasLoaded(true)
    }
  }, [hasFailed, hasLoaded, imgSrc, isVisible])

  if (hasFailed) return fallback

  const image = (
    <img
      {...rest}
      ref={imageRef}
      src={isVisible ? imgSrc : undefined}
      alt={alt}
      className={className}
      style={
        showFallbackWhileLoading
          ? { ...style, opacity: hasLoaded ? 1 : 0, transition: "opacity 120ms ease" }
          : loading === "eager" ? style : { contentVisibility: "auto", ...style }
      }
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onLoad={event => {
        setHasFailed(false)
        setHasLoaded(true)
        onLoad?.(event)
      }}
      onError={async event => {
        if (hasLoaded) {
          return
        }

        const nextSrc = onResolveError ? await onResolveError(event) : ""
        if (nextSrc && nextSrc !== imgSrc) {
          setHasLoaded(false)
          setImgSrc(nextSrc)
          return
        }

        setHasFailed(true)
        onError?.(event)
      }}
    />
  )

  if (!showFallbackWhileLoading || !fallback) return image

  return (
    <span className={className} style={{ ...style, display: "inline-block", position: "relative", overflow: "hidden" }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          opacity: hasLoaded ? 0 : 1,
          transition: "opacity 120ms ease",
        }}
      >
        {fallback}
      </span>
      {React.cloneElement(image, {
        className,
        style: {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: hasLoaded ? 1 : 0,
          transition: "opacity 120ms ease",
        },
      })}
    </span>
  )
}

const SmartImage = memo(SmartImageComponent)

export default SmartImage
