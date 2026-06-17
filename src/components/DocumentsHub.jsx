import React, { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Grid3x3,
  LayoutGrid,
  List,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
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

const cleanMeta = value =>
  typeof value === "string"
    ? value.replace(/\u00c3\u201a\u00c2\u00b7|\u00c2\u00b7|\u00b7/g, "|")
    : value

function SurfaceCard({ children, className = "", isDarkMode = false }) {
  return (
    <section className={cx("overflow-hidden rounded-lg border", isDarkMode ? "border-[#252b33] bg-[#11161c]" : "border-slate-200 bg-white", className)}>
      {children}
    </section>
  )
}

function CollectionButton({ label, count, isSelected, isDarkMode = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-sm font-semibold transition",
        isSelected
          ? isDarkMode
            ? "bg-white/[0.08] text-white"
            : "bg-white text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
          : isDarkMode
            ? "text-slate-300 hover:bg-white/[0.06]"
            : "text-slate-600 hover:bg-white/60"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <FolderOpen className={cx("h-4 w-4 shrink-0", isSelected ? "text-sky-600" : isDarkMode ? "text-slate-500" : "text-slate-400")} />
        <span className="truncate">{label}</span>
      </span>
      <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px]", isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-slate-100 text-slate-600")}>{count}</span>
    </button>
  )
}

