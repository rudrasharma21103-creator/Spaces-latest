import React from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  Check,
  Clock3,
  ChevronDown,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  FolderOpen,
  MessageSquare,
  MoreVertical,
  Plus,
  Play,
  Presentation,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { CHANNEL_TABS, CONTEXT_STATUS_META } from "./LivingContext.helpers"
import SmartImage from "./SmartImage"

const cx = (...classes) => classes.filter(Boolean).join(" ")

function getFileKind(file) {
  const mime = (file?.mimeType || "").toLowerCase()
  const name = (file?.name || "").toLowerCase()

  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv") || name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) return "sheet"
  if (mime.includes("presentation") || mime.includes("powerpoint") || name.endsWith(".ppt") || name.endsWith(".pptx")) return "slides"
  if (mime.includes("document") || mime.includes("word") || mime.includes("text") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt")) return "doc"
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("7z") || name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z")) return "archive"

  return "file"
}

function formatFileSize(size) {
  if (!size) return ""
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(size / 1024, 0.1).toFixed(1)} KB`
}

function formatFileDate(timestamp) {
  if (!timestamp) return ""

  try {
    return new Date(timestamp).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    })
  } catch {
    return ""
  }
}

function normalizeFileSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function getFileSearchText(file) {
  const extension = String(file?.name || "").split(".").pop()

  return normalizeFileSearchValue([
    file?.name,
    extension,
    file?.author,
    file?.messageLabel,
    file?.sourceLabel,
    file?.mimeType,
    formatFileDate(file?.timestamp),
    formatFileSize(file?.size),
  ].filter(Boolean).join(" "))
}

function clampValue(value, min, max) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function GlassMenuSurface({ children, isDarkMode, position, menuRef, onClick }) {
  const backgroundColor = isDarkMode ? "#08090b" : "#ffffff"
  const borderColor = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(203, 213, 225, 0.9)"
  const textColor = isDarkMode ? "#f8fafc" : "#0f172a"
  const insetHighlight = isDarkMode
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08)"
    : "inset 0 1px 0 rgba(255, 255, 255, 0.9)"

  return (
    <div
      ref={menuRef}
      onClick={onClick}
      className={`message-actions-solid-menu fixed isolate w-[260px] overflow-hidden rounded-[22px] border transition-[opacity,transform] duration-150 ${
        position.ready ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 3,
        isolation: "isolate",
        pointerEvents: "auto",
        opacity: 1,
        background: backgroundColor,
        backgroundColor,
        backgroundImage: "none",
        borderColor,
        color: textColor,
        mixBlendMode: "normal",
        boxShadow: isDarkMode
          ? `${insetHighlight}, 0 24px 70px rgba(0, 0, 0, 0.62), 0 6px 18px rgba(0, 0, 0, 0.45)`
          : `${insetHighlight}, 0 24px 70px rgba(15, 23, 42, 0.18), 0 6px 18px rgba(15, 23, 42, 0.1)`,
        transformOrigin: `${position.openUpward ? "bottom" : "top"} ${position.align === "left" ? "left" : "right"}`,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-[22px]"
        style={{
          background: backgroundColor,
          backgroundColor,
          opacity: 1,
        }}
      />
      <div
        className="relative z-10 p-2"
        style={{
          backgroundColor,
          color: textColor,
          maxHeight: "min(420px, calc(100vh - 7rem))",
          overflowY: "auto",
          scrollbarGutter: "stable",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function getNameInitials(name) {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("")

  return initials || "?"
}

function getMessagePreview(message) {
  const text = String(message?.text || "").trim()
  return text || "No written message was included with this update."
}

function getPreviewConfig(kind, isDarkMode) {
  if (isDarkMode) {
    switch (kind) {
      case "pdf":
        return { badge: "PDF", icon: FileText, accent: "bg-rose-500 text-white", panel: "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950", display: "text-rose-200" }
      case "sheet":
        return { badge: "XLS", icon: FileSpreadsheet, accent: "bg-emerald-500 text-white", panel: "bg-gradient-to-br from-slate-800 via-emerald-950/80 to-slate-950", display: "text-emerald-200" }
      case "slides":
        return { badge: "PPT", icon: Presentation, accent: "bg-amber-500 text-white", panel: "bg-gradient-to-br from-slate-800 via-amber-950/70 to-slate-950", display: "text-amber-200" }
      case "doc":
        return { badge: "DOC", icon: FileText, accent: "bg-blue-500 text-white", panel: "bg-gradient-to-br from-slate-800 via-blue-950/70 to-slate-950", display: "text-blue-200" }
      case "video":
        return { badge: "MP4", icon: Film, accent: "bg-cyan-500 text-white", panel: "bg-gradient-to-br from-slate-900 via-cyan-950/60 to-slate-950", display: "text-cyan-200" }
      case "archive":
        return { badge: "ZIP", icon: FileArchive, accent: "bg-slate-500 text-white", panel: "bg-gradient-to-br from-slate-800 via-slate-900 to-black", display: "text-slate-200" }
      default:
        return { badge: "FILE", icon: File, accent: "bg-slate-600 text-white", panel: "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950", display: "text-slate-100" }
    }
  }

  switch (kind) {
    case "pdf":
      return { badge: "PDF", icon: FileText, accent: "bg-rose-500 text-white", panel: "bg-gradient-to-br from-white via-rose-50 to-slate-100", display: "text-slate-950" }
    case "sheet":
      return { badge: "XLS", icon: FileSpreadsheet, accent: "bg-emerald-500 text-white", panel: "bg-gradient-to-br from-white via-emerald-50 to-slate-100", display: "text-slate-950" }
    case "slides":
      return { badge: "PPT", icon: Presentation, accent: "bg-amber-500 text-white", panel: "bg-gradient-to-br from-white via-amber-50 to-slate-100", display: "text-slate-950" }
    case "doc":
      return { badge: "DOC", icon: FileText, accent: "bg-blue-500 text-white", panel: "bg-gradient-to-br from-white via-blue-50 to-slate-100", display: "text-slate-950" }
    case "video":
      return { badge: "MP4", icon: Film, accent: "bg-cyan-500 text-white", panel: "bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500", display: "text-white" }
    case "archive":
      return { badge: "ZIP", icon: FileArchive, accent: "bg-slate-500 text-white", panel: "bg-gradient-to-br from-white via-slate-100 to-slate-200", display: "text-slate-900" }
    default:
      return { badge: "FILE", icon: File, accent: "bg-slate-600 text-white", panel: "bg-gradient-to-br from-white via-slate-50 to-slate-100", display: "text-slate-950" }
  }
}

function FilePreview({ file, isDarkMode, variant = "card" }) {
  const kind = getFileKind(file)
  const config = getPreviewConfig(kind, isDarkMode)
  const PreviewIcon = config.icon
  const fileTitle = file?.name || "Untitled file"
  const isThumb = variant === "thumb"

  if (kind === "image" && file?.url) {
    return (
      <div className={`relative shrink-0 overflow-hidden border ${isThumb ? "h-14 w-14 rounded-xl" : "h-28 w-full rounded-[1.1rem] sm:h-40 sm:rounded-[1.25rem]"} ${isDarkMode ? "border-slate-700/70 bg-slate-900" : "border-slate-200 bg-white/80"}`}>
        <SmartImage src={file.url} alt={fileTitle} className="h-full w-full object-cover" />
        {!isThumb && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent sm:h-20" />}
      </div>
    )
  }

  if (isThumb) {
    return (
      <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${isDarkMode ? `border-slate-700/70 ${config.panel}` : "border-slate-200 bg-white"}`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.accent}`}>
          <PreviewIcon className="h-4 w-4" />
        </div>
      </div>
    )
  }

  return (
    <div className={`relative h-28 overflow-hidden rounded-[1.1rem] border p-3 sm:h-40 sm:rounded-[1.25rem] sm:p-4 ${isDarkMode ? `border-slate-700/70 ${config.panel}` : "border-slate-200 bg-white"}`}>
      <div className="absolute inset-0 opacity-60">
        <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full ${isDarkMode ? "bg-white/5" : "bg-slate-100"}`} />
        <div className={`absolute -left-4 bottom-4 h-16 w-16 rounded-full ${isDarkMode ? "bg-white/5" : "bg-slate-100/90"}`} />
      </div>
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <div className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold tracking-[0.16em] sm:gap-1.5 sm:text-[10px] sm:tracking-[0.18em] ${config.accent}`}>
            <PreviewIcon className="h-3.5 w-3.5" />
            {config.badge}
          </div>
          {kind === "video" && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm sm:h-10 sm:w-10">
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className={`line-clamp-2 break-words text-[1.05rem] font-black leading-tight tracking-tight sm:text-[1.55rem] sm:leading-none ${config.display}`}>
            {fileTitle}
          </div>
          <div className={`mt-1 truncate text-xs font-medium sm:mt-2 sm:text-sm ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
            {file.sourceLabel}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChannelTabs({ activeTab, isDarkMode, onChange, tabs = CHANNEL_TABS }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef(null)
  const activeLabel = String(activeTab || tabs[0] || "messages")

  React.useEffect(() => {
    if (!menuOpen) return undefined

    const handlePointerDown = event => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const handleKeyDown = event => {
      if (event.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [menuOpen])

  const handleSelect = tab => {
    onChange(tab)
    setMenuOpen(false)
  }

  return (
    <div className="workspace-channel-tabs mx-4 mb-0.5 px-0 sm:mx-6">
      <div ref={menuRef} className="workspace-channel-tabs-menu relative inline-flex">
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          className={`workspace-channel-tabs-trigger inline-flex h-9 min-w-[132px] items-center justify-between gap-3 rounded-xl border px-3.5 text-sm font-semibold capitalize shadow-sm transition-colors ${
            isDarkMode
              ? "border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          }`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span>{activeLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div
            className={`workspace-channel-tabs-dropdown absolute left-0 top-full z-50 mt-2 w-44 rounded-xl border p-1.5 shadow-xl ${
              isDarkMode ? "border-white/10 bg-[#0d1218] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
            role="menu"
          >
            {tabs.map(tab => {
              const active = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleSelect(tab)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold capitalize transition-colors ${
                    active
                      ? isDarkMode
                        ? "bg-white/[0.08] text-white"
                        : "bg-slate-100 text-slate-950"
                      : isDarkMode
                        ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  role="menuitem"
                >
                  <span>{tab}</span>
                  {active && <Check className="h-4 w-4" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function MessageActionsMenu({
  anchorEl,
  boundaryEl,
  preferredAlign = "right",
  isDarkMode,
  isSelected = false,
  emojis = [],
  onClose,
  onReact,
  onEdit,
  onDelete,
  onToggleSelection,
  onCreateContext,
  onAddToContext,
  onMarkDecision,
  onCreateTask,
}) {
  const menuRef = React.useRef(null)
  const [position, setPosition] = React.useState({
    left: 0,
    top: 0,
    width: 260,
    height: 0,
    ready: false,
    openUpward: false,
    align: preferredAlign,
  })

  const computePosition = React.useCallback(() => {
    if (!anchorEl || !menuRef.current) return
    if (!anchorEl.isConnected) {
      onClose?.()
      return
    }

    const anchorRect = anchorEl.getBoundingClientRect()
    const menuRect = menuRef.current.getBoundingClientRect()
    const boundaryRect = boundaryEl?.getBoundingClientRect?.() || {
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    }
    const viewportPadding = 12
    const boundaryPadding = 10
    const gap = 8

    const minLeft = Math.max(viewportPadding, boundaryRect.left + boundaryPadding)
    const maxRight = Math.min(window.innerWidth - viewportPadding, boundaryRect.right - boundaryPadding)
    const minTop = Math.max(viewportPadding, boundaryRect.top + boundaryPadding)
    const maxBottom = Math.min(window.innerHeight - viewportPadding, boundaryRect.bottom - boundaryPadding)

    const menuWidth = Math.max(menuRect.width || 260, 260)
    const preferredLeft =
      preferredAlign === "left"
        ? maxRight - menuWidth
        : anchorRect.right - menuWidth

    let left = clampValue(
      preferredLeft,
      minLeft,
      Math.max(minLeft, maxRight - menuWidth)
    )

    left = clampValue(
      left,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - viewportPadding - menuWidth)
    )

    let openUpward = false
    let top = anchorRect.bottom + gap

    if (top + menuRect.height > maxBottom) {
      top = anchorRect.top - menuRect.height - gap
      openUpward = true
    }

    if (top < minTop) {
      const downTop = clampValue(
        anchorRect.bottom + gap,
        minTop,
        Math.max(minTop, maxBottom - menuRect.height)
      )
      const upTop = clampValue(
        anchorRect.top - menuRect.height - gap,
        minTop,
        Math.max(minTop, maxBottom - menuRect.height)
      )
      const spaceBelow = maxBottom - anchorRect.bottom
      const spaceAbove = anchorRect.top - minTop
      top = spaceBelow >= spaceAbove ? downTop : upTop
      openUpward = spaceBelow < spaceAbove
    }

    const resolvedAlign =
      left <= minLeft + 4 ? "left" : left + menuRect.width >= maxRight - 4 ? "right" : preferredAlign

    setPosition({
      left,
      top,
      width: menuWidth,
      height: menuRect.height,
      ready: true,
      openUpward,
      align: resolvedAlign,
    })
  }, [anchorEl, boundaryEl, onClose, preferredAlign])

  React.useLayoutEffect(() => {
    computePosition()
  }, [
    computePosition,
    emojis.length,
    isSelected,
    onEdit,
    onDelete,
    onToggleSelection,
    onCreateContext,
    onAddToContext,
    onMarkDecision,
    onCreateTask,
  ])

  React.useEffect(() => {
    if (!anchorEl) return undefined

    let frame = null
    const updatePosition = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        computePosition()
      })
    }

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [anchorEl, computePosition])

  if (!anchorEl) return null

  const reactionButtonClass = `flex h-8 w-8 items-center justify-center rounded-full text-base transition-all duration-150 ${
    isDarkMode
      ? "bg-transparent text-slate-100 hover:bg-white/10 hover:scale-[1.06]"
      : "bg-transparent text-slate-700 hover:bg-slate-100 hover:scale-[1.06]"
  }`

  const actionBaseClass = `group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium whitespace-nowrap transition-all duration-150`
  const actionClass = `${actionBaseClass} ${
    isDarkMode
      ? "text-slate-100 hover:bg-white/10 hover:text-white"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
  }`
  const destructiveClass = `${actionBaseClass} ${
    isDarkMode
      ? "text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
      : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
  }`

  const primaryActions = [
    onEdit ? { key: "edit", label: "Edit message", icon: FileText, onClick: onEdit } : null,
    onToggleSelection
      ? {
          key: "select",
          label: isSelected ? "Deselect message" : "Select message",
          icon: Check,
          onClick: onToggleSelection,
        }
      : null,
    onCreateContext ? { key: "create-context", label: "Create context", icon: Sparkles, onClick: onCreateContext } : null,
    onAddToContext ? { key: "add-context", label: "Add to context", icon: FolderOpen, onClick: onAddToContext } : null,
    onMarkDecision ? { key: "decision", label: "Mark as decision", icon: Check, onClick: onMarkDecision } : null,
    onCreateTask ? { key: "task", label: "Create task", icon: Plus, onClick: onCreateTask } : null,
  ].filter(Boolean)

  const menuNode = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
        isolation: "isolate",
      }}
    >
      <GlassMenuSurface
        menuRef={menuRef}
        isDarkMode={isDarkMode}
        position={position}
        onClick={event => event.stopPropagation()}
      >
        {emojis.length > 0 && (
          <div
            className={`mb-1.5 rounded-[18px] border px-2 py-1.5 ${
              isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1">
              {emojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReact?.(emoji)}
                  className={reactionButtonClass}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          {primaryActions.map(action => {
            const ActionIcon = action.icon
            return (
              <button key={action.key} onClick={action.onClick} className={actionClass}>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isDarkMode
                      ? "bg-white/[0.08] text-slate-300 group-hover:bg-white/[0.12]"
                      : "bg-slate-100 text-slate-500 group-hover:bg-white"
                  }`}
                >
                  <ActionIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
              </button>
            )
          })}
        </div>

        {onDelete && (
          <>
            <div className={`my-1.5 h-px ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />
            <button onClick={onDelete} className={destructiveClass}>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-rose-500/15 text-rose-300 group-hover:bg-rose-500/20"
                    : "bg-rose-50 text-rose-500 group-hover:bg-white"
                }`}
              >
                <Trash2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">Delete message</span>
            </button>
          </>
        )}
      </GlassMenuSurface>
    </div>
  )

  return createPortal(menuNode, document.body)
}

export function ContextBadge({ contexts = [], isDarkMode, onOpen }) {
  if (!contexts.length) return null
  const label = contexts.length === 1 ? `In ${contexts[0].title}` : `In ${contexts[0].title} +${contexts.length - 1}`

  return (
    <button
      onClick={onOpen}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
        isDarkMode ? "bg-sky-500/10 text-sky-300 hover:bg-sky-500/20" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
      }`}
    >
      {label}
    </button>
  )
}

export function ContextsTabView({
  contexts,
  isDarkMode,
  onOpen,
  onDelete,
  canDelete,
  renderOwner,
  formatUpdatedTime,
}) {
  if (!contexts.length) {
    return (
      <div className={`mx-4 rounded-[1.75rem] border p-8 text-center sm:mx-6 ${isDarkMode ? "border-slate-800 bg-[#16181c] text-slate-400" : "border-slate-200/80 bg-white text-slate-500 shadow-[0_18px_45px_rgba(15,23,42,0.04)]"}`}>
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl ${isDarkMode ? "bg-slate-800 text-sky-300" : "bg-slate-100 text-slate-600"}`}>
          <FolderOpen className="w-8 h-8" />
        </div>
        <div className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>No living context yet</div>
        <p className="text-sm mt-2">Create one from key messages and keep the channel memory close to the chat.</p>
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-6">
      <div className="max-w-[440px] space-y-4">
        {contexts.map(context => {
          const statusMeta = CONTEXT_STATUS_META[context.status] || CONTEXT_STATUS_META.active
          const showDelete = typeof canDelete === "function" ? canDelete(context) : false
          return (
            <article
              key={context.id}
              onClick={() => onOpen(context.id)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onOpen(context.id)
                }
              }}
              role="button"
              tabIndex={0}
              className={`text-left transition-all hover:-translate-y-0.5 ${
                isDarkMode
                  ? "rounded-[1.5rem] border border-slate-800 bg-[#16181c] p-4 hover:border-slate-700"
                  : "rounded-[1.7rem] border border-slate-200/90 bg-white/95 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.04)] hover:border-slate-300/90"
              }`}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`truncate text-[1.05rem] font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{context.title}</div>
                  {!isDarkMode && context.summary ? (
                    <div className="mt-1 line-clamp-1 text-sm text-slate-400">{context.summary}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>
                    {statusMeta.label}
                  </span>
                  {showDelete && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        onDelete?.(context.id)
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                        isDarkMode
                          ? "text-rose-300 hover:bg-rose-500/12 hover:text-rose-200"
                          : "text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                      }`}
                      aria-label={`Delete ${context.title}`}
                      title="Delete context permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className={`mb-5 grid grid-cols-2 gap-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <div className={`rounded-xl px-3 py-2 ${isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]"}`}>Messages {context.linkedMessageIds.length}</div>
                <div className={`rounded-xl px-3 py-2 ${isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]"}`}>Files {context.linkedFileIds.length}</div>
                <div className={`rounded-xl px-3 py-2 ${isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]"}`}>Contributors {context.contributorIds.length}</div>
                <div className={`rounded-xl px-3 py-2 ${isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]"}`}>Tasks {context.taskIds.length}</div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>Owner {renderOwner(context.ownerId)}</span>
                <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>{formatUpdatedTime(context.updatedAt)}</span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export function CreateContextModal({
  isDarkMode,
  owners = [],
  value,
  isEditing = false,
  onChange,
  onClose,
  onSubmit,
}) {
  if (!value) return null

  const inputClass = `w-full rounded-2xl px-4 py-3 text-sm border outline-none ${
    isDarkMode ? "bg-[#111317] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800"
  }`

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative z-[81] w-full max-w-lg rounded-[2rem] border p-6 ${isDarkMode ? "bg-[#191b1f] border-slate-800" : "bg-white border-slate-200 shadow-2xl"}`}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{isEditing ? "Edit Context" : "Create Context"}</h3>
            <p className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Important chat, organized into one evolving unit.
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl ${isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Title</label>
            <input className={inputClass} value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} placeholder="Google Apps integration" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Summary</label>
            <textarea className={`${inputClass} min-h-[110px] resize-none`} value={value.summary} onChange={e => onChange({ ...value, summary: e.target.value })} placeholder="What matters, what changed, what still needs attention." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Status</label>
              <select className={inputClass} value={value.status} onChange={e => onChange({ ...value, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">Owner</label>
              <select className={inputClass} value={value.ownerId} onChange={e => onChange({ ...value, ownerId: e.target.value })}>
                {owners.map(owner => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-medium ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}>Cancel</button>
          <button onClick={onSubmit} className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDarkMode ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
            {isEditing ? "Save context" : "Create context"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddToContextPopover({
  anchorEl,
  boundaryEl,
  preferredAlign = "right",
  isDarkMode,
  contexts = [],
  onClose,
  onSelect,
}) {
  const popoverRef = React.useRef(null)
  const [position, setPosition] = React.useState({
    left: 0,
    top: 0,
    ready: false,
    openUpward: false,
    align: preferredAlign,
  })

  const computePosition = React.useCallback(() => {
    if (!anchorEl || !popoverRef.current) return
    if (!anchorEl.isConnected) {
      onClose?.()
      return
    }

    const anchorRect = anchorEl.getBoundingClientRect()
    const popoverRect = popoverRef.current.getBoundingClientRect()
    const boundaryRect = boundaryEl?.getBoundingClientRect?.() || {
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    }
    const viewportPadding = 12
    const boundaryPadding = 10
    const gap = 8

    const minLeft = Math.max(viewportPadding, boundaryRect.left + boundaryPadding)
    const maxRight = Math.min(window.innerWidth - viewportPadding, boundaryRect.right - boundaryPadding)
    const minTop = Math.max(viewportPadding, boundaryRect.top + boundaryPadding)
    const maxBottom = Math.min(window.innerHeight - viewportPadding, boundaryRect.bottom - boundaryPadding)

    const preferredLeft =
      preferredAlign === "left"
        ? anchorRect.left
        : anchorRect.right - popoverRect.width

    let left = clampValue(
      preferredLeft,
      minLeft,
      Math.max(minLeft, maxRight - popoverRect.width)
    )

    left = clampValue(
      left,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - viewportPadding - popoverRect.width)
    )

    let openUpward = false
    let top = anchorRect.bottom + gap

    if (top + popoverRect.height > maxBottom) {
      top = anchorRect.top - popoverRect.height - gap
      openUpward = true
    }

    if (top < minTop) {
      const downTop = clampValue(
        anchorRect.bottom + gap,
        minTop,
        Math.max(minTop, maxBottom - popoverRect.height)
      )
      const upTop = clampValue(
        anchorRect.top - popoverRect.height - gap,
        minTop,
        Math.max(minTop, maxBottom - popoverRect.height)
      )
      const spaceBelow = maxBottom - anchorRect.bottom
      const spaceAbove = anchorRect.top - minTop
      top = spaceBelow >= spaceAbove ? downTop : upTop
      openUpward = spaceBelow < spaceAbove
    }

    const resolvedAlign =
      left <= minLeft + 4 ? "left" : left + popoverRect.width >= maxRight - 4 ? "right" : preferredAlign

    setPosition({
      left,
      top,
      ready: true,
      openUpward,
      align: resolvedAlign,
    })
  }, [anchorEl, boundaryEl, onClose, preferredAlign])

  React.useLayoutEffect(() => {
    computePosition()
  }, [computePosition, contexts.length])

  React.useEffect(() => {
    if (!anchorEl) return undefined

    let frame = null
    const updatePosition = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        computePosition()
      })
    }

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [anchorEl, computePosition])

  if (!anchorEl) return null

  const popoverNode = (
    <div
      ref={popoverRef}
      onClick={event => event.stopPropagation()}
      className={`fixed z-[96] w-[284px] overflow-hidden rounded-[22px] border p-2 backdrop-blur-xl transition-[opacity,transform] duration-150 ${
        position.ready ? "opacity-100 scale-100" : "opacity-0 scale-95"
      } ${
        isDarkMode
          ? "bg-[#17191d]/96 border-white/8 shadow-[0_18px_48px_rgba(2,6,23,0.55)]"
          : "bg-white/96 border-slate-200/80 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
      }`}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        visibility: position.ready ? "visible" : "hidden",
        transformOrigin: `${position.openUpward ? "bottom" : "top"} ${position.align === "left" ? "left" : "right"}`,
      }}
    >
      <div className={`px-2.5 pb-2 pt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em]">Add to context</div>
        <div className="mt-1 text-xs">Link this message into an existing context.</div>
      </div>

      <div className={`mb-1 h-px ${isDarkMode ? "bg-white/8" : "bg-slate-200/80"}`} />

      <div className="max-h-[280px] overflow-y-auto pr-1 space-y-1">
        {contexts.length === 0 && (
          <div className={`rounded-[16px] px-3 py-4 text-sm ${isDarkMode ? "text-slate-400 bg-white/[0.03]" : "text-slate-500 bg-slate-50/90"}`}>
            No contexts in this channel yet.
          </div>
        )}
        {contexts.map(context => (
          <button
            key={context.id}
            onClick={() => onSelect(context.id)}
            className={`group w-full rounded-[16px] px-3 py-2.5 text-left transition-all duration-150 ${
              isDarkMode ? "hover:bg-white/[0.06]" : "hover:bg-slate-100"
            }`}
          >
            <div className={`text-[13px] font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
              {context.title}
            </div>
            <div className={`mt-1 line-clamp-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {context.summary || "No summary yet"}
            </div>
          </button>
        ))}
      </div>

      <div className={`mt-1 h-px ${isDarkMode ? "bg-white/8" : "bg-slate-200/80"}`} />

      <button
        onClick={onClose}
        className={`mt-1 flex w-full items-center justify-center rounded-[16px] px-3 py-2.5 text-sm font-medium transition-colors ${
          isDarkMode ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Close
      </button>
    </div>
  )

  return createPortal(popoverNode, document.body)
}

function Section({ title, count, icon, isDarkMode, children }) {
  const SectionIcon = icon
  return (
    <section className={`overflow-hidden rounded-[1.5rem] border ${isDarkMode ? "border-slate-800/90 bg-[#12161b]" : "border-slate-200/80 bg-white"}`}>
      <div className={`flex items-center justify-between border-b px-4 py-3.5 sm:px-5 ${isDarkMode ? "border-slate-800/80 bg-white/[0.02]" : "border-slate-200/80 bg-slate-50/80"}`}>
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${isDarkMode ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700"}`}>
            <SectionIcon className="h-4 w-4" />
          </span>
          <div>
            <h4 className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{title}</h4>
            {typeof count === "number" && <div className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{count} item{count === 1 ? "" : "s"}</div>}
          </div>
        </div>
        {typeof count === "number" && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-600 shadow-sm"}`}>
            {count}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function formatMessageClock(timestamp) {
  if (!timestamp) return ""
  try {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function ContextMessageRow({ message, isDarkMode }) {
  const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0
  const avatar = message.authorAvatar || message.avatar || ""
  const initials = message.authorInitials || getNameInitials(message.author)
  const timeLabel = formatMessageClock(message.timestamp)

  return (
    <article
      className={cx(
        "group flex gap-3 rounded-none px-1 py-3.5 transition-colors sm:px-3",
        isDarkMode ? "hover:bg-white/[0.03]" : "hover:bg-slate-100/70"
      )}
    >
      <div className="mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full">
        {avatar ? (
          <SmartImage
            src={avatar}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <div className={`flex h-full w-full items-center justify-center text-sm font-semibold ${isDarkMode ? "bg-white/[0.07] text-slate-100" : "bg-slate-100 text-slate-700"}`}>
                {initials}
              </div>
            }
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center text-sm font-semibold ${isDarkMode ? "bg-white/[0.07] text-slate-100" : "bg-slate-100 text-slate-700"}`}>
            {initials}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className={`truncate text-[15px] font-bold sm:text-base ${isDarkMode ? "text-white" : "text-slate-950"}`}>
            {message.author || "Unknown"}
          </div>
          {timeLabel ? (
            <div className={`text-xs font-semibold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {timeLabel}
            </div>
          ) : null}
          {message.editedAt ? (
            <div className={`text-[11px] italic ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              edited
            </div>
          ) : null}
        </div>

        <p className={`mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
          {getMessagePreview(message)}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {message.isDecision ? (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isDarkMode ? "bg-amber-500/12 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
              <Check className="h-3.5 w-3.5" />
              Decision
            </span>
          ) : null}
          {message.editedAt ? (
            <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-slate-100 text-slate-500"}`}>
              Edited
            </span>
          ) : null}
          {attachmentCount > 0 ? (
            (message.attachments || []).slice(0, 3).map((attachment, index) => (
              <span key={`${attachment.id || attachment.fileId || attachment.name || index}`} className={`inline-flex max-w-[220px] items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isDarkMode ? "bg-sky-500/12 text-sky-200" : "bg-sky-50 text-sky-700"}`}>
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{attachment.name || "Attachment"}</span>
              </span>
            ))
          ) : null}
        </div>
      </div>
    </article>
  )
}

function MessageFocusedContextPanel({
  isDarkMode,
  context,
  ownerName,
  contributorNames,
  linkedMessages,
  files,
  decisions,
  tasks,
  canEdit,
  canAddSelectedMessage,
  onAddSelectedMessage,
  onMarkDecision,
  onCreateTask,
  onEdit,
  onClose,
  formatTime,
  panelStyle,
  statusMeta,
  summary,
  metrics,
  latestActivity,
}) {
  const visibleContributors = contributorNames.slice(0, 8)
  const visibleFiles = files.slice(0, 3)
  const visibleDecisions = decisions.slice(0, 3)
  const visibleTasks = tasks.slice(0, 3)
  const artifactCount = visibleFiles.length + visibleDecisions.length + visibleTasks.length

  return (
    <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden animate-fade-in ${isDarkMode ? "bg-[#08111a]" : "bg-[#f6f8fb]"}`} style={panelStyle}>
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden md:hidden">
        <div className={`shrink-0 border-b px-4 pb-4 pt-4 ${isDarkMode ? "border-slate-800/90 bg-[#0b131c]" : "border-slate-200/80 bg-white"}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-slate-100 text-slate-600"}`}>
              Context
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>
              {statusMeta.label}
            </span>
          </div>

          <h1 className={`mt-4 break-words text-[1.8rem] font-semibold leading-tight tracking-[-0.04em] ${isDarkMode ? "text-white" : "text-slate-950"}`}>
            {context.title}
          </h1>
          <p className={`mt-3 text-[15px] leading-7 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {summary || "Captured discussion, ownership, and follow-up work organized into one focused review workflow."}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {metrics.slice(0, 3).map(metric => (
              <div key={metric.label} className={`rounded-[18px] border px-3 py-3 ${isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50"}`}>
                <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{metric.label}</div>
                <div className={`mt-1 text-xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{metric.value}</div>
              </div>
            ))}
          </div>

          <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {ownerName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {contributorNames.length} contributor{contributorNames.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              {formatTime(context.updatedAt)}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                Messages
              </div>
              <div className={`mt-1 text-sm leading-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Read the captured conversation in order.
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${isDarkMode ? "bg-sky-500/12 text-sky-200" : "bg-sky-50 text-sky-700"}`}>
              {linkedMessages.length} in view
            </span>
          </div>

          {linkedMessages.length === 0 ? (
            <div className={`flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed px-6 text-center ${isDarkMode ? "border-slate-700/70 bg-[#0d151d] text-slate-500" : "border-slate-200 bg-white text-slate-500"}`}>
              No linked messages yet.
            </div>
          ) : (
            <div className={`overflow-hidden rounded-[22px] border pb-28 ${isDarkMode ? "border-slate-800 bg-[#0d151d]" : "border-slate-200 bg-white"}`}>
              {linkedMessages.map(message => (
                <ContextMessageRow key={message.id} message={message} isDarkMode={isDarkMode} />
              ))}
            </div>
          )}
        </div>

        <div className={`shrink-0 border-t px-4 py-3 ${isDarkMode ? "border-slate-800/90 bg-[#0b131c]" : "border-slate-200 bg-white"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onAddSelectedMessage}
              disabled={!canAddSelectedMessage}
              className={`rounded-full border px-4 py-2.5 text-sm font-medium ${
                canAddSelectedMessage
                  ? isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-slate-200 bg-white text-slate-700"
                  : isDarkMode ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              Add selected
            </button>
            {onMarkDecision && (
              <button onClick={onMarkDecision} className={`rounded-full border px-4 py-2.5 text-sm font-medium ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
                Mark decision
              </button>
            )}
            <button onClick={onCreateTask} className={`rounded-full border px-4 py-2.5 text-sm font-medium ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
              Create task
            </button>
            {canEdit && (
              <button onClick={onEdit} className={`ml-auto rounded-full px-4 py-2.5 text-sm font-semibold ${isDarkMode ? "bg-sky-500 text-white" : "bg-slate-900 text-white"}`}>
                Edit
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto hidden min-h-0 h-full w-full max-w-[1540px] flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 md:flex lg:px-8 lg:py-7">
        <header className={cx("shrink-0 rounded-[1.9rem] border px-5 py-5 sm:px-6", isDarkMode ? "border-slate-800/90 bg-[#0d151d]" : "border-slate-200/90 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.04)]")}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={onClose}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-[#f2f4f7] text-slate-600"}`}>
                  Context
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>
                  {statusMeta.label}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h1 className={`text-[1.7rem] font-semibold tracking-[-0.05em] sm:text-[2rem] ${isDarkMode ? "text-white" : "text-slate-950"}`}>
                    {context.title}
                  </h1>
                  <p className={`mt-2 max-w-3xl text-sm leading-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    {summary || "Captured discussion, ownership, and follow-up work organized into one focused review workflow."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {metrics.slice(0, 3).map(metric => (
                    <div key={metric.label} className={`rounded-[18px] border px-3.5 py-3 ${isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-[#f8fafc]"}`}>
                      <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                        {metric.label}
                      </div>
                      <div className={`mt-1.5 text-[1.15rem] font-semibold tracking-[-0.04em] ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Owner {ownerName}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {contributorNames.length} contributor{contributorNames.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Updated {formatTime(context.updatedAt)}
                </span>
              </div>
            </div>

            {canEdit && (
              <button onClick={onEdit} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${isDarkMode ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                Edit context
              </button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 pt-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-h-0 flex-col">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                  Linked Messages
                </div>
                <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Read the captured conversation in sequence, without the extra dashboard noise.
                </div>
              </div>
              <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-600 shadow-sm"}`}>
                {linkedMessages.length} in view
              </div>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              {linkedMessages.length === 0 ? (
                <div className={`flex min-h-[300px] items-center justify-center rounded-[24px] border border-dashed px-6 text-center ${isDarkMode ? "border-slate-700/70 bg-[#0d151d] text-slate-500" : "border-slate-200 bg-white text-slate-500"}`}>
                  No linked messages yet.
                </div>
              ) : (
                <div className={`overflow-hidden rounded-[18px] ${isDarkMode ? "bg-[#0d151d]" : "bg-white"}`}>
                  {linkedMessages.map(message => (
                    <ContextMessageRow key={message.id} message={message} isDarkMode={isDarkMode} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0">
            <div className="h-full overflow-y-auto">
              <div className="space-y-4">
                <section className={`rounded-[22px] border p-4 ${isDarkMode ? "border-slate-800/90 bg-[#0d151d]" : "border-slate-200/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]"}`}>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                    Snapshot
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {metrics.map(metric => {
                      const MetricIcon = metric.icon
                      return (
                        <div key={metric.label} className={`flex items-center justify-between rounded-[16px] border px-3 py-2.5 ${isDarkMode ? "border-white/8 bg-white/[0.04]" : "border-slate-200/80 bg-[#f7f9fc]"}`}>
                          <div>
                            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                              {metric.label}
                            </div>
                            <div className={`mt-1 text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                              {metric.value}
                            </div>
                          </div>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-2xl ${isDarkMode ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700"}`}>
                            <MetricIcon className="h-4 w-4" />
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section className={`rounded-[22px] border p-4 ${isDarkMode ? "border-slate-800/90 bg-[#0d151d]" : "border-slate-200/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Supporting context</div>
                    <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-[#f3f5f7] text-slate-600"}`}>
                      {artifactCount}
                    </div>
                  </div>

                  <div className={`mt-4 border-t pt-4 ${isDarkMode ? "border-slate-800/80" : "border-slate-200/80"}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>Files</div>
                    <div className="mt-2 space-y-2">
                      {visibleFiles.length > 0 ? visibleFiles.map(file => (
                        <div key={file.id || file.fileId || file.name} className={`rounded-[16px] px-3 py-2.5 ${isDarkMode ? "bg-white/[0.04] text-slate-300" : "bg-[#f7f9fc] text-slate-700"}`}>
                          <div className="truncate text-sm font-medium">{file.name || "Untitled file"}</div>
                          <div className={`mt-1 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{file.sourceLabel || "Linked file"}</div>
                        </div>
                      )) : (
                        <div className="text-sm text-slate-500">No files linked yet.</div>
                      )}
                    </div>
                  </div>

                  <div className={`mt-4 border-t pt-4 ${isDarkMode ? "border-slate-800/80" : "border-slate-200/80"}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>Decisions</div>
                    <div className="mt-2 space-y-2">
                      {visibleDecisions.length > 0 ? visibleDecisions.map(decision => (
                        <div key={decision.id} className={`rounded-[16px] px-3 py-2.5 ${isDarkMode ? "bg-white/[0.04] text-slate-300" : "bg-[#f7f9fc] text-slate-700"}`}>
                          <div className="line-clamp-2 text-sm font-medium">{decision.text || "Decision captured"}</div>
                          <div className={`mt-1 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{decision.author || "Unknown"}</div>
                        </div>
                      )) : (
                        <div className="text-sm text-slate-500">No decisions captured yet.</div>
                      )}
                    </div>
                  </div>

                  <div className={`mt-4 border-t pt-4 ${isDarkMode ? "border-slate-800/80" : "border-slate-200/80"}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>Tasks</div>
                    <div className="mt-2 space-y-2">
                      {visibleTasks.length > 0 ? visibleTasks.map(task => (
                        <div key={task.id} className={`rounded-[16px] px-3 py-2.5 ${isDarkMode ? "bg-white/[0.04] text-slate-300" : "bg-[#f7f9fc] text-slate-700"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="line-clamp-2 text-sm font-medium">{task.text || task.message || "Untitled task"}</div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${String(task.status) === "completed" ? (isDarkMode ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDarkMode ? "bg-amber-500/10 text-amber-300" : "bg-amber-100 text-amber-700")}`}>
                              {String(task.status) === "completed" ? "Done" : "Open"}
                            </span>
                          </div>
                          <div className={`mt-1 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{task.assigneeLabel || "Unassigned"}</div>
                        </div>
                      )) : (
                        <div className="text-sm text-slate-500">No tasks linked yet.</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className={`rounded-[22px] border p-4 ${isDarkMode ? "border-slate-800/90 bg-[#0d151d]" : "border-slate-200/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]"}`}>
                  <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>People and activity</div>
                  <div className={`mt-3 text-sm leading-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    {latestActivity?.label || "No activity has been recorded for this context yet."}
                  </div>

                  <div className={`mt-4 border-t pt-4 ${isDarkMode ? "border-slate-800/80" : "border-slate-200/80"}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>Contributors</div>
                    <div className="mt-2 space-y-2">
                      {visibleContributors.length > 0 ? visibleContributors.map(name => (
                        <div key={name} className={`flex items-center gap-3 rounded-[16px] px-3 py-2.5 ${isDarkMode ? "bg-white/[0.04] text-slate-300" : "bg-[#f7f9fc] text-slate-700"}`}>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-white text-slate-600 shadow-sm"}`}>
                            {getNameInitials(name)}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium">{name}</span>
                        </div>
                      )) : (
                        <div className="text-sm text-slate-500">No contributors yet.</div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </aside>
        </div>

        <div className={`mt-6 shrink-0 pt-1`}>
          <div className={`flex flex-col gap-3 rounded-[22px] border px-4 py-4 lg:flex-row lg:items-center lg:justify-between ${isDarkMode ? "border-slate-800/90 bg-[#0d151d]" : "border-slate-200/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.04)]"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onAddSelectedMessage}
                disabled={!canAddSelectedMessage}
                className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  canAddSelectedMessage
                    ? isDarkMode
                      ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : isDarkMode
                      ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                Add selected
              </button>
              {onMarkDecision && (
                <button onClick={onMarkDecision} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  Mark decision
                </button>
              )}
              <button onClick={onCreateTask} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                Create task
              </button>
            </div>
            <button onClick={onClose} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${isDarkMode ? "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              Back to contexts
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export function LivingContextPanel({
  isDarkMode,
  context,
  ownerName,
  contributorNames = [],
  linkedMessages = [],
  files = [],
  decisions = [],
  tasks = [],
  activity = [],
  canEdit,
  canAddSelectedMessage,
  onAddSelectedMessage,
  onMarkDecision,
  onCreateTask,
  onEdit,
  onClose,
  formatTime,
  panelStyle,
}) {
  if (!context) return null
  const statusMeta = CONTEXT_STATUS_META[context.status] || CONTEXT_STATUS_META.active
  const summary = String(context.summary || "").trim()
  const metrics = [
    { label: "Messages", value: linkedMessages.length, icon: MessageSquare },
    { label: "Files", value: files.length, icon: FileText },
    { label: "Decisions", value: decisions.length, icon: Check },
    { label: "Tasks", value: tasks.length, icon: Plus },
  ]
  const latestActivity = activity.length > 0 ? activity[activity.length - 1] : null

  return (
    <MessageFocusedContextPanel
      isDarkMode={isDarkMode}
      context={context}
      ownerName={ownerName}
      contributorNames={contributorNames}
      linkedMessages={linkedMessages}
      files={files}
      decisions={decisions}
      tasks={tasks}
      canEdit={canEdit}
      canAddSelectedMessage={canAddSelectedMessage}
      onAddSelectedMessage={onAddSelectedMessage}
      onMarkDecision={onMarkDecision}
      onCreateTask={onCreateTask}
      onEdit={onEdit}
      onClose={onClose}
      formatTime={formatTime}
      panelStyle={panelStyle}
      statusMeta={statusMeta}
      summary={summary}
      metrics={metrics}
      latestActivity={latestActivity}
    />
  )

  /*

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]" onClick={onClose} />
      <section
        className={`absolute inset-x-4 top-4 bottom-4 flex min-h-0 flex-col overflow-hidden rounded-[2rem] border shadow-[0_32px_80px_rgba(15,23,42,0.24)] animate-fade-in sm:inset-x-6 ${
          isDarkMode ? "border-slate-800 bg-[#101419]/96" : "border-slate-200/90 bg-white/95"
        }`}
        style={panelStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className={`relative overflow-hidden border-b ${isDarkMode ? "border-slate-800/90" : "border-slate-200/80"}`}>
          <div className={`absolute inset-0 ${isDarkMode ? "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.12),transparent_38%)]" : "bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.06),transparent_38%)]"}`} />
          <div className="relative px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white/80 text-slate-600 shadow-sm"}`}>
                  Context
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>{statusMeta.label}</span>
              </div>
              <h3 className={`mt-3 text-[1.55rem] font-semibold tracking-[-0.03em] sm:text-[1.75rem] ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                {context.title}
              </h3>
              <div className="hidden">
                Owner {ownerName} · {contributorNames.length} contributors · Updated {formatTime(context.updatedAt)}
              </div>
              <p className={`mt-3 max-w-3xl text-sm leading-6 sm:text-[15px] ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                {summary || "Review the important conversation captured in this context, along with its contributors and next actions."}
              </p>
              <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Owner {ownerName}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {contributorNames.length} contributor{contributorNames.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Updated {formatTime(context.updatedAt)}
                </span>
              </div>
            </div>
            <button onClick={onClose} className={`rounded-2xl p-2.5 transition ${isDarkMode ? "text-slate-400 hover:bg-white/[0.06] hover:text-white" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(metric => {
              const MetricIcon = metric.icon
              return (
                <div key={metric.label} className={`rounded-[1.35rem] border px-4 py-3.5 ${isDarkMode ? "border-white/8 bg-white/[0.04]" : "border-white/70 bg-white/80 shadow-sm"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{metric.label}</div>
                      <div className={`mt-1 text-[1.4rem] font-semibold tracking-[-0.03em] ${isDarkMode ? "text-white" : "text-slate-900"}`}>{metric.value}</div>
                    </div>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isDarkMode ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700"}`}>
                      <MetricIcon className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {contributorNames.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {contributorNames.slice(0, 6).map(name => (
                <span key={name} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white/85 text-slate-600 shadow-sm"}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-600"}`}>
                    {getNameInitials(name)}
                  </span>
                  {name}
                </span>
              ))}
            </div>
          )}

          {latestActivity?.label && (
            <div className={`mt-4 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Latest activity: {latestActivity.label}
            </div>
          )}
        </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <Section title="Linked Messages" count={linkedMessages.length} icon={MessageSquare} isDarkMode={isDarkMode}>
            {linkedMessages.length === 0 ? (
              <div className={`rounded-[1.35rem] border border-dashed px-5 py-10 text-center ${isDarkMode ? "border-slate-700/70 bg-[#0f1318] text-slate-500" : "border-slate-200 bg-slate-50/70 text-slate-500"}`}>
                No linked messages yet.
              </div>
            ) : (
              <div className="space-y-3">
                {linkedMessages.map((message, index) => (
                  <article key={message.id} className={`relative overflow-hidden rounded-[1.4rem] border p-4 sm:p-5 ${isDarkMode ? "border-slate-800/90 bg-[#0d1218]" : "border-slate-200/80 bg-slate-50/60"}`}>
                    <div className={`absolute inset-y-5 left-0 w-1 rounded-full ${isDarkMode ? "bg-sky-400/70" : "bg-sky-500/70"}`} />
                    <div className="flex gap-3.5 pl-1">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] text-sm font-semibold ${isDarkMode ? "bg-white/[0.06] text-slate-100" : "bg-white text-slate-700 shadow-sm"}`}>
                        {getNameInitials(message.author)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <div className={`truncate text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{message.author}</div>
                            <div className={`mt-1 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>Message {index + 1}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-end">
                          <div className={`rounded-full px-3 py-1 text-xs font-medium ${isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-500 shadow-sm"}`}>
                            {formatTime(message.timestamp)}
                          </div>
                        </div>
                        <div className="hidden">
                  <div className={`text-xs mb-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{message.author} · {formatTime(message.timestamp)}</div>
                        </div>
                        <p className={`mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{getMessagePreview(message)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className={`shrink-0 border-t px-4 py-3.5 sm:px-5 ${isDarkMode ? "border-slate-800/90 bg-[#0d1217]" : "border-slate-200/80 bg-white/95"}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onAddSelectedMessage}
              disabled={!canAddSelectedMessage}
                className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  canAddSelectedMessage
                    ? isDarkMode
                      ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : isDarkMode
                      ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }`}
            >
              Add selected
            </button>
            {onMarkDecision && (
                <button onClick={onMarkDecision} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  Mark decision
                </button>
            )}
              <button onClick={onCreateTask} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                Create task
              </button>
            </div>
            {canEdit && (
              <button onClick={onEdit} className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${isDarkMode ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                Edit context
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
  */
}

export function DecisionList({ decisions, isDarkMode, onOpenMessage, formatTime }) {
  if (!decisions.length) {
    return (
      <div className={`mx-4 sm:mx-6 rounded-[1.75rem] border p-8 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        No decisions marked yet.
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-6 space-y-2.5">
      {decisions.map(decision => (
        <button
          key={decision.id}
          onClick={() => onOpenMessage(decision.messageId)}
          className={`w-full text-left rounded-[1.35rem] border p-3.5 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{decision.text}</div>
              <div className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{decision.author} · {formatTime(decision.createdAt)}</div>
            </div>
            <div className={`px-2 py-1 rounded-full text-[11px] ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>Decision</div>
          </div>
        </button>
      ))}
    </div>
  )
}

export function FilesList({ files, isDarkMode }) {
  if (!files.length) {
    return (
      <div className={`mx-4 sm:mx-6 rounded-[1.75rem] border p-8 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        No files linked in this channel yet.
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-6 space-y-3">
      <div className={`rounded-[1.35rem] border px-4 py-3.5 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}>
        <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Channel Files</div>
        <div className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {files.length} file{files.length === 1 ? "" : "s"} shared in this channel
        </div>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {files.map(file => (
        <div key={file.id} className={`rounded-[1.35rem] border p-3.5 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{file.name}</div>
              <div className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{file.messageLabel}</div>
              <div className={`text-xs mt-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                Shared by {file.author}{file.timestamp ? ` · ${new Date(file.timestamp).toLocaleString()}` : ""}
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                {file.sourceLabel}{file.size ? ` · ${(file.size / 1024).toFixed(1)} KB` : ""}
              </div>
            </div>
            <FileText className={`w-4 h-4 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} />
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}

export function ChannelFilesGallery({ files, isDarkMode, onAttachFile, onOpenFile, onDeleteFile }) {
  const [fileSearchQuery, setFileSearchQuery] = React.useState("")
  const deferredFileSearchQuery = React.useDeferredValue(fileSearchQuery)
  const normalizedSearchQuery = normalizeFileSearchValue(deferredFileSearchQuery)
  const searchTerms = React.useMemo(
    () => normalizedSearchQuery.split(/\s+/).filter(Boolean),
    [normalizedSearchQuery]
  )
  const searchableFiles = React.useMemo(
    () => files.map(file => ({ file, searchText: getFileSearchText(file) })),
    [files]
  )
  const visibleFiles = React.useMemo(() => {
    if (!searchTerms.length) return files

    return searchableFiles
      .filter(({ searchText }) => searchTerms.every(term => searchText.includes(term)))
      .map(({ file }) => file)
  }, [files, searchableFiles, searchTerms])
  const hasSearch = fileSearchQuery.trim().length > 0

  return (
    <div className="mx-4 sm:mx-6 space-y-3">
      <div className={`rounded-[1.5rem] border px-4 py-3.5 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Channel Files</div>
            <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {files.length} file{files.length === 1 ? "" : "s"} shared in this channel
              {hasSearch ? ` | ${visibleFiles.length} shown` : ""}
            </div>
          </div>
          <label className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border px-3 transition focus-within:ring-2 sm:w-72 ${
            isDarkMode
              ? "border-slate-700 bg-[#0f1115] text-slate-200 focus-within:ring-sky-500/30"
              : "border-slate-200 bg-slate-50 text-slate-700 focus-within:ring-sky-500/20"
          }`}>
            <Search className={`h-4 w-4 shrink-0 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} />
            <input
              type="search"
              value={fileSearchQuery}
              onChange={event => setFileSearchQuery(event.target.value)}
              placeholder="Search files"
              className={`min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal ${
                isDarkMode ? "placeholder:text-slate-500" : "placeholder:text-slate-400"
              }`}
              autoComplete="off"
              spellCheck="false"
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => setFileSearchQuery("")}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                  isDarkMode ? "text-slate-400 hover:bg-white/10 hover:text-slate-200" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                }`}
                aria-label="Clear file search"
                title="Clear file search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>

      {!files.length ? (
        <div className={`rounded-[1.75rem] border p-8 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
          No files linked in this channel yet.
        </div>
      ) : !visibleFiles.length ? (
        <div className={`rounded-[1.75rem] border p-8 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
          No files match "{fileSearchQuery.trim()}".
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleFiles.map(file => {
          const kind = getFileKind(file)
          const kindConfig = getPreviewConfig(kind, isDarkMode)
          const HeaderIcon = kind === "image" ? FileImage : kindConfig.icon
          const compactDate = formatFileDate(file.timestamp)
          const compactSize = formatFileSize(file.size)

          return (
            <div
              key={file.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenFile?.(file)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onOpenFile?.(file)
                }
              }}
              className={`min-w-0 overflow-hidden rounded-[1rem] border p-2.5 transition-all duration-200 hover:-translate-y-0.5 sm:rounded-[1.5rem] sm:p-3 ${
                isDarkMode
                  ? "border-slate-800 bg-[#16181c] hover:border-slate-700"
                  : "border-slate-200 bg-white/90 shadow-sm hover:border-slate-300 sm:bg-slate-100"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3 sm:hidden">
                <FilePreview file={file} isDarkMode={isDarkMode} variant="thumb" />
                <div className="min-w-0 flex-1">
                  <div className={`line-clamp-2 break-words text-sm font-semibold leading-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                    {file.name}
                  </div>
                  <div className={`mt-1 truncate text-[0.72rem] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {[compactDate && `Opened ${compactDate}`, compactSize].filter(Boolean).join(" | ") || file.sourceLabel}
                  </div>
                  <div className={`mt-1 line-clamp-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {file.messageLabel}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {file.canDelete && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        onDeleteFile?.(file)
                      }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                        isDarkMode
                          ? "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                          : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                      }`}
                      title={`Delete ${file.name}`}
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      onAttachFile?.(file)
                    }}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isDarkMode
                        ? "bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                        : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                    }`}
                    title={`Attach ${file.name} to message`}
                    aria-label={`Attach ${file.name} to message`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="hidden sm:flex min-h-[292px] flex-col">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${kindConfig.accent}`}>
                      <HeaderIcon className="h-4 w-4" />
                    </div>
                    <div className={`min-w-0 truncate text-[1.02rem] font-medium ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                      {file.name}
                    </div>
                  </div>
                </div>

                <FilePreview file={file} isDarkMode={isDarkMode} />

                <div className="mt-3 flex min-w-0 flex-1 flex-col justify-between space-y-2">
                  <div className={`line-clamp-2 break-words text-[0.98rem] font-medium leading-snug ${isDarkMode ? "text-slate-100" : "text-slate-700"}`}>
                    {file.messageLabel}
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-1">
                    <div className={`flex min-w-0 items-center gap-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isDarkMode ? "bg-sky-500/20 text-sky-200" : "bg-sky-200 text-sky-700"}`}>
                        {(file.author || "U").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">{file.author}</div>
                        <div className="truncate text-xs">
                          {[compactDate && `Opened ${compactDate}`, compactSize].filter(Boolean).join(" | ")}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {file.canDelete && (
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            onDeleteFile?.(file)
                          }}
                          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                            isDarkMode
                              ? "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                              : "bg-white text-rose-600 hover:bg-rose-50"
                          }`}
                          title={`Delete ${file.name}`}
                          aria-label={`Delete ${file.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          onAttachFile?.(file)
                        }}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                          isDarkMode
                            ? "bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                            : "bg-white text-sky-700 hover:bg-sky-50"
                        }`}
                        title={`Attach ${file.name} to message`}
                        aria-label={`Attach ${file.name} to message`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

export function MessageActionButton({ isDarkMode, onClick, buttonRef, isActive = false }) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      aria-label="Message actions"
      title="Message actions"
      className={`${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} flex h-7 w-7 items-center justify-center rounded-full border transition-[opacity,background-color,border-color,color] duration-75 ${
        isDarkMode
          ? "bg-[#17191d]/95 border-white/10 hover:bg-[#202329] text-slate-300"
          : "bg-white/96 border-slate-200/90 hover:bg-slate-50 text-slate-600"
      }`}
    >
      <MoreVertical className="h-3.5 w-3.5" />
    </button>
  )
}

export function MessageSelectionToggle({ isDarkMode, checked = false, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={checked ? "Deselect message" : "Select message"}
      onClick={onChange}
      className={`flex h-6 w-6 items-center justify-center rounded-lg border transition-colors ${
        checked
          ? isDarkMode
            ? "border-sky-400 bg-sky-500/20 text-sky-200"
            : "border-sky-500 bg-sky-50 text-sky-600"
          : isDarkMode
            ? "border-slate-700 bg-[#111317] text-transparent hover:border-slate-600"
            : "border-slate-300 bg-white text-transparent hover:border-slate-400"
      }`}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  )
}

