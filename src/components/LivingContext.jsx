import React from "react"
import { createPortal } from "react-dom"
import {
  ArrowDown,
  Check,
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
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { CHANNEL_TABS, CONTEXT_STATUS_META } from "./LivingContext.helpers"
import SmartImage from "./SmartImage"

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

function clampValue(value, min, max) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
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

function FilePreview({ file, isDarkMode }) {
  const kind = getFileKind(file)
  const config = getPreviewConfig(kind, isDarkMode)
  const PreviewIcon = config.icon
  const fileTitle = file?.name || "Untitled file"

  if (kind === "image" && file?.url) {
    return (
      <div className={`relative overflow-hidden rounded-[1.1rem] border sm:rounded-[1.25rem] ${isDarkMode ? "border-slate-700/70" : "border-slate-200 bg-white/80"}`}>
        <SmartImage src={file.url} alt={fileTitle} className="h-28 w-full object-cover sm:h-40" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent sm:h-20" />
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
  return (
    <div
      className={`mx-4 sm:mx-6 mb-2.5 rounded-xl border px-2.5 py-1.5 flex items-center justify-between gap-2 ${
        isDarkMode ? "border-slate-800 bg-[#16181c]" : "border-white/70 bg-white/70 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-1">
        {tabs.map(tab => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={`px-2.5 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-colors ${
                active
                  ? isDarkMode
                    ? "bg-slate-800 text-white"
                    : "bg-slate-900 text-white"
                  : isDarkMode
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          )
        })}
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

    const preferredLeft =
      preferredAlign === "left"
        ? anchorRect.left
        : anchorRect.right - menuRect.width

    let left = clampValue(
      preferredLeft,
      minLeft,
      Math.max(minLeft, maxRight - menuRect.width)
    )

    left = clampValue(
      left,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - viewportPadding - menuRect.width)
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

  const reactionButtonClass = `flex h-9 w-9 items-center justify-center rounded-full text-[18px] transition-all duration-150 ${
    isDarkMode
      ? "bg-transparent text-slate-100 hover:bg-white/10 hover:scale-[1.06]"
      : "bg-transparent text-slate-700 hover:bg-slate-100 hover:scale-[1.06]"
  }`

  const actionBaseClass = `group flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150`
  const actionClass = `${actionBaseClass} ${
    isDarkMode
      ? "text-slate-200 hover:bg-white/8 hover:text-white"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
  }`
  const destructiveClass = `${actionBaseClass} ${
    isDarkMode
      ? "text-rose-300 hover:bg-rose-500/12 hover:text-rose-200"
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
      ref={menuRef}
      onClick={event => event.stopPropagation()}
      className={`fixed z-[95] w-[238px] overflow-hidden rounded-[22px] border p-2 backdrop-blur-xl transition-[opacity,transform] duration-150 ${
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
      {emojis.length > 0 && (
        <div
          className={`mb-1.5 rounded-[18px] border px-2 py-1.5 ${
            isDarkMode ? "border-white/8 bg-white/[0.03]" : "border-slate-200/80 bg-slate-50/90"
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

      <div className="space-y-1">
        {primaryActions.map(action => {
          const ActionIcon = action.icon
          return (
            <button key={action.key} onClick={action.onClick} className={actionClass}>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                  isDarkMode
                    ? "bg-white/[0.05] text-slate-300 group-hover:bg-white/[0.08]"
                    : "bg-slate-100 text-slate-500 group-hover:bg-white"
                }`}
              >
                <ActionIcon className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate">{action.label}</span>
            </button>
          )
        })}
      </div>

      {onDelete && (
        <>
          <div className={`my-2 h-px ${isDarkMode ? "bg-white/8" : "bg-slate-200/80"}`} />
          <button onClick={onDelete} className={destructiveClass}>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                isDarkMode
                  ? "bg-rose-500/12 text-rose-300 group-hover:bg-rose-500/18"
                  : "bg-rose-50 text-rose-500 group-hover:bg-white"
              }`}
            >
              <Trash2 className="h-4 w-4" />
            </span>
            <span className="flex-1 truncate">Delete message</span>
          </button>
        </>
      )}
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
      <div className={`mx-4 sm:mx-6 rounded-[1.75rem] border p-8 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        <div className={`mx-auto mb-4 w-14 h-14 rounded-3xl flex items-center justify-center ${isDarkMode ? "bg-slate-800 text-sky-300" : "bg-sky-50 text-sky-600"}`}>
          <FolderOpen className="w-8 h-8" />
        </div>
        <div className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>No living context yet</div>
        <p className="text-sm mt-2">Create one from key messages and keep the channel memory close to the chat.</p>
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
            className={`text-left rounded-[1.5rem] border p-4 transition-all hover:-translate-y-0.5 ${
              isDarkMode ? "bg-[#16181c] border-slate-800 hover:border-slate-700" : "bg-white/80 border-white hover:shadow-lg"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className={`text-[15px] font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{context.title}</div>
                <div className={`text-sm mt-1 line-clamp-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{context.summary}</div>
              </div>
              <div className="flex items-start gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs border ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>{statusMeta.label}</span>
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

            <div className={`grid grid-cols-2 gap-1.5 text-xs mb-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              <div className="rounded-lg px-2.5 py-1.5 border border-transparent bg-black/5">Messages {context.linkedMessageIds.length}</div>
              <div className="rounded-lg px-2.5 py-1.5 border border-transparent bg-black/5">Files {context.linkedFileIds.length}</div>
              <div className="rounded-lg px-2.5 py-1.5 border border-transparent bg-black/5">Contributors {context.contributorIds.length}</div>
              <div className="rounded-lg px-2.5 py-1.5 border border-transparent bg-black/5">Tasks {context.taskIds.length}</div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>Owner {renderOwner(context.ownerId)}</span>
              <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>{formatUpdatedTime(context.updatedAt)}</span>
            </div>
          </article>
        )
      })}
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
    <section className={`rounded-[1.35rem] border p-3.5 ${isDarkMode ? "bg-[#111317] border-slate-800" : "bg-slate-50/80 border-slate-200/80"}`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <SectionIcon className={`w-4 h-4 ${isDarkMode ? "text-sky-300" : "text-sky-600"}`} />
          <h4 className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{title}</h4>
        </div>
        {typeof count === "number" && <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{count}</span>}
      </div>
      {children}
    </section>
  )
}