function LibrarySnapshot({ overview, isDarkMode = false }) {
  const items = [
    { label: "Total files", value: overview.total },
    { label: "Workspace", value: overview.drive },
    { label: "Shared", value: overview.shared },
  ]

  return (
    <div className={cx("rounded-[14px] border p-4", isDarkMode ? "border-white/10 bg-white/[0.045]" : "border-white/70 bg-white/72 shadow-[0_12px_24px_rgba(15,23,42,0.05)]")}>
      <div className={cx("text-[11px] font-bold uppercase", isDarkMode ? "text-slate-400" : "text-slate-500")}>Library snapshot</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {items.map(item => (
          <div key={item.label} className="min-w-0">
            <div className={cx("text-base font-bold leading-none", isDarkMode ? "text-white" : "text-slate-900")}>{item.value}</div>
            <div className={cx("mt-1 truncate text-[10px] font-semibold", isDarkMode ? "text-slate-500" : "text-slate-500")}>{item.label}</div>
          </div>
        ))}
      </div>
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
        "workspace-dedicated-sidebar-row flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition",
        isSelected
          ? `is-active ${(sourceStyles[filter.key] || sourceStyles.all).active}`
          : isDarkMode
            ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.06]"
            : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cx("workspace-dedicated-sidebar-row-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-md", isSelected ? "bg-white/15 text-white" : isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>{filter.icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{filter.label}</span>
          <span className={cx("workspace-dedicated-sidebar-row-meta mt-0.5 block truncate text-[11px]", isSelected ? "text-white/75" : isDarkMode ? "text-slate-400" : "text-slate-500")}>{filter.description}</span>
        </span>
      </span>
      <span className={cx("workspace-dedicated-sidebar-count rounded-full px-2.5 py-1 text-[11px] font-semibold", isSelected ? "bg-white/15 text-white" : isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-slate-100 text-slate-600")}>{filter.count}</span>
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

function DocumentCard({ title, meta, sourceLabel, icon, emoji, onOpen, onPreview, onAdd, extraAction, badgeClass, isDarkMode = false }) {
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
  const safeMeta = typeof meta === "string" ? cleanMeta(meta) : meta

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handlePreview}
      onKeyDown={handleKeyboardPreview}
      className={cx(
        "group grid cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition focus:outline-none focus:ring-2 focus:ring-sky-400/50 md:grid-cols-[minmax(0,1fr)_96px_150px]",
        isDarkMode ? "border-[#252b33] bg-[#151a20] hover:border-[#343c47] hover:bg-[#171d24]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <div className="flex min-w-0 items-center gap-3 text-left">
        <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", isDarkMode ? "border-[#252b33] bg-white/[0.05]" : "border-slate-200 bg-slate-50")}>
          {icon ? <SmartImage src={icon} alt="" className="h-6 w-6 object-contain" fallback={<span className="text-lg">{emoji}</span>} /> : <span className="text-lg">{emoji}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cx("truncate text-sm font-semibold leading-5", isDarkMode ? "text-slate-100" : "text-slate-900")} title={title}>{title}</div>
          <div className={cx("mt-1 truncate text-xs leading-5", isDarkMode ? "text-slate-400" : "text-slate-500")}>{safeMeta}</div>
        </div>
      </div>

      <span className={cx("w-fit rounded-md px-2 py-1 text-[11px] font-semibold", badgeClass)}>{sourceLabel}</span>

      <div className="flex items-center gap-2 md:justify-end">
        <button onClick={handleOpen} className={cx("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition", isDarkMode ? "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
          Open
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        {extraAction && <span onClick={event => event.stopPropagation()}>{extraAction}</span>}
        <button onClick={handleAdd} className={cx("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition", isDarkMode ? "bg-sky-400/12 text-sky-200 hover:bg-sky-400/18" : "bg-sky-100 text-sky-700 hover:bg-sky-200")} title="Add to message">
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </article>
  )
}

function EmptyState({ title, description, isDarkMode = false }) {
  return (
    <div className={cx("flex min-h-[220px] items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center", isDarkMode ? "border-[#252b33] bg-[#151a20]" : "border-slate-200 bg-slate-50")}>
      <div className="max-w-md">
        <div className={cx("mx-auto flex h-11 w-11 items-center justify-center rounded-lg", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-500")}>
          <FolderOpen className="h-5 w-5" />
        </div>
        <h3 className={cx("mt-4 text-base font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>{title}</h3>
        <p className={cx("mt-2 text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-500")}>{description}</p>
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
    onRefresh,
    onSelectFilter,
    onOpenAttachment,
    onAddDocument,
    embedded = false,
  } = props

  const overview = {
    total: docsOverview?.total || 0,
    drive: docsOverview?.drive || 0,
    docs: docsOverview?.docs || 0,
    sheets: docsOverview?.sheets || 0,
    slides: docsOverview?.slides || 0,
    shared: docsOverview?.shared || 0,
    gmail: docsOverview?.gmail || 0,
  }

  const collectionSummary = {
    label: docsCollectionSummary?.label || "Library",
    detail: docsCollectionSummary?.detail || "A cleaner library surface for your workspace documents.",
    count: docsCollectionSummary?.count || 0,
  }

  const [gmailSearch, setGmailSearch] = useState("")
  const [librarySearch, setLibrarySearch] = useState("")
  const [collectionFilter, setCollectionFilter] = useState("all")
  const [viewMode, setViewMode] = useState("list")

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
    <div className={cx("rounded-lg border p-3", isDarkMode ? "border-white/10 bg-white/[0.035]" : "border-slate-200/80 bg-slate-50/80")}>
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
      { key: "all", label: "All files", description: "Every connected file source", count: overview.total, icon: <Grid3x3 className="h-4 w-4" /> },
      { key: "drive", label: "Google Drive", description: "Drive files and folders", count: overview.drive, icon: <SmartImage src="/google%20drive.png" alt="Google Drive" className="h-4 w-4" /> },
      { key: "docs", label: "Google Docs", description: "Documents and written work", count: docsCount || overview.docs, icon: <SmartImage src="/google%20docs.png" alt="Google Docs" className="h-4 w-4" /> },
      { key: "gmail", label: "Gmail", description: "Email attachments", count: overview.gmail, icon: <SmartImage src="/gmail%20(1).png" alt="Gmail" className="h-4 w-4" /> },
      { key: "shared", label: "Shared files", description: "Files from chats", count: overview.shared, icon: <SmartImage src="/shared.png.png" alt="Shared" className="h-4 w-4" /> },
      { key: "sheets", label: "Google Sheets", description: "Sheets and trackers", count: sheetsCount || overview.sheets, icon: <SmartImage src="/google%20sheets.png" alt="Google Sheets" className="h-4 w-4" /> },
      { key: "slides", label: "Google Slides", description: "Decks and presentations", count: slidesCount || overview.slides, icon: <SmartImage src="/google%20slides.png" alt="Google Slides" className="h-4 w-4" /> },
    ]

    return base
  }, [googleDocs, overview.docs, overview.drive, overview.gmail, overview.shared, overview.sheets, overview.slides, overview.total])

  const sourceFilteredGoogleDocs = useMemo(() => {
    const docs = Array.isArray(sortedGoogleDocs) ? sortedGoogleDocs : []
    if (selectedAppFilter === "docs" || selectedAppFilter === "sheets" || selectedAppFilter === "slides") {
      return docs.filter(doc => GoogleService.getAppTypeFromMime(doc.mimeType) === selectedAppFilter)
    }
    if (selectedAppFilter === "drive") {
      return docs.filter(doc => !["docs", "sheets", "slides"].includes(GoogleService.getAppTypeFromMime(doc.mimeType)))
    }
    return docs
  }, [selectedAppFilter, sortedGoogleDocs])

  const sections = useMemo(() => {
    const nextSections = []

    const makeSharedItem = (attachment, index, label = "Shared") => {
      const appType = GoogleService.getAppTypeFromMime(attachment.mimeType || attachment.type)
      const appIcon = GoogleService.getAppIcon(appType)
      const modifiedLabel = attachment.timestamp ? formatDocsDate(attachment.timestamp) : "No recent activity"

      return {
        id: attachment.id || `${attachment.name}-${index}`,
        title: attachment.name || "Attachment",
        meta: `${attachment.source === "drive" ? "Drive" : attachment.source === "gmail" ? "Gmail" : "Chat"} | ${modifiedLabel}`,
        detailMeta: `${attachment.source === "drive" ? "Drive" : attachment.source === "gmail" ? "Gmail" : "Chat"} | ${formatDocsSize(attachment.size)}`,
        modifiedLabel,
        collectionLabel: "Workspace files",
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

    if ((selectedAppFilter === "all" || selectedAppFilter === "drive" || selectedAppFilter === "docs" || selectedAppFilter === "sheets" || selectedAppFilter === "slides") && sourceFilteredGoogleDocs.length > 0) {
      nextSections.push({
        key: "workspace",
        title: "Workspace files",
        description: "Recently updated files from Drive, Docs, Sheets, and Slides.",
        badgeClass: isDarkMode ? sourceStyles.drive.dark : sourceStyles.drive.light,
        items: sourceFilteredGoogleDocs.map(doc => {
          const appType = GoogleService.getAppTypeFromMime(doc.mimeType)
          const appIcon = GoogleService.getAppIcon(appType)
          const sourceKey = appType === "docs" || appType === "sheets" || appType === "slides" ? appType : "drive"
          const palette = sourceStyles[sourceKey] || sourceStyles.drive

          return {
            id: doc.id,
            title: doc.name,
            meta: `${formatDocsDate(doc.modifiedTime)} | ${formatDocsSize(doc.size)}`,
            detailMeta: `${formatDocsDate(doc.modifiedTime)} | ${formatDocsSize(doc.size)}`,
            modifiedLabel: formatDocsDate(doc.modifiedTime),
            collectionLabel: "Workspace files",
            sourceLabel: sourceKey === "drive" ? "Drive" : sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1),
            icon: doc.iconLink || appIcon.iconUrl,
            emoji: appIcon.emoji,
            badgeClass: isDarkMode ? palette.dark : palette.light,
            onPreview: () => onOpenAttachment({ ...doc, source: "drive" }),
            onOpen: () => openInNewTab(doc.webViewLink),
            onAdd: () => onAddDocument(doc),
            extraAction: (
              <button onClick={() => openInNewTab(doc.webViewLink)} className={cx("inline-flex h-8 w-8 items-center justify-center rounded-md transition", isDarkMode ? "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200")} title="Open in Google Workspace">
                <ArrowUpRight className="h-3.5 w-3.5" />
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
          const modifiedLabel = attachment.emailDate || attachment.emailDateMs ? formatDocsDate(attachment.emailDate || attachment.emailDateMs) : "Recent email"

          return {
            id: `gmail-${attachment.messageId}-${attachment.id}-${index}`,
            title: attachment.filename,
            meta: `${attachment.senderName || "Unknown sender"} | ${formatDocsSize(attachment.size)}`,
            detailMeta: `${attachment.senderName || "Unknown sender"} | ${formatDocsSize(attachment.size)}`,
            modifiedLabel,
            collectionLabel: "Workspace files",
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
              <button onClick={() => openInNewTab(emailUrl)} className={cx("inline-flex h-8 w-8 items-center justify-center rounded-md transition", isDarkMode ? "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-700 hover:bg-slate-200")} title="Open email">
                <Mail className="h-3.5 w-3.5" />
              </button>
            ),
          }
        }),
      })
    }

    return nextSections
  }, [selectedAppFilter, isDarkMode, sharedChatDocs, sourceFilteredGoogleDocs, displayedGmailAttachments, formatDocsDate, formatDocsSize, onOpenAttachment, onAddDocument])

  const activeFilter = filters.find(filter => filter.key === selectedAppFilter) || filters[0]
  const fileRows = useMemo(
    () =>
      sections.flatMap(section =>
        section.items.map(item => ({
          ...item,
          groupTitle: section.title,
          groupDescription: section.description,
          collectionLabel: item.collectionLabel || section.title,
          badgeClass: item.badgeClass || section.badgeClass,
        }))
      ),
    [sections]
  )

  const collectionOptions = useMemo(() => {
    const counts = new Map()
    fileRows.forEach(item => {
      const label = item.collectionLabel || item.groupTitle || "Workspace files"
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    return [
      { value: "all", label: "All collections", count: fileRows.length },
      ...Array.from(counts.entries()).map(([label, count]) => ({
        value: label,
        label,
        count,
      })),
    ]
  }, [fileRows])

  const resolvedCollectionFilter = collectionOptions.some(option => option.value === collectionFilter)
    ? collectionFilter
    : "all"

  const visibleFileRows = useMemo(() => {
    const query = librarySearch.trim().toLowerCase()
    return fileRows.filter(item => {
      const matchesCollection =
        resolvedCollectionFilter === "all" ||
        item.collectionLabel === resolvedCollectionFilter ||
        item.groupTitle === resolvedCollectionFilter

      if (!matchesCollection) return false
      if (!query) return true

      return [item.title, item.meta, item.detailMeta, item.modifiedLabel, item.sourceLabel, item.groupTitle, item.collectionLabel]
        .some(value => String(value || "").toLowerCase().includes(query))
    })
  }, [fileRows, librarySearch, resolvedCollectionFilter])

  return (
    <div className={cx("h-full min-h-0 w-full overflow-y-auto", embedded && "documents-hub-embedded", isDarkMode ? "bg-[#0d1117] text-slate-100" : "bg-[#f6f8fb] text-slate-900")}>
      <div className="relative isolate min-h-full">
        <div className="documents-hub-stage relative min-h-0 px-4 py-4 sm:px-6 lg:h-full lg:p-6">
          <div className="mx-auto flex min-h-0 max-w-[1500px] flex-col gap-4 lg:h-full lg:max-w-none lg:gap-0">
            <div className="hidden flex-wrap items-center gap-3 md:flex lg:hidden">
              {typeof onBackHome === "function" && (
                <button
                  onClick={onBackHome}
                  className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                    isDarkMode
                      ? "border-[#252b33] bg-[#11161c] text-slate-200 hover:bg-[#151a20]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}

              {typeof onRefresh === "function" && (
                <button
                  onClick={onRefresh}
                  className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                    isDarkMode
                      ? "border-[#252b33] bg-[#11161c] text-slate-200 hover:bg-[#151a20]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              )}

            </div>
            {loadingDocs ? (
              <SurfaceCard isDarkMode={isDarkMode}>
                <div className="flex min-h-[52vh] items-center justify-center px-6 py-10">
                  <div className="text-center">
                    <div className={cx("mx-auto h-14 w-14 animate-spin rounded-full border-2 border-transparent border-t-current", isDarkMode ? "text-sky-400" : "text-sky-600")} />
                    <p className={cx("mt-5 text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>Loading your documents...</p>
                  </div>
                </div>
              </SurfaceCard>
            ) : (
              <>
                <section className="lg:hidden">
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
                        {typeof onRefresh === "function" && (
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
                            {activeFilter.label}
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
                          <EmptyState title="No documents in this collection" description="Try another source or wait for files to sync into the library." isDarkMode={isDarkMode} />
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

                <div className="documents-hub-split hidden min-h-0 gap-6 lg:grid lg:grid-cols-[304px_minmax(0,1fr)]">
                  <aside className="workspace-dedicated-sidebar documents-hub-sidebar min-h-0">
                    <div className="workspace-dedicated-sidebar-title-row">
                      <div className="workspace-dedicated-sidebar-title-main">
                        <h2>Documents</h2>
                        <span className="workspace-dedicated-sidebar-title-count">{overview.total}</span>
                      </div>
                      <div className="workspace-dedicated-sidebar-title-actions">
                        {typeof onBackHome === "function" && (
                          <button type="button" onClick={onBackHome} className="workspace-dedicated-sidebar-action-button" title="Back" aria-label="Back">
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                        )}
                        {typeof onRefresh === "function" && (
                          <button type="button" onClick={onRefresh} className="workspace-dedicated-sidebar-action-button" title="Refresh" aria-label="Refresh documents">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <SurfaceCard isDarkMode={isDarkMode} className="workspace-dedicated-sidebar-section">
                      <div className={cx("border-b px-4 py-3", isDarkMode ? "border-[#252b33]" : "border-slate-200")}>
                        <div className={cx("text-[10px] font-semibold uppercase tracking-[0.16em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Sources</div>
                      </div>
                      <div className="workspace-dedicated-sidebar-list">
                          {filters.map(filter => (
                            <FilterButton key={filter.key} filter={filter} isSelected={selectedAppFilter === filter.key} isDarkMode={isDarkMode} onClick={() => onSelectFilter(filter.key)} />
                          ))}
                      </div>
                    </SurfaceCard>

                    <SurfaceCard isDarkMode={isDarkMode} className="workspace-dedicated-sidebar-section">
                      <div className={cx("border-b px-4 py-3", isDarkMode ? "border-[#252b33]" : "border-slate-200")}>
                        <div className={cx("text-[10px] font-semibold uppercase tracking-[0.16em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>Collections</div>
                      </div>
                      <div className="workspace-dedicated-sidebar-list">
                        {collectionOptions.map(option => (
                          <CollectionButton
                            key={option.value}
                            label={option.label}
                            count={option.count}
                            isSelected={resolvedCollectionFilter === option.value}
                            isDarkMode={isDarkMode}
                            onClick={() => setCollectionFilter(option.value)}
                          />
                        ))}
                      </div>
                    </SurfaceCard>

                    <LibrarySnapshot overview={overview} isDarkMode={isDarkMode} />
                  </aside>

                  <main className="min-w-0">
                    <SurfaceCard isDarkMode={isDarkMode} className="documents-content-panel flex min-h-full flex-col">
                      <div className={cx("px-5 pb-4 pt-5 sm:px-7 sm:pt-7", isDarkMode ? "border-[#252b33]" : "border-slate-200")}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className={cx("text-[11px] font-bold uppercase", isDarkMode ? "text-slate-500" : "text-slate-500")}>Documents</div>
                            <h2 className={cx("mt-2 text-[1.35rem] font-bold leading-tight", isDarkMode ? "text-white" : "text-slate-900")}>Workspace library</h2>
                            <p className={cx("mt-2 max-w-2xl text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>A clean browser for Drive files, shared chat docs, and Gmail attachments in one place.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={cx("flex overflow-hidden rounded-[10px] border p-1", isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50")}>
                              <button
                                type="button"
                                onClick={() => setViewMode("grid")}
                                className={cx("flex h-8 w-8 items-center justify-center rounded-[8px] transition", viewMode === "grid" ? (isDarkMode ? "bg-white/[0.1] text-white" : "bg-white text-slate-900 shadow-sm") : (isDarkMode ? "text-slate-400 hover:text-slate-100" : "text-slate-500 hover:text-slate-900"))}
                                title="Grid view"
                              >
                                <LayoutGrid className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className={cx("flex h-8 w-8 items-center justify-center rounded-[8px] transition", viewMode === "list" ? (isDarkMode ? "bg-white/[0.1] text-white" : "bg-white text-slate-900 shadow-sm") : (isDarkMode ? "text-slate-400 hover:text-slate-100" : "text-slate-500 hover:text-slate-900"))}
                                title="List view"
                              >
                                <List className="h-4 w-4" />
                              </button>
                            </div>
                            <span className={cx("inline-flex rounded-md px-2.5 py-1 text-xs font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-200" : "bg-slate-100 text-slate-700")}>{collectionSummary.count} files</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-0 sm:px-7">
                        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_190px_auto] xl:items-center">
                          <label className={cx("flex h-11 min-w-0 items-center gap-2 rounded-[12px] border px-3", isDarkMode ? "border-[#252b33] bg-[#151a20] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500")}>
                            <Search className="h-4 w-4 shrink-0" />
                            <input
                              value={librarySearch}
                              onChange={event => setLibrarySearch(event.target.value)}
                              placeholder="Search files, folders, and content"
                              className={cx("w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-inherit", isDarkMode ? "text-slate-100" : "text-slate-900")}
                            />
                          </label>
                          <label className={cx("flex h-11 min-w-0 items-center gap-2 rounded-[12px] border px-3", isDarkMode ? "border-[#252b33] bg-[#151a20] text-slate-300" : "border-slate-200 bg-white text-slate-700")}>
                            <select
                              value={selectedAppFilter}
                              onChange={event => onSelectFilter(event.target.value)}
                              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                            >
                              {filters.map(filter => (
                                <option key={filter.key} value={filter.key}>{filter.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                          </label>
                          <label className={cx("flex h-11 min-w-0 items-center gap-2 rounded-[12px] border px-3", isDarkMode ? "border-[#252b33] bg-[#151a20] text-slate-300" : "border-slate-200 bg-white text-slate-700")}>
                            <select
                              value={resolvedCollectionFilter}
                              onChange={event => setCollectionFilter(event.target.value)}
                              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                            >
                              {collectionOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setLibrarySearch("")
                              setCollectionFilter("all")
                            }}
                            className={cx("inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border px-4 text-sm font-semibold transition", isDarkMode ? "border-[#252b33] bg-[#151a20] text-slate-200 hover:bg-white/[0.06]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                            title="Clear document filters"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filters
                          </button>
                        </div>

                        {shouldShowGmailSearch && <div className="mb-4">{renderGmailSearch()}</div>}
                        {visibleFileRows.length === 0 ? (
                          <EmptyState title="No documents in this collection" description={docsError ? "Showing the latest synced files available." : "Try another source or wait for files to sync into the library."} isDarkMode={isDarkMode} />
                        ) : viewMode === "grid" ? (
                          <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                            {visibleFileRows.map(item => (
                              <DocumentCard
                                key={`${item.groupTitle}-${item.id}`}
                                title={item.title}
                                meta={item.detailMeta || item.meta}
                                sourceLabel={item.sourceLabel}
                                icon={item.icon}
                                emoji={item.emoji}
                                onPreview={item.onPreview}
                                onOpen={item.onOpen}
                                onAdd={item.onAdd}
                                extraAction={item.extraAction}
                                badgeClass={item.badgeClass}
                                isDarkMode={isDarkMode}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className={cx("flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border", isDarkMode ? "border-[#252b33]" : "border-slate-200")}>
                            <div className={cx("hidden grid-cols-[minmax(0,1.45fr)_130px_150px_150px_84px] gap-4 border-b px-4 py-3 text-[11px] font-bold uppercase lg:grid", isDarkMode ? "border-[#252b33] bg-[#151a20] text-slate-500" : "border-slate-200 bg-slate-50 text-slate-500")}>
                              <span>Name</span>
                              <span>Source</span>
                              <span>Collection</span>
                              <span>Modified</span>
                              <span className="text-right">Actions</span>
                            </div>
                            <div className={cx("min-h-0 flex-1 overflow-y-auto divide-y", isDarkMode ? "divide-[#252b33]" : "divide-slate-200")}>
                              {visibleFileRows.map(item => (
                                <article
                                  key={`${item.groupTitle}-${item.id}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={item.onPreview}
                                  onKeyDown={event => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault()
                                      item.onPreview?.()
                                    }
                                  }}
                                  className={cx("grid cursor-pointer gap-3 px-4 py-3 outline-none transition lg:grid-cols-[minmax(0,1.45fr)_130px_150px_150px_84px] lg:items-center", isDarkMode ? "bg-[#11161c] hover:bg-[#151a20] focus:bg-[#151a20]" : "bg-white hover:bg-slate-50 focus:bg-slate-50")}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border", isDarkMode ? "border-[#252b33] bg-white/[0.05]" : "border-slate-200 bg-slate-50")}>
                                      {item.icon ? <SmartImage src={item.icon} alt="" className="h-5 w-5 object-contain" fallback={<span className="text-base">{item.emoji}</span>} /> : <span className="text-base">{item.emoji}</span>}
                                    </span>
                                    <span className="min-w-0">
                                      <span className={cx("block truncate text-sm font-bold", isDarkMode ? "text-slate-100" : "text-slate-900")} title={item.title}>{item.title}</span>
                                      <span className={cx("mt-1 block truncate text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{cleanMeta(item.detailMeta || item.meta)}</span>
                                    </span>
                                  </div>
                                  <span className={cx("inline-flex w-fit rounded-md px-2 py-1 text-[11px] font-semibold", item.badgeClass)}>{item.sourceLabel}</span>
                                  <span className={cx("hidden truncate text-xs font-semibold lg:block", isDarkMode ? "text-slate-400" : "text-slate-500")}>{item.collectionLabel || item.groupTitle}</span>
                                  <span className={cx("hidden truncate text-xs font-semibold lg:block", isDarkMode ? "text-slate-400" : "text-slate-500")}>{item.modifiedLabel || "No recent activity"}</span>
                                  <div className="flex items-center gap-2 lg:justify-end">
                                    <button
                                      type="button"
                                      onClick={event => {
                                        event.stopPropagation()
                                        item.onOpen?.()
                                      }}
                                      className={cx("inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition", isDarkMode ? "border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}
                                      title="Open file"
                                    >
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={event => {
                                        event.stopPropagation()
                                        item.onAdd?.()
                                      }}
                                      className={cx("inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition", isDarkMode ? "border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100")}
                                      title="Add to message"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                            <div className={cx("flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs font-semibold", isDarkMode ? "border-[#252b33] bg-[#11161c] text-slate-400" : "border-slate-200 bg-white text-slate-500")}>
                              <span>1-{Math.min(visibleFileRows.length, 25)} of {visibleFileRows.length} files</span>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3].map(page => (
                                  <span key={page} className={cx("flex h-8 w-8 items-center justify-center rounded-[9px] border", page === 1 ? (isDarkMode ? "border-sky-400/20 bg-sky-400/12 text-sky-200" : "border-sky-100 bg-sky-50 text-sky-700") : (isDarkMode ? "border-white/10 bg-white/[0.04] text-slate-400" : "border-slate-200 bg-white text-slate-500"))}>{page}</span>
                                ))}
                                <span className={cx("px-1", isDarkMode ? "text-slate-600" : "text-slate-400")}>...</span>
                                <span className={cx("flex h-8 min-w-8 items-center justify-center rounded-[9px] border px-2", isDarkMode ? "border-white/10 bg-white/[0.04] text-slate-400" : "border-slate-200 bg-white text-slate-500")}>{Math.max(1, Math.ceil(visibleFileRows.length / 25))}</span>
                              </div>
                              <span>Show 25 per page</span>
                            </div>
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
