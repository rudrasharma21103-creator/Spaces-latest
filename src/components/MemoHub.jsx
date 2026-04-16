import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Archive,
  ArrowLeft,
  Bold,
  FileText,
  Inbox,
  Italic,
  MailPlus,
  MoreHorizontal,
  Paperclip,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react"
import {
  getAllowedRecipients,
  getDrafts,
  getInbox,
  getMemo,
  getSent,
  markMemoSeen,
  replyToMemo,
  saveMemo,
  uploadMemoAttachment,
} from "../services/memos"

const cx = (...classes) => classes.filter(Boolean).join(" ")

const FOLDERS = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "sent", label: "Sent", icon: Send },
  { key: "drafts", label: "Drafts", icon: FileText },
]

const createEmptyComposer = () => ({
  id: null,
  receiver_ids: [],
  subject: "",
  body: "",
  attachments: [],
})

const formatMemoDate = value => {
  if (!value) return "Now"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Now"
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const sanitizeHtml = value => {
  const raw = (value || "").trim()
  if (!raw) return ""
  return raw
    .replace(/<\s*(script|style)[^>]*>.*?<\s*\/\s*\1\s*>/gis, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "")
}

const getPlainText = value => {
  if (!value) return ""
  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(value, "text/html")
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim()
}

const uniqueUsers = users => {
  const seen = new Set()
  const result = []

  for (const user of users || []) {
    const id = user?.id != null ? String(user.id) : ""
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(user)
  }

  return result
}

function Surface({ children, className = "", isDarkMode = false }) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-[16px] border shadow-[0_20px_50px_rgba(15,23,42,0.08)]",
        isDarkMode ? "border-white/10 bg-[#171b21]" : "border-[#d7e5ff] bg-white/95 backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  )
}

function AttachmentChip({ attachment, removable = false, onRemove, isDarkMode = false }) {
  const baseClass = isDarkMode
    ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.07]"
    : "border-[#d7e5ff] bg-[#f8fbff] text-[#24406f] hover:bg-[#eef5ff]"

  const content = (
    <>
      <Paperclip className="h-3.5 w-3.5" />
      <span className="max-w-[200px] truncate">{attachment?.name || "Attachment"}</span>
      {removable ? <Trash2 className="h-3.5 w-3.5" /> : null}
    </>
  )

  if (removable) {
    return (
      <button onClick={onRemove} type="button" className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition", baseClass)}>
        {content}
      </button>
    )
  }

  return (
    <a
      href={attachment?.public_url || attachment?.url || attachment?.webViewLink || "#"}
      target="_blank"
      rel="noreferrer"
      className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition", baseClass)}
    >
      {content}
    </a>
  )
}

function PersonChip({ person, tone = "neutral", onRemove, isDarkMode = false }) {
  const classes =
    tone === "strong"
      ? isDarkMode
        ? "bg-[#166aea]/18 text-[#9bc3ff]"
        : "bg-[#e8f1ff] text-[#166aea]"
      : isDarkMode
        ? "bg-white/[0.06] text-slate-200"
        : "bg-[#f3f7ff] text-[#5b7094]"

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={!onRemove}
      className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", classes, !onRemove && "cursor-default")}
    >
      <span>{person?.name || person?.email || "Connection"}</span>
      {onRemove ? <Trash2 className="h-3.5 w-3.5" /> : null}
    </button>
  )
}

