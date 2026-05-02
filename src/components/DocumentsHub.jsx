import React, { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  FolderOpen,
  Grid3x3,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react"
import SmartImage from "./SmartImage"
import * as GoogleService from "../services/google"

const cx = (...classes) => classes.filter(Boolean).join(" ")

const sourceStyles = {
  all: { active: "border-slate-900 bg-slate-900 text-white", light: "bg-slate-100 text-slate-700", dark: "bg-white/[0.06] text-slate-300" },
  drive: { active: "border-sky-600 bg-sky-600 text-white", light: "bg-sky-50 text-sky-700", dark: "bg-sky-400/10 text-sky-200" },
  docs: { active: "border-blue-600 bg-blue-600 text-white", light: "bg-blue-50 text-blue-700", dark: "bg-blue-400/10 text-blue-200" },
  shared: { active: "border-emerald-600 bg-emerald-600 text-white", light: "bg-emerald-50 text-emerald-700", dark: "bg-emerald-400/10 text-emerald-200" },
  sheets: { active: "border-green-600 bg-green-600 text-white", light: "bg-green-50 text-green-700", dark: "bg-green-400/10 text-green-200" },
  slides: { active: "border-amber-500 bg-amber-500 text-white", light: "bg-amber-50 text-amber-700", dark: "bg-amber-400/10 text-amber-200" },
  gmail: { active: "border-rose-600 bg-rose-600 text-white", light: "bg-rose-50 text-rose-700", dark: "bg-rose-400/10 text-rose-200" },
}

const openInNewTab = url => {
  if (!url) return
  window.open(url, "_blank", "noopener,noreferrer")
}

function SurfaceCard({ children, className = "", isDarkMode = false }) {
  return (
    <section className={cx("overflow-hidden rounded-[28px] border", isDarkMode ? "border-white/10 bg-[#151922]/92 shadow-[0_26px_70px_rgba(2,6,23,0.38)]" : "border-white/80 bg-white/92 shadow-[0_22px_60px_rgba(15,23,42,0.08)]", className)}>
      {children}
    </section>
  )
}

function MetricCard({ label, value, note, icon, isDarkMode = false }) {
  return (
    <div className={cx("rounded-[24px] border p-4", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-slate-50/90")}>
      <div className="flex items-center justify-between gap-3">
        <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>{label}</div>
        <div className={cx("flex h-10 w-10 items-center justify-center rounded-2xl", isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-white text-slate-700 shadow-sm")}>{icon}</div>
      </div>
      <div className={cx("mt-4 text-[2rem] font-semibold leading-none tracking-[-0.05em]", isDarkMode ? "text-white" : "text-slate-900")}>{value}</div>
      <p className={cx("mt-2 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>{note}</p>
    </div>
  )
}

function MobileMetricCard({ label, value, icon, isDarkMode = false }) {
  return (
    <div
      className={cx(
        "min-w-[140px] rounded-[22px] border px-4 py-3.5",
        isDarkMode
          ? "border-white/10 bg-white/[0.05] backdrop-blur"
          : "border-white/80 bg-white/90 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={cx("text-[10px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>{label}</div>
        <div className={cx("flex h-9 w-9 items-center justify-center rounded-2xl", isDarkMode ? "bg-white/[0.06] text-slate-100" : "bg-slate-100 text-slate-700")}>{icon}</div>
      </div>
      <div className={cx("mt-3 text-[1.45rem] font-semibold tracking-[-0.05em]", isDarkMode ? "text-white" : "text-slate-950")}>{value}</div>
    </div>
  )
}

function FilterButton({ filter, isSelected, isDarkMode = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-3.5 text-left transition",
        isSelected
          ? (sourceStyles[filter.key] || sourceStyles.all).active
          : isDarkMode
            ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.06]"
            : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", isSelected ? "bg-white/15 text-white" : isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>{filter.icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{filter.label}</span>
          <span className={cx("mt-0.5 block truncate text-xs", isSelected ? "text-white/75" : isDarkMode ? "text-slate-400" : "text-slate-500")}>{filter.description}</span>
        </span>
      </span>
      <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", isSelected ? "bg-white/15 text-white" : isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-slate-100 text-slate-600")}>{filter.count}</span>
    </button>
  )
}

function MobileFilterPill({ filter, isSelected, isDarkMode = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold",
        isSelected
          ? (sourceStyles[filter.key] || sourceStyles.all).active
          : isDarkMode
            ? "border-white/10 bg-white/[0.05] text-slate-200"
            : "border-slate-200 bg-white text-slate-700"
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cx("flex h-6 w-6 items-center justify-center rounded-full", isSelected ? "bg-white/15 text-white" : isDarkMode ? "bg-white/[0.06]" : "bg-slate-100")}>
          {filter.icon}
        </span>
        {filter.label}
        <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", isSelected ? "bg-white/15 text-white" : isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-slate-100 text-slate-600")}>
          {filter.count}
        </span>
      </span>
    </button>
  )
}

function DocumentCard({ title, meta, sourceLabel, icon, emoji, onOpen, onPreview, onAdd, extraAction, badgeClass, isDarkMode = false, isCompact = false }) {
  const handlePreview = () => {
    if (typeof onPreview === "function") onPreview()
    else if (typeof onOpen === "function") onOpen()
  }
  const handleKeyboardPreview = event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handlePreview()
    }
  }
  const handleOpen = event => {
    event.stopPropagation()
    if (typeof onOpen === "function") onOpen()
  }
  const handleAdd = event => {
    event.stopPropagation()
    if (typeof onAdd === "function") onAdd()
  }
  const safeMeta = typeof meta === "string" ? meta.replaceAll("Â·", "|").replaceAll("·", "|") : meta

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handlePreview}
      onKeyDown={handleKeyboardPreview}
      className={cx("group flex h-full cursor-pointer flex-col border p-4 transition focus:outline-none focus:ring-2 focus:ring-sky-400/50", isCompact ? "rounded-[24px]" : "rounded-[26px]", isDarkMode ? "border-white/10 bg-white/[0.04] hover:border-sky-400/20 hover:bg-white/[0.05]" : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className={cx("flex shrink-0 items-center justify-center border", isCompact ? "h-12 w-12 rounded-[18px]" : "h-14 w-14 rounded-[20px]", isDarkMode ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-slate-50")}>
            {icon ? <SmartImage src={icon} alt="" className={cx("object-contain", isCompact ? "h-7 w-7" : "h-8 w-8")} fallback={<span className={isCompact ? "text-xl" : "text-2xl"}>{emoji}</span>} /> : <span className={isCompact ? "text-xl" : "text-2xl"}>{emoji}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className={cx(isCompact ? "line-clamp-2 text-[0.98rem] font-semibold leading-6" : "line-clamp-2 text-[1rem] font-semibold leading-6", isDarkMode ? "text-slate-100" : "text-slate-900")}>{title}</div>
            <div className={cx(isCompact ? "mt-1.5 line-clamp-2 text-[13px] leading-5" : "mt-2 line-clamp-2 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>{safeMeta}</div>
          </div>
        </div>
        <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", badgeClass)}>{sourceLabel}</span>
      </div>

      <div className={cx("flex items-center justify-between gap-3", isCompact ? "mt-4" : "mt-5")}>
        <button onClick={handleOpen} className={cx("inline-flex items-center gap-2 rounded-full text-sm font-semibold transition", isDarkMode ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900")}>
          Open file
          <ArrowUpRight className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {extraAction && <span onClick={event => event.stopPropagation()}>{extraAction}</span>}
          <button onClick={handleAdd} className={cx("inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition", isDarkMode ? "bg-sky-400/12 text-sky-200 hover:bg-sky-400/18" : "bg-sky-100 text-sky-700 hover:bg-sky-200")} title="Add to message">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </article>
  )
}

function EmptyState({ title, description, isDarkMode = false }) {
  return (
    <div className={cx("flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed px-6 py-14 text-center", isDarkMode ? "border-white/10 bg-white/[0.03]" : "border-slate-200/80 bg-white/80")}>
      <div className="max-w-md">
        <div className={cx("mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px]", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-slate-100 text-slate-500")}>
          <FolderOpen className="h-9 w-9" />
        </div>
        <h3 className={cx("mt-5 text-[1.6rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>{title}</h3>
        <p className={cx("mt-3 text-sm leading-7", isDarkMode ? "text-slate-400" : "text-slate-500")}>{description}</p>
      </div>
    </div>
  )
}

const normalizeGmailDoc = attachment => {
  if (!attachment) return null
  const attachmentId = attachment.attachmentId || attachment.gmailAttachmentId || attachment.id
  const messageId = attachment.messageId || attachment.gmailMessageId
  const senderEmail = attachment.senderEmail || attachment.from || "unknown"
  const senderName = attachment.senderName || senderEmail
  const emailDateMs = Number(attachment.emailDateMs || attachment.internalDate || attachment.date || 0)
  const filename = attachment.filename || attachment.name || "Attachment"
  const normalizedFileName = attachment.normalizedFileName || GoogleService.normalizeGmailFilename(filename)
  return {
    ...attachment,
    id: attachmentId,
    attachmentId,
    gmailAttachmentId: attachmentId,
    messageId,
    gmailMessageId: messageId,
    threadId: attachment.threadId || null,
    filename,
    name: attachment.name || attachment.filename || "Attachment",
    normalizedFileName,
    mimeType: attachment.mimeType || attachment.type || "application/octet-stream",
    size: Number(attachment.size || 0),
    senderName,
    senderEmail,
    subject: attachment.subject || attachment.emailSubject || "No subject",
    emailDate: attachment.emailDate || attachment.date || attachment.internalDate || null,
    emailDateMs,
    source: "gmail",
  }
}

export default function DocumentsHub(props) {
  const {
    isDarkMode = false,
    googleAccessToken,
    loadingDocs,
    docsError,
    selectedAppFilter,
    docsOverview,
    docsCollectionSummary,
    googleDocs = [],
    sortedGoogleDocs = [],
    sharedChatDocs = [],
    gmailAttachments = [],
    formatDocsDate,
    formatDocsSize,
    onBackHome,
    onConnectGoogle,
    onReconnectGoogle,
    onRefresh,
    onOpenConnections,
    onSelectFilter,
    onOpenAttachment,
    onAddDocument,
  } = props

  const shouldShowReconnect = typeof docsError === "string" && /invalid|expired|reconnect/i.test(docsError)

  const overview = {
    total: docsOverview?.total || 0,
    drive: docsOverview?.drive || 0,
    shared: docsOverview?.shared || 0,
    gmail: docsOverview?.gmail || 0,
  }

  const collectionSummary = {
    label: docsCollectionSummary?.label || "Library",
    detail: docsCollectionSummary?.detail || "A cleaner library surface for your workspace documents.",
    count: docsCollectionSummary?.count || 0,
  }

  const [gmailSearch, setGmailSearch] = useState("")

  const displayedGmailAttachments = useMemo(() => {
    const normalized = Array.isArray(gmailAttachments)
      ? GoogleService.dedupeGmailAttachmentsByFilename(gmailAttachments).map(normalizeGmailDoc).filter(Boolean)
      : []
    const term = selectedAppFilter === "gmail" ? gmailSearch.trim().toLowerCase() : ""
    const filtered = term
      ? normalized.filter(attachment => [
        attachment.senderName,
        attachment.senderEmail,
        attachment.subject,
        attachment.filename,
      ].some(value => String(value || "").toLowerCase().includes(term)))
      : normalized

    return filtered.sort((a, b) => Number(b.emailDateMs || b.internalDate || b.date || 0) - Number(a.emailDateMs || a.internalDate || a.date || 0))
  }, [gmailAttachments, gmailSearch, selectedAppFilter])

  const gmailSearchSummary = useMemo(() => {
    const term = gmailSearch.trim()
    if (!term) return "Search by sender email, sender name, subject, or filename."
    return `${displayedGmailAttachments.length} Gmail attachment${displayedGmailAttachments.length === 1 ? "" : "s"} matched "${term}".`
  }, [displayedGmailAttachments.length, gmailSearch])

  const shouldShowGmailSearch = selectedAppFilter === "gmail"

  const renderGmailSearch = () => (
    <div className={cx("mb-5 rounded-[24px] border p-3", isDarkMode ? "border-white/10 bg-white/[0.035]" : "border-slate-200/80 bg-slate-50/80")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className={cx("flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border px-4", isDarkMode ? "border-white/10 bg-[#101620] text-slate-300" : "border-slate-200 bg-white text-slate-500")}>
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={gmailSearch}
            onChange={event => setGmailSearch(event.target.value)}
            placeholder="Search Gmail docs by email, sender, subject, or filename"
            className={cx("w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-inherit", isDarkMode ? "text-slate-100" : "text-slate-900")}
          />
        </label>
        <span className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-white text-slate-600")}>
          Latest files first
        </span>
      </div>
      <p className={cx("mt-2 px-2 text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{gmailSearchSummary}</p>
    </div>
  )

  const filters = useMemo(() => {
    const allGoogleDocs = Array.isArray(googleDocs) ? googleDocs : []
    const docsCount = allGoogleDocs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === "docs").length
    const sheetsCount = allGoogleDocs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === "sheets").length
    const slidesCount = allGoogleDocs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === "slides").length

    const base = [
      { key: "all", label: "All files", description: "Everything in one professional browser", count: overview.total, icon: <Grid3x3 className="h-4 w-4" /> },
      { key: "drive", label: "Drive", description: "Drive files and synced workspace docs", count: overview.drive, icon: <SmartImage src="/google-drive.png" alt="Drive" className="h-4 w-4" /> },
      { key: "shared", label: "Shared", description: "Files already circulating in chat", count: overview.shared, icon: <SmartImage src="/shared.png.png" alt="Shared" className="h-4 w-4" /> },
      { key: "gmail", label: "Gmail", description: "Email attachments ready to reuse", count: overview.gmail, icon: <SmartImage src="/gmail.png" alt="Gmail" className="h-4 w-4" /> },
    ]

    if (docsCount > 0) base.splice(2, 0, { key: "docs", label: "Docs", description: "Collaborative text docs", count: docsCount, icon: <SmartImage src="/google-docs.png" alt="Docs" className="h-4 w-4" /> })
    if (sheetsCount > 0) base.splice(base.length - 1, 0, { key: "sheets", label: "Sheets", description: "Structured data and trackers", count: sheetsCount, icon: <SmartImage src="/google-sheets.png" alt="Sheets" className="h-4 w-4" /> })
    if (slidesCount > 0) base.splice(base.length - 1, 0, { key: "slides", label: "Slides", description: "Decks and presentation files", count: slidesCount, icon: <SmartImage src="/slides.png" alt="Slides" className="h-4 w-4" /> })

    return base
  }, [googleDocs, overview.drive, overview.gmail, overview.shared, overview.total])

  const overviewCards = useMemo(
    () => [
      { label: "Total assets", value: overview.total, note: "Everything accessible in the workspace library.", icon: <Sparkles className="h-5 w-5" /> },
      { label: "Workspace docs", value: overview.drive, note: "Drive, Docs, Sheets, and Slides in one stream.", icon: <FileText className="h-5 w-5" /> },
      { label: "Shared in chat", value: overview.shared, note: "Files teammates already passed through conversations.", icon: <FolderOpen className="h-5 w-5" /> },
      { label: "Gmail ready", value: overview.gmail, note: "Attachments staged for quick reuse.", icon: <Mail className="h-5 w-5" /> },
    ],
    [overview.drive, overview.gmail, overview.shared, overview.total]
  )

  const sections = useMemo(() => {
    const nextSections = []

    const makeSharedItem = (attachment, index, label = "Shared") => {
      const appType = GoogleService.getAppTypeFromMime(attachment.mimeType || attachment.type)
      const appIcon = GoogleService.getAppIcon(appType)

      return {
        id: attachment.id || `${attachment.name}-${index}`,
        title: attachment.name || "Attachment",
        meta: `${attachment.source === "drive" ? "Drive" : attachment.source === "gmail" ? "Gmail" : "Chat"} · ${attachment.timestamp ? formatDocsDate(attachment.timestamp) : "No recent activity"}`,
        sourceLabel: label,
        icon: attachment.iconLink || appIcon.iconUrl,
        emoji: appIcon.emoji,
        onPreview: () => onOpenAttachment(attachment),
        onOpen: () => onOpenAttachment(attachment),
        onAdd: () => onAddDocument({
          id: attachment.id,
          name: attachment.name,
          mimeType: attachment.mimeType,
          url: attachment.url || attachment.webViewLink,
          source: attachment.source || "chat",
          gmailMessageId: attachment.gmailMessageId,
          gmailAttachmentId: attachment.gmailAttachmentId,
        }),
      }
    }

    if (selectedAppFilter === "shared") {
      nextSections.push({
        key: "shared-only",
        title: "Shared files",
        description: "Workspace attachments already active in direct messages and channel threads.",
        badgeClass: isDarkMode ? sourceStyles.shared.dark : sourceStyles.shared.light,
        items: sharedChatDocs.map((attachment, index) => makeSharedItem(attachment, index)),
      })
    }

    if ((selectedAppFilter === "all" || selectedAppFilter === "drive" || selectedAppFilter === "docs" || selectedAppFilter === "sheets" || selectedAppFilter === "slides") && googleDocs.length > 0) {
      nextSections.push({
        key: "workspace",
        title: "Workspace files",
        description: "Recently updated files from Drive and the connected Google Workspace stack.",
        badgeClass: isDarkMode ? sourceStyles.drive.dark : sourceStyles.drive.light,
        items: sortedGoogleDocs.map(doc => {
          const appType = GoogleService.getAppTypeFromMime(doc.mimeType)
          const appIcon = GoogleService.getAppIcon(appType)
          const sourceKey = appType === "docs" || appType === "sheets" || appType === "slides" ? appType : "drive"
          const palette = sourceStyles[sourceKey] || sourceStyles.drive

          return {
            id: doc.id,
            title: doc.name,
            meta: `${formatDocsDate(doc.modifiedTime)} · ${formatDocsSize(doc.size)}`,
            sourceLabel: sourceKey === "drive" ? "Drive" : sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1),
            icon: doc.iconLink || appIcon.iconUrl,
            emoji: appIcon.emoji,
            badgeClass: isDarkMode ? palette.dark : palette.light,
            onPreview: () => onOpenAttachment({ ...doc, source: "drive" }),
            onOpen: () => openInNewTab(doc.webViewLink),
            onAdd: () => onAddDocument(doc),
            extraAction: (
              <button onClick={() => openInNewTab(doc.webViewLink)} className={cx("inline-flex h-10 w-10 items-center justify-center rounded-full transition", isDarkMode ? "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200")} title="Open in Google Workspace">
                <ArrowUpRight className="h-4 w-4" />
              </button>
            ),
          }
        }),
      })
    }

    if (selectedAppFilter === "all" && sharedChatDocs.length > 0) {
      nextSections.push({
        key: "shared",
        title: "Shared in chats",
        description: "Conversation-ready files that teammates already dropped into the workspace.",
        badgeClass: isDarkMode ? sourceStyles.shared.dark : sourceStyles.shared.light,
        items: sharedChatDocs.map((attachment, index) => makeSharedItem(attachment, index)),
      })
    }

    if ((selectedAppFilter === "all" || selectedAppFilter === "gmail") && displayedGmailAttachments.length > 0) {
      nextSections.push({
        key: "gmail",
        title: "Gmail attachments",
        description: "Recent email files that can move directly into workspace conversations.",
        badgeClass: isDarkMode ? sourceStyles.gmail.dark : sourceStyles.gmail.light,
        items: displayedGmailAttachments.map((attachment, index) => {
          const appType = GoogleService.getAppTypeFromMime(attachment.mimeType)
          const appIcon = GoogleService.getAppIcon(appType)
          const emailUrl = `https://mail.google.com/mail/u/0/#inbox/${attachment.messageId}`

          return {
            id: `gmail-${attachment.messageId}-${attachment.id}-${index}`,
            title: attachment.filename,
            meta: `${attachment.senderName || "Unknown sender"} · ${formatDocsSize(attachment.size)}`,
            sourceLabel: "Gmail",
            icon: appIcon.iconUrl,
            emoji: appIcon.emoji,
            onPreview: () => onOpenAttachment({
              id: attachment.id,
              name: attachment.filename,
              mimeType: attachment.mimeType,
              size: attachment.size,
              source: "gmail",
              gmailMessageId: attachment.messageId,
              gmailAttachmentId: attachment.id,
              webViewLink: emailUrl,
            }),
            onOpen: () => openInNewTab(emailUrl),
            onAdd: () => onAddDocument({
              id: attachment.id,
              name: attachment.filename,
              mimeType: attachment.mimeType,
              size: attachment.size,
              source: "gmail",
              gmailMessageId: attachment.messageId,
              gmailAttachmentId: attachment.id,
              webViewLink: emailUrl,
            }),
            extraAction: (
              <button onClick={() => openInNewTab(emailUrl)} className={cx("inline-flex h-10 w-10 items-center justify-center rounded-full transition", isDarkMode ? "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200")} title="Open email">
                <Mail className="h-4 w-4" />
              </button>
            ),
          }
        }),
      })
    }

    return nextSections
  }, [selectedAppFilter, isDarkMode, sharedChatDocs, googleDocs.length, sortedGoogleDocs, displayedGmailAttachments, formatDocsDate, formatDocsSize, onOpenAttachment, onAddDocument])

  return (
    <div className={cx("h-full min-h-0 w-full overflow-y-auto", isDarkMode ? "bg-[#0f1115] text-slate-100" : "bg-[#f4f6fa] text-slate-900")}>
      <div className="relative isolate min-h-full">
        <div className="relative px-4 py-4 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          <div className="flex flex-col gap-6">
            <div className="hidden flex-wrap items-center gap-3 md:flex">
              {typeof onBackHome === "function" && (
                <button
                  onClick={onBackHome}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    isDarkMode
                      ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                      : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-white"
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}

              {googleAccessToken && typeof onRefresh === "function" && (
                <button
                  onClick={onRefresh}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    isDarkMode
                      ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                      : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-white"
                  )}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              )}

              {googleAccessToken && typeof onOpenConnections === "function" && (
                <button
                  onClick={onOpenConnections}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    isDarkMode
                      ? "border-sky-400/20 bg-sky-400/10 text-sky-200 hover:bg-sky-400/15"
                      : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Connect Apps
                </button>
              )}
            </div>
            {!googleAccessToken ? (
              <SurfaceCard isDarkMode={isDarkMode}>
                <div className="px-6 py-12 text-center sm:px-8">
                  <div className={cx("mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] border", isDarkMode ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300" : "border-cyan-100 bg-cyan-50 text-sky-700")}>
                    <FileText className="h-11 w-11" />
                  </div>
                  <h2 className={cx("mt-6 text-[2rem] font-semibold tracking-[-0.05em]", isDarkMode ? "text-white" : "text-slate-900")}>Connect your Google account</h2>
                  <p className={cx("mx-auto mt-4 max-w-2xl text-[15px] leading-8", isDarkMode ? "text-slate-300" : "text-slate-600")}>Bring Drive files and Gmail attachments into one polished library surface, then reuse documents across chats without bouncing between tools.</p>
                  <button onClick={onConnectGoogle} className="mx-auto mt-8 inline-flex items-center gap-3 rounded-full bg-sky-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(14,165,233,0.24)] transition hover:bg-sky-700"><Plus className="h-5 w-5" />Connect Google Account</button>
                </div>
              </SurfaceCard>
            ) : loadingDocs ? (
              <SurfaceCard isDarkMode={isDarkMode}>
                <div className="flex min-h-[52vh] items-center justify-center px-6 py-10">
                  <div className="text-center">
                    <div className={cx("mx-auto h-14 w-14 animate-spin rounded-full border-2 border-transparent border-t-current", isDarkMode ? "text-sky-400" : "text-sky-600")} />
                    <p className={cx("mt-5 text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>Loading your documents...</p>
                  </div>
                </div>
              </SurfaceCard>
            ) : docsError ? (
              <SurfaceCard isDarkMode={isDarkMode}>
                <div className={cx("px-6 py-12 text-center", isDarkMode ? "bg-red-500/8" : "bg-red-50/70")}>
                  <div className={cx("mx-auto flex h-16 w-16 items-center justify-center rounded-[22px]", isDarkMode ? "bg-red-500/12 text-red-300" : "bg-red-100 text-red-600")}>
                    <RefreshCw className="h-7 w-7" />
                  </div>
                  <h2 className={cx("mt-5 text-[1.7rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>We couldn't load the library</h2>
                  <p className={cx("mx-auto mt-3 max-w-2xl text-[15px] leading-8", isDarkMode ? "text-slate-300" : "text-slate-600")}>{docsError}</p>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    {shouldShowReconnect && (
                      <button onClick={onReconnectGoogle || onConnectGoogle} className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700">
                        <Plus className="h-4 w-4" />
                        Reconnect Google
                      </button>
                    )}
                    <button onClick={onRefresh} className={cx("inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition", shouldShowReconnect ? (isDarkMode ? "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "bg-white text-slate-700 hover:bg-slate-100") : "bg-sky-600 text-white hover:bg-sky-700")}>
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </button>
                  </div>
                </div>
              </SurfaceCard>
            ) : (
              <>
                <section className="md:hidden">
                  <div className="flex flex-col gap-4">
                    <div
                      className={cx(
                        "overflow-hidden rounded-[30px] border px-4 py-4",
                        isDarkMode
                          ? "border-white/10 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.2),_transparent_52%),linear-gradient(180deg,#121821_0%,#0d131a_100%)]"
                          : "border-white/80 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_52%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {typeof onBackHome === "function" && (
                            <button
                              onClick={onBackHome}
                              className={cx(
                                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border backdrop-blur",
                                isDarkMode ? "border-white/10 bg-white/[0.06] text-slate-100" : "border-white/90 bg-white/90 text-slate-700"
                              )}
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className={cx("text-[11px] font-semibold uppercase tracking-[0.24em]", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                              Mobile Library
                            </div>
                            <h1 className={cx("mt-2 text-[1.7rem] font-semibold tracking-[-0.05em]", isDarkMode ? "text-white" : "text-slate-950")}>
                              Docs
                            </h1>
                            <p className={cx("mt-2 max-w-md text-sm leading-6", isDarkMode ? "text-slate-300" : "text-slate-600")}>
                              Browse workspace files, jump sources quickly, and attach documents without leaving the phone flow.
                            </p>
                          </div>
                        </div>

                        <div className={cx("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.08] text-slate-100" : "bg-slate-900 text-white")}>
                          {collectionSummary.count} files
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {googleAccessToken && typeof onRefresh === "function" && (
                          <button
                            onClick={onRefresh}
                            className={cx(
                              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold",
                              isDarkMode ? "border-white/10 bg-white/[0.06] text-slate-200" : "border-white/90 bg-white/90 text-slate-700"
                            )}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                          </button>
                        )}
                        {googleAccessToken && typeof onOpenConnections === "function" && (
                          <button
                            onClick={onOpenConnections}
                            className={cx(
                              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold",
                              isDarkMode ? "border-sky-400/20 bg-sky-400/12 text-sky-200" : "border-sky-200 bg-sky-50 text-sky-700"
                            )}
                          >
                            <Plus className="h-4 w-4" />
                            Connect Apps
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <MobileMetricCard label="All files" value={overview.total} icon={<Sparkles className="h-4 w-4" />} isDarkMode={isDarkMode} />
                      <MobileMetricCard label="Workspace" value={overview.drive} icon={<FileText className="h-4 w-4" />} isDarkMode={isDarkMode} />
                      <MobileMetricCard label="Shared" value={overview.shared} icon={<FolderOpen className="h-4 w-4" />} isDarkMode={isDarkMode} />
                      <MobileMetricCard label="Gmail" value={overview.gmail} icon={<Mail className="h-4 w-4" />} isDarkMode={isDarkMode} />
                    </div>

                    <SurfaceCard isDarkMode={isDarkMode}>
                      <div className="px-4 py-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                              Sources
                            </div>
                            <h2 className={cx("mt-2 text-lg font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>
                              Jump between collections
                            </h2>
                          </div>
                          <span className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>
                            {selectedAppFilter}
                          </span>
                        </div>

                        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {filters.map(filter => (
                            <MobileFilterPill
                              key={filter.key}
                              filter={filter}
                              isSelected={selectedAppFilter === filter.key}
                              isDarkMode={isDarkMode}
                              onClick={() => onSelectFilter(filter.key)}
                            />
                          ))}
                        </div>
                      </div>
                    </SurfaceCard>

                    <SurfaceCard isDarkMode={isDarkMode}>
                      <div className={cx("border-b px-4 py-4", isDarkMode ? "border-white/10" : "border-slate-200/80")}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                              Active Collection
                            </div>
                            <h2 className={cx("mt-2 text-[1.2rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>
                              {collectionSummary.label}
                            </h2>
                            <p className={cx("mt-2 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                              {collectionSummary.detail}
                            </p>
                          </div>
                          <span className={cx("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-cyan-400/10 text-cyan-200" : "bg-cyan-50 text-cyan-700")}>
                            {collectionSummary.count} visible
                          </span>
                        </div>
                      </div>

                      <div className="px-4 py-4">
                        {shouldShowGmailSearch && renderGmailSearch()}
                        {sections.length === 0 ? (
                          <EmptyState title="No documents in this collection" description="Try a different source or reconnect Google to surface files here." isDarkMode={isDarkMode} />
                        ) : (
                          <div className="space-y-5">
                            {sections.map(section => (
                              <div key={section.key}>
                                <div className="mb-3 flex items-end justify-between gap-3">
                                  <div>
                                    <h3 className={cx("text-[1.05rem] font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>{section.title}</h3>
                                    <p className={cx("mt-1 text-[13px] leading-5", isDarkMode ? "text-slate-400" : "text-slate-500")}>{section.description}</p>
                                  </div>
                                  <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", section.badgeClass)}>{section.items.length}</span>
                                </div>
                                <div className="space-y-3">
                                  {section.items.map(item => (
                                    <DocumentCard
                                      key={item.id}
                                      title={item.title}
                                      meta={item.meta}
                                      sourceLabel={item.sourceLabel}
                                      icon={item.icon}
                                      emoji={item.emoji}
                                      onPreview={item.onPreview}
                                      onOpen={item.onOpen}
                                      onAdd={item.onAdd}
                                      extraAction={item.extraAction}
                                      badgeClass={item.badgeClass || section.badgeClass}
                                      isDarkMode={isDarkMode}
                                      isCompact
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SurfaceCard>
                  </div>
                </section>

                <div className="hidden gap-6 md:grid xl:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="space-y-5 xl:sticky xl:top-6 xl:h-fit">
                    <SurfaceCard isDarkMode={isDarkMode}>
                      <div className="px-5 py-5">
                        <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Collections</div>
                        <h2 className={cx("mt-2 text-[1.45rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>Browse by source</h2>
                        <p className={cx("mt-2 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>Switch between document sources without losing the larger workspace context.</p>
                        <div className="mt-5 space-y-3">
                          {filters.map(filter => (
                            <FilterButton key={filter.key} filter={filter} isSelected={selectedAppFilter === filter.key} isDarkMode={isDarkMode} onClick={() => onSelectFilter(filter.key)} />
                          ))}
                        </div>
                      </div>
                    </SurfaceCard>

                    <SurfaceCard isDarkMode={isDarkMode}>
                      <div className="px-5 py-5">
                        <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Library pulse</div>
                        <h3 className={cx("mt-2 text-[1.35rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-900")}>Quick totals</h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          {overviewCards.map(card => <MetricCard key={card.label} label={card.label} value={card.value} note={card.note} icon={card.icon} isDarkMode={isDarkMode} />)}
                        </div>
                      </div>
                    </SurfaceCard>
                  </aside>

                  <main className="min-w-0 space-y-5">
                    <SurfaceCard isDarkMode={isDarkMode}>
                      <div className={cx("border-b px-5 py-5 sm:px-6", isDarkMode ? "border-white/10" : "border-slate-200/80")}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="min-w-0">
                            <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Active collection</div>
                            <h2 className={cx("mt-2 text-[1.9rem] font-semibold tracking-[-0.05em]", isDarkMode ? "text-white" : "text-slate-900")}>{collectionSummary.label}</h2>
                            <p className={cx("mt-2 max-w-3xl text-sm leading-7", isDarkMode ? "text-slate-400" : "text-slate-500")}>{collectionSummary.detail}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cx("inline-flex rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>{collectionSummary.count} visible</span>
                            <span className={cx("inline-flex rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-cyan-400/10 text-cyan-200" : "bg-cyan-50 text-cyan-700")}>Full-page browser</span>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-5 sm:px-6">
                        {shouldShowGmailSearch && renderGmailSearch()}
                        {sections.length === 0 ? (
                          <EmptyState title="No documents in this collection" description="Try a different source, reconnect Google, or wait for files to sync into the library." isDarkMode={isDarkMode} />
                        ) : (
                          <div className="space-y-6">
                            {sections.map(section => (
                              <div key={section.key}>
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                  <div>
                                    <h3 className={cx("text-[1.25rem] font-semibold tracking-[-0.03em]", isDarkMode ? "text-white" : "text-slate-900")}>{section.title}</h3>
                                    <p className={cx("mt-1 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>{section.description}</p>
                                  </div>
                                  <span className={cx("inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold", section.badgeClass)}>{section.items.length} items</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                  {section.items.map(item => <DocumentCard key={item.id} title={item.title} meta={item.meta} sourceLabel={item.sourceLabel} icon={item.icon} emoji={item.emoji} onPreview={item.onPreview} onOpen={item.onOpen} onAdd={item.onAdd} extraAction={item.extraAction} badgeClass={item.badgeClass || section.badgeClass} isDarkMode={isDarkMode} />)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </SurfaceCard>
                  </main>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