export function LivingContextPanel({
  isDarkMode,
  context,
  ownerName,
  contributorNames = [],
  linkedMessages = [],
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

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black/10" onClick={onClose} />
      <section
        className={`absolute inset-x-4 top-4 bottom-4 rounded-[2rem] border shadow-2xl overflow-hidden animate-fade-in flex flex-col min-h-0 ${
          isDarkMode ? "bg-[#191b1f] border-slate-800" : "bg-white/95 border-slate-200"
        }`}
        style={panelStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-[1.4rem] font-semibold truncate ${isDarkMode ? "text-white" : "text-slate-800"}`}>{context.title}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs border ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>{statusMeta.label}</span>
              </div>
              <div className={`mt-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Owner {ownerName} · {contributorNames.length} contributors · Updated {formatTime(context.updatedAt)}
              </div>
            </div>
            <button onClick={onClose} className={`p-2.5 rounded-xl ${isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
          {contributorNames.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {contributorNames.slice(0, 5).map(name => (
                <span key={name} className={`px-2.5 py-1 rounded-full text-xs ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{name}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 p-4 overflow-y-auto">
          <Section title="Linked Messages" count={linkedMessages.length} icon={MessageSquare} isDarkMode={isDarkMode}>
            <div className="space-y-2.5">
              {linkedMessages.length === 0 && <div className={`text-sm ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>No linked messages yet.</div>}
              {linkedMessages.map(message => (
                <div key={message.id} className={`rounded-2xl p-3 ${isDarkMode ? "bg-slate-900/80" : "bg-white border border-slate-200/80"}`}>
                  <div className={`text-xs mb-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{message.author} · {formatTime(message.timestamp)}</div>
                  <div className={`text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{message.text || "Attachment or task update"}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className={`shrink-0 px-4 py-3 border-t flex items-center gap-3 justify-between ${isDarkMode ? "border-slate-800 bg-[#15171b]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onAddSelectedMessage}
              disabled={!canAddSelectedMessage}
              className={`px-3 py-2 rounded-xl text-sm font-medium ${canAddSelectedMessage ? isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200" : "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"}`}
            >
              Add selected
            </button>
            {onMarkDecision && (
              <button onClick={onMarkDecision} className={`px-3 py-2 rounded-xl text-sm font-medium ${isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Mark decision</button>
            )}
            <button onClick={onCreateTask} className={`px-3 py-2 rounded-xl text-sm font-medium ${isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Create task</button>
          </div>
          {canEdit && (
            <button onClick={onEdit} className={`px-3 py-2 rounded-xl text-sm font-semibold ${isDarkMode ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
              Edit context
            </button>
          )}
        </div>
      </section>
    </div>
  )
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

export function ChannelFilesGallery({ files, isDarkMode, onAttachFile, onDownloadFile }) {
  if (!files.length) {
    return (
      <div className={`mx-4 sm:mx-6 rounded-[1.75rem] border p-8 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        No files linked in this channel yet.
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-6 space-y-3">
      <div className={`rounded-[1.5rem] border px-4 py-3.5 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}>
        <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Channel Files</div>
        <div className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {files.length} file{files.length === 1 ? "" : "s"} shared in this channel
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-3 2xl:grid-cols-4">
        {files.map(file => {
          const kind = getFileKind(file)
          const kindConfig = getPreviewConfig(kind, isDarkMode)
          const HeaderIcon = kind === "image" ? FileImage : kindConfig.icon
          const compactDate = formatFileDate(file.timestamp)
          const compactSize = formatFileSize(file.size)

          return (
            <div
              key={file.id}
              className={`min-w-0 transition-all duration-200 hover:-translate-y-0.5 ${
                isDarkMode
                  ? "sm:overflow-hidden sm:rounded-[1.5rem] sm:border sm:bg-[#16181c] sm:p-3 sm:border-slate-800 sm:hover:border-slate-700"
                  : "sm:overflow-hidden sm:rounded-[1.5rem] sm:border sm:bg-slate-100 sm:p-3 sm:border-slate-200 sm:hover:border-slate-300"
              }`}
            >
              <div className="sm:hidden">
                <FilePreview file={file} isDarkMode={isDarkMode} />
                <div className="mt-2 flex items-start gap-2">
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${kind === "image" ? "bg-sky-500 text-white" : kindConfig.accent}`}>
                    <HeaderIcon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`line-clamp-2 break-words text-[0.72rem] font-medium leading-[1.05rem] ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                      {file.name}
                    </div>
                    <div className={`mt-1 truncate text-[0.65rem] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                      {[compactDate && `Opened ${compactDate}`, compactSize].filter(Boolean).join(" | ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      onDownloadFile?.(file)
                    }}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
                    title="Download file"
                    aria-label={`Download ${file.name}`}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
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
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      onDownloadFile?.(file)
                    }}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-white/80"}`}
                    title="Download file"
                    aria-label={`Download ${file.name}`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
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
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        onAttachFile?.(file)
                      }}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
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
          )
        })}
      </div>
    </div>
  )
}

export function MessageActionButton({ isDarkMode, onClick, buttonRef, isActive = false }) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-all duration-150 p-2 rounded-full border shadow-sm hover:scale-[1.04] ${
        isDarkMode
          ? "bg-[#17191d]/95 border-white/10 hover:bg-[#202329] text-slate-300"
          : "bg-white/96 border-slate-200/90 hover:bg-slate-50 text-slate-600"
      }`}
    >
      <MoreVertical className="w-4 h-4" />
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