function RichTextEditor({ value, onChange, placeholder, minHeight = 220, isDarkMode = false }) {
  const editorRef = useRef(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ""
    }
  }, [value])

  const runCommand = command => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false)
    onChange(editorRef.current.innerHTML)
  }

  return (
    <div className={cx("overflow-hidden rounded-[12px] border", isDarkMode ? "border-white/10 bg-[#13171c]" : "border-[#d7e5ff] bg-white")}>
      <div className={cx("flex items-center gap-1 border-b px-2 py-1.5", isDarkMode ? "border-white/10" : "border-[#d7e5ff] bg-[#f8fbff]")}>
        {[
          { key: "bold", icon: Bold, label: "Bold" },
          { key: "italic", icon: Italic, label: "Italic" },
          { key: "insertUnorderedList", icon: FileText, label: "Bullet list" },
        ].map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => runCommand(item.key)}
              className={cx(
                "inline-flex h-8 w-8 items-center justify-center rounded-[9px] transition",
                isDarkMode ? "text-slate-300 hover:bg-white/[0.08] hover:text-white" : "text-[#5b7094] hover:bg-[#e9f1ff] hover:text-[#166aea]"
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={event => onChange(event.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className={cx("memo-editor px-3.5 py-3 text-sm leading-6 outline-none", isDarkMode ? "text-slate-100" : "text-[#17305c]")}
        style={{ minHeight }}
      />
    </div>
  )
}

function MailItem({
  memo,
  folder,
  active,
  onClick,
  renderAvatar,
  isDarkMode = false,
}) {
  const primaryPerson = folder === "sent" ? memo.receivers?.[0] : memo.sender
  const secondaryLabel =
    folder === "sent"
      ? memo.receivers?.map(person => person?.name).filter(Boolean).join(", ")
      : memo.sender?.name || "Unknown sender"

  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full rounded-[12px] border px-3 py-2.5 text-left transition",
        active
          ? isDarkMode
            ? "border-[#166aea]/35 bg-[#1d2428]"
            : "border-[#bfd5ff] bg-[#f4f8ff] shadow-[inset_3px_0_0_#166aea]"
          : isDarkMode
            ? "border-transparent hover:bg-white/[0.04]"
            : "border-transparent hover:bg-[#f7fbff]"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cx("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full", isDarkMode ? "bg-white/[0.05]" : "bg-[#edf3ff]")}>
          {primaryPerson ? renderAvatar(primaryPerson, 36) : <span className={cx("text-xs font-semibold", isDarkMode ? "text-slate-300" : "text-[#5b7094]")}>M</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className={cx("truncate text-[13px] font-semibold", isDarkMode ? "text-slate-100" : "text-[#10213f]")}>
                {secondaryLabel || "Memo"}
              </div>
              <div className={cx("mt-0.5 truncate text-[11px]", isDarkMode ? "text-slate-500" : "text-[#7f95b8]")}>
                {memo.subject || "No subject"}
              </div>
            </div>
            <div className={cx("shrink-0 text-[10px]", isDarkMode ? "text-slate-500" : "text-[#7f95b8]")}>
              {formatMemoDate(memo.last_message_at)}
            </div>
          </div>
          <p className={cx("mt-1.5 line-clamp-2 text-[13px] leading-5", isDarkMode ? "text-slate-300" : "text-[#5b7094]")}>
            {memo.preview || "Open this memo to read the full message."}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {!memo.is_seen && folder === "inbox" ? (
              <span className={cx("rounded-full px-2 py-1 text-[10px] font-semibold", isDarkMode ? "bg-[#166aea]/18 text-[#9bc3ff]" : "bg-[#e8f1ff] text-[#166aea]")}>
                New
              </span>
            ) : null}
            {memo.reply_count > 0 ? (
              <span className={cx("rounded-full px-2 py-1 text-[10px] font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-[#f3f7ff] text-[#5b7094]")}>
                {memo.reply_count} replies
              </span>
            ) : null}
            {memo.attachment_count > 0 ? (
              <span className={cx("rounded-full px-2 py-1 text-[10px] font-semibold", isDarkMode ? "bg-white/[0.06] text-slate-300" : "bg-[#f3f7ff] text-[#5b7094]")}>
                {memo.attachment_count} files
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}

function ThreadMessage({ label, sender, timestamp, body, attachments, renderAvatar, isDarkMode = false }) {
  return (
    <div className={cx("rounded-[16px] border p-4", isDarkMode ? "border-white/10 bg-[#191e25]" : "border-[#d7e5ff] bg-white")}>
      <div className="flex items-start gap-3">
        <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full", isDarkMode ? "bg-white/[0.06]" : "bg-[#edf3ff]")}>
          {sender ? renderAvatar(sender, 40) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className={cx("text-base font-semibold", isDarkMode ? "text-slate-100" : "text-[#10213f]")}>
                {sender?.name || "Unknown sender"}
              </div>
              <div className={cx("mt-0.5 text-[13px]", isDarkMode ? "text-slate-400" : "text-[#5b7094]")}>
                {sender?.email || label}
              </div>
            </div>
            <div className={cx("text-[11px]", isDarkMode ? "text-slate-500" : "text-[#7f95b8]")}>
              {formatMemoDate(timestamp)}
            </div>
          </div>

          <div
            className={cx("memo-body mt-3 text-sm leading-6", isDarkMode ? "text-slate-200" : "text-[#17305c]")}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) || "<p></p>" }}
          />

          {attachments?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map(attachment => (
                <AttachmentChip
                  key={`${attachment.id || attachment.fileId}-${attachment.name}`}
                  attachment={attachment}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function MemoHub({
  currentUser,
  friends = [],
  renderAvatar,
  onBackHome,
  isDarkMode = false,
}) {
  const [activeFolder, setActiveFolder] = useState("inbox")
  const [mailboxes, setMailboxes] = useState({ inbox: [], sent: [], drafts: [] })
  const [apiRecipients, setApiRecipients] = useState([])
  const [selectedMemoId, setSelectedMemoId] = useState(null)
  const [selectedMemo, setSelectedMemo] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composer, setComposer] = useState(createEmptyComposer)
  const [recipientQuery, setRecipientQuery] = useState("")
  const [replyBody, setReplyBody] = useState("")
  const [replyAttachments, setReplyAttachments] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingMemo, setSavingMemo] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [error, setError] = useState("")
  const [sendToast, setSendToast] = useState(null)

  const composeFileRef = useRef(null)
  const replyFileRef = useRef(null)

  const theme = {
    page: isDarkMode
      ? "bg-[#101317] text-slate-100"
      : "bg-[radial-gradient(circle_at_top_left,_rgba(22,106,234,0.14),_transparent_28%),linear-gradient(180deg,#f5f9ff_0%,#edf4ff_100%)] text-[#10213f]",
    sidebar: isDarkMode ? "border-white/10 bg-[#efefef]/0" : "border-[#d7e5ff] bg-[#f8fbff]",
    muted: isDarkMode ? "text-slate-400" : "text-[#5b7094]",
    faint: isDarkMode ? "text-slate-500" : "text-[#7f95b8]",
    strong: isDarkMode ? "text-slate-100" : "text-[#10213f]",
    input: isDarkMode
      ? "border-white/10 bg-[#13171c] text-slate-100 placeholder:text-slate-500"
      : "border-[#d7e5ff] bg-white text-[#17305c] placeholder:text-[#8da3c7] focus:border-[#166aea] focus:ring-2 focus:ring-[#166aea]/15",
    ghost: isDarkMode
      ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]"
      : "border-[#d7e5ff] bg-white text-[#24406f] hover:bg-[#f4f8ff] hover:text-[#166aea]",
    primary: "bg-[#166aea] text-white shadow-[0_14px_30px_rgba(22,106,234,0.28)] hover:bg-[#0f57c9]",
  }

  useEffect(() => {
    if (!sendToast) return undefined
    const timer = window.setTimeout(() => setSendToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [sendToast])

  const mergedRecipients = useMemo(
    () =>
      uniqueUsers([
        ...(Array.isArray(friends) ? friends : []),
        ...(Array.isArray(apiRecipients) ? apiRecipients : []),
      ]).sort((left, right) => (left?.name || left?.email || "").localeCompare(right?.name || right?.email || "")),
    [apiRecipients, friends]
  )

  const refreshMemoData = async ({ preserveSelection = true, includeRecipients = false, silent = false } = {}) => {
    if (!silent) setListLoading(true)
    setError("")

    const requests = [
      getInbox(),
      getSent(),
      getDrafts(),
    ]

    if (includeRecipients) {
      requests.unshift(getAllowedRecipients())
    }

    const results = await Promise.allSettled(requests)
    const [recipientsResult, inboxResult, sentResult, draftsResult] = includeRecipients
      ? results
      : [null, ...results]

    if (includeRecipients) {
      if (recipientsResult?.status === "fulfilled") {
        setApiRecipients(Array.isArray(recipientsResult.value) ? recipientsResult.value : [])
      } else {
        setApiRecipients([])
      }
    }

    if (
      inboxResult.status === "rejected" ||
      sentResult.status === "rejected" ||
      draftsResult.status === "rejected"
    ) {
      const firstError =
        inboxResult.status === "rejected"
          ? inboxResult.reason
          : sentResult.status === "rejected"
            ? sentResult.reason
            : draftsResult.reason
      setError(firstError?.message || "Memo could not be loaded")
    } else {
      setMailboxes({
        inbox: Array.isArray(inboxResult.value) ? inboxResult.value : [],
        sent: Array.isArray(sentResult.value) ? sentResult.value : [],
        drafts: Array.isArray(draftsResult.value) ? draftsResult.value : [],
      })

      if (!preserveSelection) {
        setSelectedMemoId(null)
        setSelectedMemo(null)
      }
    }

    if (!silent) setListLoading(false)
  }

  useEffect(() => {
    refreshMemoData({ includeRecipients: true })
  }, [])

  const selectedRecipients = useMemo(
    () =>
      composer.receiver_ids
        .map(id => mergedRecipients.find(person => String(person.id) === String(id)))
        .filter(Boolean),
    [composer.receiver_ids, mergedRecipients]
  )

  const availableRecipients = useMemo(() => {
    const query = recipientQuery.trim().toLowerCase()

    return mergedRecipients.filter(person => {
      if (composer.receiver_ids.some(id => String(id) === String(person.id))) return false
      if (!query) return true
      const haystack = `${person?.name || ""} ${person?.email || ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [composer.receiver_ids, mergedRecipients, recipientQuery])

  const sidebarConnections = useMemo(
    () => (composeOpen ? availableRecipients : mergedRecipients),
    [availableRecipients, composeOpen, mergedRecipients]
  )

  const activeList = useMemo(() => mailboxes[activeFolder] || [], [mailboxes, activeFolder])

  const filteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return activeList

    return activeList.filter(item => {
      const sender = item.sender?.name || ""
      const receivers = item.receivers?.map(person => person?.name).join(" ") || ""
      const haystack = `${item.subject || ""} ${item.preview || ""} ${sender} ${receivers}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [activeList, searchQuery])

  const resetComposer = () => {
    setComposer(createEmptyComposer())
    setRecipientQuery("")
  }

  const showSentToast = (title, subtitle) => {
    setSendToast({ title, subtitle })
  }

  const handleOpenCompose = () => {
    setComposeOpen(true)
    setSelectedMemo(null)
    setSelectedMemoId(null)
    setReplyBody("")
    setReplyAttachments([])
    resetComposer()
  }

  const openMemo = async memoId => {
    if (!memoId) return
    setComposeOpen(false)
    setSelectedMemoId(memoId)
    setDetailLoading(true)
    setError("")

    try {
      let detail = await getMemo(memoId)
      if (activeFolder === "inbox" && !detail?.is_seen) {
        detail = await markMemoSeen(memoId)
        setMailboxes(prev => ({
          ...prev,
          inbox: (prev.inbox || []).map(item => (item.id === memoId ? { ...item, is_seen: true } : item)),
        }))
      }
      setSelectedMemo(detail)
      setReplyBody("")
      setReplyAttachments([])
    } catch (loadError) {
      setError(loadError.message || "This memo could not be opened")
    } finally {
      setDetailLoading(false)
    }
  }

  const openDraft = async memoId => {
    if (!memoId) return
    setDetailLoading(true)
    setError("")

    try {
      const detail = await getMemo(memoId)
      setComposeOpen(true)
      setSelectedMemo(null)
      setSelectedMemoId(memoId)
      setComposer({
        id: detail.id,
        receiver_ids: detail.receiver_ids || [],
        subject: detail.subject || "",
        body: detail.body || "",
        attachments: detail.attachments || [],
      })
      setRecipientQuery("")
    } catch (loadError) {
      setError(loadError.message || "This draft could not be opened")
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSelectMemo = memo => {
    if (!memo) return
    if (activeFolder === "drafts") {
      openDraft(memo.id)
      return
    }
    openMemo(memo.id)
  }

  const addRecipient = person => {
    if (!person?.id) return
    setComposer(prev => ({
      ...prev,
      receiver_ids: [...prev.receiver_ids, String(person.id)],
    }))
    setRecipientQuery("")
  }

  const removeRecipient = recipientId => {
    setComposer(prev => ({
      ...prev,
      receiver_ids: prev.receiver_ids.filter(id => String(id) !== String(recipientId)),
    }))
  }

  const handleAttachmentUpload = async (files, target) => {
    if (!files?.length) return
    setUploadingAttachment(true)
    setError("")

    try {
      const uploaded = []
      for (const file of files) {
        const result = await uploadMemoAttachment(file)
        uploaded.push(result)
      }

      if (target === "reply") {
        setReplyAttachments(prev => [...prev, ...uploaded])
      } else {
        setComposer(prev => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }))
      }
    } catch (uploadError) {
      setError(uploadError.message || "Attachment upload failed")
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleSaveMemo = async status => {
    if (savingMemo) return
    setSavingMemo(true)
    setError("")

    try {
      const saved = await saveMemo({
        id: composer.id || undefined,
        receiver_ids: composer.receiver_ids,
        subject: composer.subject,
        body: composer.body,
        attachments: composer.attachments,
        status,
      })

      await refreshMemoData({ silent: true })

      if (status === "draft") {
        setActiveFolder("drafts")
        setComposeOpen(true)
        setSelectedMemoId(saved.id)
        setComposer({
          id: saved.id,
          receiver_ids: saved.receiver_ids || [],
          subject: saved.subject || "",
          body: saved.body || "",
          attachments: saved.attachments || [],
        })
      } else {
        setActiveFolder("sent")
        setComposeOpen(false)
        setSelectedMemo(saved)
        setSelectedMemoId(saved.id)
        resetComposer()
        showSentToast("Memo sent", "Your message was delivered to the selected recipients.")
      }
    } catch (saveError) {
      setError(saveError.message || "Memo could not be saved")
    } finally {
      setSavingMemo(false)
    }
  }

  const handleReply = async () => {
    if (!selectedMemo?.id || sendingReply || !getPlainText(replyBody)) return
    setSendingReply(true)
    setError("")

    try {
      const updated = await replyToMemo(selectedMemo.id, {
        body: replyBody,
        attachments: replyAttachments,
      })
      setSelectedMemo(updated)
      setReplyBody("")
      setReplyAttachments([])
      await refreshMemoData({ silent: true })
      showSentToast("Reply sent", "Your follow-up has been added to the thread.")
    } catch (replyError) {
      setError(replyError.message || "Reply could not be sent")
    } finally {
      setSendingReply(false)
    }
  }

  const renderComposePanel = () => (
    <Surface isDarkMode={isDarkMode} className="flex min-h-[680px] flex-col">
      <div className={cx("border-b px-5 py-4", isDarkMode ? "border-white/10" : "border-[#d7e5ff] bg-[#fbfdff]")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={cx("text-xs font-semibold uppercase tracking-[0.125px]", theme.faint)}>Compose</div>
            <h2 className={cx("mt-1 text-[22px] font-semibold tracking-[-0.4px]", theme.strong)}>
              {composer.id ? "Continue draft" : "New memo"}
            </h2>
            <p className={cx("mt-1 text-[13px]", theme.muted)}>Send structured messages only to your connections and teammates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={resetComposer} type="button" className={cx("rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition", theme.ghost)}>
              Clear
            </button>
            <button onClick={() => handleSaveMemo("draft")} type="button" disabled={savingMemo} className={cx("rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition disabled:opacity-60", theme.ghost)}>
              Save draft
            </button>
            <button onClick={() => handleSaveMemo("sent")} type="button" disabled={savingMemo || composer.receiver_ids.length === 0} className={cx("inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-60", theme.primary)}>
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        <div className="space-y-4">
          <div>
            <label className={cx("text-[11px] font-semibold uppercase tracking-[0.125px]", theme.faint)}>To</label>
            <div className={cx("mt-2 rounded-[12px] border px-3 py-2.5", theme.input)}>
              <div className="flex flex-wrap gap-2">
                {selectedRecipients.map(person => (
                  <PersonChip
                    key={person.id}
                    person={person}
                    tone="strong"
                    onRemove={() => removeRecipient(person.id)}
                    isDarkMode={isDarkMode}
                  />
                ))}
                <input
                  value={recipientQuery}
                  onChange={event => setRecipientQuery(event.target.value)}
                  placeholder={selectedRecipients.length ? "Add another connection" : "Search your connections"}
                  className={cx("min-w-[180px] flex-1 bg-transparent text-[13px] outline-none", isDarkMode ? "placeholder:text-slate-500" : "placeholder:text-[#8da3c7]")}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={cx("text-[11px] font-semibold uppercase tracking-[0.125px]", theme.faint)}>Subject</label>
            <input
              value={composer.subject}
              onChange={event => setComposer(prev => ({ ...prev, subject: event.target.value }))}
              placeholder="Write a clear subject"
              className={cx("mt-2 h-10 w-full rounded-[12px] border px-3.5 text-[13px] outline-none", theme.input)}
            />
          </div>

          <div>
            <label className={cx("text-[11px] font-semibold uppercase tracking-[0.125px]", theme.faint)}>Message</label>
            <div className="mt-2">
              <RichTextEditor
                value={composer.body}
                onChange={value => setComposer(prev => ({ ...prev, body: value }))}
                placeholder="Write your memo..."
                minHeight={240}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          <div className={cx("rounded-[14px] border px-3.5 py-3.5", isDarkMode ? "border-white/10 bg-[#13171c]" : "border-[#d7e5ff] bg-[#f8fbff]")}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={cx("text-[13px] font-semibold", theme.strong)}>Attachments</div>
                <div className={cx("mt-1 text-[13px]", theme.muted)}>Add supporting files if needed.</div>
              </div>
              <button onClick={() => composeFileRef.current?.click()} type="button" className={cx("inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition", theme.ghost)}>
                <Paperclip className="h-4 w-4" />
                {uploadingAttachment ? "Uploading..." : "Attach files"}
              </button>
              <input
                ref={composeFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => {
                  handleAttachmentUpload(Array.from(event.target.files || []), "composer")
                  event.target.value = ""
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {composer.attachments.length ? (
                composer.attachments.map((attachment, index) => (
                  <AttachmentChip
                    key={`${attachment.id || attachment.fileId}-${index}`}
                    attachment={attachment}
                    removable
                    onRemove={() => setComposer(prev => ({ ...prev, attachments: prev.attachments.filter((_, itemIndex) => itemIndex !== index) }))}
                    isDarkMode={isDarkMode}
                  />
                ))
              ) : (
                <div className={cx("text-[13px]", theme.muted)}>No files added.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  )

  const renderDetailPanel = () => {
    if (detailLoading) {
      return (
        <Surface isDarkMode={isDarkMode} className="flex min-h-[680px] items-center justify-center">
          <div className={cx("text-[13px]", theme.muted)}>Loading memo...</div>
        </Surface>
      )
    }

    if (!selectedMemo) {
      return (
        <Surface isDarkMode={isDarkMode} className="flex min-h-[680px] items-center justify-center">
          <div className="max-w-md px-6 text-center">
            <div className={cx("mx-auto flex h-14 w-14 items-center justify-center rounded-full", isDarkMode ? "bg-white/[0.05]" : "bg-[#edf3ff]")}>
              <MailPlus className={cx("h-7 w-7", theme.muted)} />
            </div>
            <h3 className={cx("mt-4 text-[22px] font-semibold tracking-[-0.25px]", theme.strong)}>Open a memo</h3>
            <p className={cx("mt-2 text-[13px] leading-6", theme.muted)}>Choose a memo from the list, or start a new one from Compose.</p>
          </div>
        </Surface>
      )
    }

    return (
      <Surface isDarkMode={isDarkMode} className="flex min-h-[680px] flex-col">
        <div className={cx("border-b px-5 py-3.5", isDarkMode ? "border-white/10" : "border-[#d7e5ff]")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[Reply, Archive, Star].map((Icon, index) => (
                <button key={index} type="button" className={cx("inline-flex h-8 w-8 items-center justify-center rounded-full border transition", theme.ghost)}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleOpenCompose} type="button" className={cx("inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition", theme.ghost)}>
                <MailPlus className="h-4 w-4" />
                Compose
              </button>
              <button type="button" className={cx("inline-flex h-8 w-8 items-center justify-center rounded-full border transition", theme.ghost)}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className={cx("border-b px-5 py-4", isDarkMode ? "border-white/10 bg-[#151920]" : "border-[#d7e5ff] bg-[#fbfdff]")}>
          <div className={cx("text-xs", theme.faint)}>{formatMemoDate(selectedMemo.created_at)}</div>
          <h2 className={cx("mt-1.5 text-[26px] font-semibold tracking-[-0.65px]", theme.strong)}>
            {selectedMemo.subject || "No subject"}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cx("text-[13px]", theme.muted)}>To</span>
            {(selectedMemo.receivers || []).map(person => (
              <PersonChip key={person.id} person={person} isDarkMode={isDarkMode} />
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <ThreadMessage
            label="Original memo"
            sender={selectedMemo.sender}
            timestamp={selectedMemo.created_at}
            body={selectedMemo.body}
            attachments={selectedMemo.attachments}
            renderAvatar={renderAvatar}
            isDarkMode={isDarkMode}
          />

          {(selectedMemo.thread || []).map(reply => (
            <ThreadMessage
              key={reply.id}
              label="Reply"
              sender={reply.sender}
              timestamp={reply.created_at}
              body={reply.body}
              attachments={reply.attachments}
              renderAvatar={renderAvatar}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>

        <div className={cx("border-t px-5 py-4", isDarkMode ? "border-white/10" : "border-[#d7e5ff]")}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={cx("text-[13px] font-semibold", theme.strong)}>Reply</div>
              <div className={cx("mt-1 text-[13px]", theme.muted)}>Keep replies clear and lightweight.</div>
            </div>
            <button onClick={() => replyFileRef.current?.click()} type="button" className={cx("inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition", theme.ghost)}>
              <Paperclip className="h-4 w-4" />
              Attach
            </button>
          </div>

          <input
            ref={replyFileRef}
            type="file"
            multiple
            className="hidden"
            onChange={event => {
              handleAttachmentUpload(Array.from(event.target.files || []), "reply")
              event.target.value = ""
            }}
          />

          <div className="mt-4">
            <RichTextEditor
              value={replyBody}
              onChange={setReplyBody}
              placeholder="Write your reply..."
              minHeight={120}
              isDarkMode={isDarkMode}
            />
          </div>

          {replyAttachments.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {replyAttachments.map((attachment, index) => (
                <AttachmentChip
                  key={`${attachment.id || attachment.fileId}-${index}`}
                  attachment={attachment}
                  removable
                  onRemove={() => setReplyAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button onClick={handleReply} disabled={sendingReply || !getPlainText(replyBody)} type="button" className={cx("inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-60", theme.primary)}>
              <Send className="h-4 w-4" />
              {sendingReply ? "Sending..." : "Send reply"}
            </button>
          </div>
        </div>
      </Surface>
    )
  }

  return (
    <div className={cx("min-h-[100dvh] w-full", theme.page)}>
      <style>{`
        .memo-editor:empty:before {
          content: attr(data-placeholder);
          color: ${isDarkMode ? "rgb(100 116 139)" : "#8da3c7"};
          pointer-events: none;
        }
        .memo-editor ul {
          list-style: disc;
          margin-left: 1rem;
          padding-left: 0.25rem;
        }
        .memo-editor p {
          min-height: 1.5em;
        }
        .memo-body p {
          margin-bottom: 0.75rem;
        }
        .memo-body ul {
          list-style: disc;
          margin: 0 0 0.85rem 1.15rem;
        }
        .memo-body a {
          color: #166aea;
          text-decoration: underline;
        }
      `}</style>

      {sendToast ? (
        <div className="pointer-events-none fixed right-5 top-5 z-50">
          <div className={cx("flex items-start gap-3 rounded-[14px] border px-4 py-3 shadow-[0_18px_40px_rgba(22,106,234,0.18)]", isDarkMode ? "border-white/10 bg-[#171b21]" : "border-[#cfe0ff] bg-white")}>
            <div className={cx("flex h-9 w-9 items-center justify-center rounded-full", isDarkMode ? "bg-[#166aea]/18 text-[#9bc3ff]" : "bg-[#e8f1ff] text-[#166aea]")}>
              <Send className="h-4 w-4" />
            </div>
            <div>
              <div className={cx("text-[13px] font-semibold", theme.strong)}>{sendToast.title}</div>
              <div className={cx("mt-0.5 text-[12px]", theme.muted)}>{sendToast.subtitle}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1540px] px-4 py-4 sm:px-5 sm:py-5 xl:px-6 xl:py-6">
        <Surface isDarkMode={isDarkMode} className={cx("min-h-[800px]", isDarkMode ? "bg-[#161b21]" : "bg-[#f9fbff]")}>
          <div className="grid min-h-[800px] gap-0 xl:grid-cols-[220px_330px_minmax(0,1fr)]">
            <aside className={cx("border-b p-3.5 xl:border-b-0 xl:border-r", theme.sidebar, isDarkMode ? "xl:border-white/10" : "xl:border-[#d7e5ff]")}>
              <div className={cx("overflow-hidden rounded-[14px] border p-3.5", isDarkMode ? "border-white/10 bg-[#171b21]" : "border-[#d7e5ff] bg-white")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full", isDarkMode ? "bg-white/[0.06]" : "bg-[#166aea] text-white")}>
                      {currentUser ? renderAvatar(currentUser, 40) : <span className="text-sm font-semibold">U</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cx("truncate text-[16px] font-semibold", theme.strong)}>
                        {currentUser?.name || "Memo"}
                      </div>
                      <div className={cx("truncate text-[13px]", theme.muted)}>
                        {currentUser?.email || "Internal mail"}
                      </div>
                    </div>
                  </div>
                  <button onClick={onBackHome} type="button" className={cx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition", theme.ghost)}>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                <button onClick={handleOpenCompose} type="button" className={cx("mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition", theme.primary)}>
                  <MailPlus className="h-4 w-4" />
                  Compose
                </button>
              </div>

              <div className="mt-3.5 space-y-1">
                {FOLDERS.map(folder => {
                  const Icon = folder.icon
                  const active = activeFolder === folder.key
                  return (
                    <button
                      key={folder.key}
                      type="button"
                      onClick={() => {
                        setActiveFolder(folder.key)
                        setComposeOpen(false)
                        setSelectedMemo(null)
                        setSelectedMemoId(null)
                        setSearchQuery("")
                      }}
                      className={cx(
                        "flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left transition",
                        active
                          ? isDarkMode
                            ? "bg-[#1c2329] text-white"
                            : "bg-white text-[#10213f] shadow-sm ring-1 ring-[#d7e5ff]"
                          : isDarkMode
                            ? "text-slate-300 hover:bg-white/[0.04]"
                            : "text-[#5b7094] hover:bg-white/80"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span className="text-[13px] font-medium">{folder.label}</span>
                      </span>
                      <span className={cx("text-[13px] font-medium", active ? (isDarkMode ? "text-slate-200" : "text-[#166aea]") : theme.muted)}>
                        {(mailboxes[folder.key] || []).length}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className={cx("mt-3.5 overflow-hidden rounded-[14px] border", isDarkMode ? "border-white/10 bg-[#171b21]" : "border-[#d7e5ff] bg-white")}>
                <div className={cx("border-b px-3.5 py-3", isDarkMode ? "border-white/10" : "border-[#d7e5ff] bg-[#fbfdff]")}>
                  <div className="flex items-center gap-2">
                    <Users className={cx("h-4 w-4", theme.muted)} />
                    <div className={cx("text-[13px] font-semibold", theme.strong)}>Connections</div>
                  </div>
                  <div className={cx("mt-1.5 text-[12px]", theme.muted)}>
                    {composeOpen
                      ? `${availableRecipients.length} available to add`
                      : `${mergedRecipients.length} connection${mergedRecipients.length === 1 ? "" : "s"} in your network`}
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto p-2">
                  {sidebarConnections.length ? (
                    sidebarConnections.map(person => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => composeOpen && addRecipient(person)}
                        disabled={!composeOpen}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition",
                          composeOpen
                            ? isDarkMode
                              ? "hover:bg-white/[0.05]"
                              : "hover:bg-[#f7fbff]"
                            : "cursor-default"
                        )}
                      >
                        <div className={cx("flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full", isDarkMode ? "bg-white/[0.05]" : "bg-[#edf3ff]")}>
                          {renderAvatar(person, 32)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={cx("truncate text-[12px] font-semibold", theme.strong)}>{person.name || person.email}</div>
                          <div className={cx("truncate text-[11px]", theme.muted)}>{person.email || "Available connection"}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className={cx("px-2.5 py-4 text-[12px]", theme.muted)}>
                      {composeOpen
                        ? mergedRecipients.length
                          ? "No matching connections found."
                          : "No connections available yet."
                        : "Open compose to add connections to a memo."}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <section className={cx("border-b xl:border-b-0 xl:border-r", isDarkMode ? "border-white/10 bg-white/[0.02]" : "border-[#d7e5ff] bg-white/[0.72]")}>
              <div className={cx("border-b px-4 py-4", isDarkMode ? "border-white/10" : "border-[#d7e5ff]")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={cx("text-[24px] font-semibold tracking-[-0.4px]", theme.strong)}>
                      {FOLDERS.find(folder => folder.key === activeFolder)?.label || "Inbox"}
                    </div>
                    <div className={cx("mt-1 text-[13px]", theme.muted)}>
                      {activeList.length} message{activeList.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button type="button" className={cx("inline-flex h-8 w-8 items-center justify-center rounded-full border transition", theme.ghost)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>

                <label className="relative mt-3.5 block">
                  <Search className={cx("pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2", theme.faint)} />
                  <input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search"
                    className={cx("h-10 w-full rounded-full border pl-10 pr-4 text-[13px] outline-none", theme.input)}
                  />
                </label>
              </div>

              <div className="max-h-[720px] overflow-y-auto px-2.5 py-2.5">
                {listLoading ? (
                  <div className={cx("px-3 py-4 text-[13px]", theme.muted)}>Loading mailboxes...</div>
                ) : filteredList.length ? (
                  <div className="space-y-1">
                    {filteredList.map(memo => (
                      <MailItem
                        key={memo.id}
                        memo={memo}
                        folder={activeFolder}
                        active={selectedMemoId === memo.id}
                        onClick={() => handleSelectMemo(memo)}
                        renderAvatar={renderAvatar}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center px-8 text-center">
                    <div>
                      <div className={cx("mx-auto flex h-12 w-12 items-center justify-center rounded-full", isDarkMode ? "bg-white/[0.05]" : "bg-[#edf3ff]")}>
                        <Inbox className={cx("h-6 w-6", theme.muted)} />
                      </div>
                      <div className={cx("mt-3 text-base font-semibold", theme.strong)}>Nothing here yet</div>
                      <div className={cx("mt-2 text-[13px] leading-6", theme.muted)}>
                        {activeFolder === "drafts" ? "Saved drafts will appear here." : "New memos will show up here once they arrive."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <main className={cx("min-w-0 p-2.5 sm:p-3", isDarkMode ? "bg-[#11161b]" : "bg-[#f7fbff]")}>
              {error ? (
                <div className={cx("mb-3 rounded-[14px] border px-4 py-3 text-[13px]", isDarkMode ? "border-red-400/20 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-700")}>
                  {error}
                </div>
              ) : null}
              {composeOpen ? renderComposePanel() : renderDetailPanel()}
            </main>
          </div>
        </Surface>
      </div>
    </div>
  )
}
