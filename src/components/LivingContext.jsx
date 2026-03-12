import React from "react"
import {
  CircleDot,
  FileText,
  FolderOpen,
  MessageSquare,
  MoreVertical,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
import { CHANNEL_TABS, CONTEXT_STATUS_META } from "./LivingContext.helpers"

export function ChannelTabs({ activeTab, isDarkMode, onChange, selectedCount = 0, onCreateFromSelection }) {
  return (
    <div
      className={`mx-4 sm:mx-8 mb-3 rounded-2xl border px-3 py-2 flex items-center justify-between gap-3 ${
        isDarkMode ? "border-slate-800 bg-[#16181c]" : "border-white/70 bg-white/70 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-1">
        {CHANNEL_TABS.map(tab => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
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

      {selectedCount > 0 && (
        <button
          onClick={onCreateFromSelection}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
            isDarkMode ? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          <Plus className="w-4 h-4" />
          Create context {selectedCount}
        </button>
      )}
    </div>
  )
}

export function MessageActionsMenu({
  isDarkMode,
  isSelected,
  emojis = [],
  onReact,
  onToggleSelection,
  onCreateContext,
  onAddToContext,
  onMarkDecision,
  onCreateTask,
}) {
  const itemClass = `w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
    isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
  }`

  return (
    <div className={`rounded-2xl border p-2.5 w-56 shadow-2xl ${isDarkMode ? "bg-[#111317] border-slate-800" : "bg-white border-slate-200"}`}>
      {emojis.length > 0 && (
        <div className={`mb-2 px-1 pb-2 border-b ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
          <div className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
            React
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                className={`h-10 w-10 rounded-xl text-lg transition-colors ${
                  isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={onCreateContext} className={itemClass}>Create Context</button>
      <button onClick={onAddToContext} className={itemClass}>Add to Context</button>
      <button onClick={onMarkDecision} className={itemClass}>Mark Decision</button>
      <button onClick={onCreateTask} className={itemClass}>Create Task</button>
      <button onClick={onToggleSelection} className={itemClass}>
        {isSelected ? "Remove from selection" : "Select message"}
      </button>
    </div>
  )
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

export function ContextsTabView({ contexts, isDarkMode, onOpen, renderOwner, formatUpdatedTime }) {
  if (!contexts.length) {
    return (
      <div className={`mx-4 sm:mx-8 rounded-[2rem] border p-10 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        <div className={`mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center ${isDarkMode ? "bg-slate-800 text-violet-300" : "bg-indigo-50 text-indigo-600"}`}>
          <FolderOpen className="w-8 h-8" />
        </div>
        <div className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>No living context yet</div>
        <p className="text-sm mt-2">Create one from key messages and keep the channel memory close to the chat.</p>
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contexts.map(context => {
        const statusMeta = CONTEXT_STATUS_META[context.status] || CONTEXT_STATUS_META.active
        return (
          <button
            key={context.id}
            onClick={() => onOpen(context.id)}
            className={`text-left rounded-[1.75rem] border p-5 transition-all hover:-translate-y-0.5 ${
              isDarkMode ? "bg-[#16181c] border-slate-800 hover:border-slate-700" : "bg-white/80 border-white hover:shadow-lg"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{context.title}</div>
                <div className={`text-sm mt-1 line-clamp-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{context.summary}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs border ${isDarkMode ? statusMeta.dark : statusMeta.light}`}>{statusMeta.label}</span>
            </div>

            <div className={`grid grid-cols-2 gap-2 text-xs mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              <div className="rounded-xl px-3 py-2 border border-transparent bg-black/5">Messages {context.linkedMessageIds.length}</div>
              <div className="rounded-xl px-3 py-2 border border-transparent bg-black/5">Files {context.linkedFileIds.length}</div>
              <div className="rounded-xl px-3 py-2 border border-transparent bg-black/5">Contributors {context.contributorIds.length}</div>
              <div className="rounded-xl px-3 py-2 border border-transparent bg-black/5">Tasks {context.taskIds.length}</div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>Owner {renderOwner(context.ownerId)}</span>
              <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>{formatUpdatedTime(context.updatedAt)}</span>
            </div>
          </button>
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
          <button onClick={onSubmit} className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDarkMode ? "bg-violet-500 text-white hover:bg-violet-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
            {isEditing ? "Save context" : "Create context"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddToContextPopover({ isDarkMode, contexts = [], onClose, onSelect }) {
  return (
    <div className={`rounded-2xl border p-2.5 w-72 shadow-2xl ${isDarkMode ? "bg-[#111317] border-slate-800" : "bg-white border-slate-200"}`}>
      <div className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Add to context</div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {contexts.length === 0 && (
          <div className={`px-3 py-4 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>No contexts in this channel yet.</div>
        )}
        {contexts.map(context => (
          <button
            key={context.id}
            onClick={() => onSelect(context.id)}
            className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${isDarkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"}`}
          >
            <div className="font-medium">{context.title}</div>
            <div className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{context.summary}</div>
          </button>
        ))}
      </div>
      <button onClick={onClose} className={`w-full mt-2 px-3 py-2 rounded-xl text-sm ${isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>Close</button>
    </div>
  )
}

function Section({ title, count, icon, isDarkMode, children }) {
  const SectionIcon = icon
  return (
    <section className={`rounded-[1.5rem] border p-4 ${isDarkMode ? "bg-[#111317] border-slate-800" : "bg-slate-50/80 border-slate-200/80"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SectionIcon className={`w-4 h-4 ${isDarkMode ? "text-violet-300" : "text-indigo-600"}`} />
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
        <div className={`px-6 py-5 border-b ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-2xl font-semibold truncate ${isDarkMode ? "text-white" : "text-slate-800"}`}>{context.title}</h3>
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
            <div className="mt-3 flex flex-wrap gap-2">
              {contributorNames.slice(0, 5).map(name => (
                <span key={name} className={`px-2.5 py-1 rounded-full text-xs ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{name}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 p-5 overflow-y-auto">
          <Section title="Linked Messages" count={linkedMessages.length} icon={MessageSquare} isDarkMode={isDarkMode}>
            <div className="space-y-3">
              {linkedMessages.length === 0 && <div className={`text-sm ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>No linked messages yet.</div>}
              {linkedMessages.map(message => (
                <div key={message.id} className={`rounded-2xl p-3.5 ${isDarkMode ? "bg-slate-900/80" : "bg-white border border-slate-200/80"}`}>
                  <div className={`text-xs mb-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{message.author} · {formatTime(message.timestamp)}</div>
                  <div className={`text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{message.text || "Attachment or task update"}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className={`shrink-0 px-5 py-4 border-t flex items-center gap-3 justify-between ${isDarkMode ? "border-slate-800 bg-[#15171b]" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onAddSelectedMessage}
              disabled={!canAddSelectedMessage}
              className={`px-3 py-2 rounded-xl text-sm font-medium ${canAddSelectedMessage ? isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200" : "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400"}`}
            >
              Add selected
            </button>
            <button onClick={onMarkDecision} className={`px-3 py-2 rounded-xl text-sm font-medium ${isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Mark decision</button>
            <button onClick={onCreateTask} className={`px-3 py-2 rounded-xl text-sm font-medium ${isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Create task</button>
          </div>
          {canEdit && (
            <button onClick={onEdit} className={`px-3 py-2 rounded-xl text-sm font-semibold ${isDarkMode ? "bg-violet-500 text-white hover:bg-violet-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
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
      <div className={`mx-4 sm:mx-8 rounded-[2rem] border p-10 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        No decisions marked yet.
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-8 space-y-3">
      {decisions.map(decision => (
        <button
          key={decision.id}
          onClick={() => onOpenMessage(decision.messageId)}
          className={`w-full text-left rounded-[1.5rem] border p-4 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}
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
      <div className={`mx-4 sm:mx-8 rounded-[2rem] border p-10 text-center ${isDarkMode ? "bg-[#16181c] border-slate-800 text-slate-400" : "bg-white/70 border-white/70 text-slate-500 shadow-sm"}`}>
        No files linked in this channel yet.
      </div>
    )
  }

  return (
    <div className="mx-4 sm:mx-8 space-y-4">
      <div className={`rounded-[1.5rem] border px-5 py-4 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}>
        <div className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Channel Files</div>
        <div className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {files.length} file{files.length === 1 ? "" : "s"} shared in this channel
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {files.map(file => (
        <div key={file.id} className={`rounded-[1.5rem] border p-4 ${isDarkMode ? "bg-[#16181c] border-slate-800" : "bg-white/80 border-white shadow-sm"}`}>
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

export function MessageActionButton({ isDarkMode, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl border shadow-md ${isDarkMode ? "bg-[#111317] border-slate-700 hover:bg-slate-800 text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"}`}
    >
      <MoreVertical className="w-4 h-4" />
    </button>
  )
}

export function MessageSelectionToggle({ isDarkMode, checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
        checked
          ? isDarkMode
            ? "bg-violet-500 border-violet-500 text-white"
            : "bg-indigo-600 border-indigo-600 text-white"
          : isDarkMode
            ? "border-slate-700 text-transparent hover:border-slate-500"
            : "border-slate-300 text-transparent hover:border-slate-500"
      }`}
    >
      <CircleDot className="w-3 h-3" />
    </button>
  )
}
