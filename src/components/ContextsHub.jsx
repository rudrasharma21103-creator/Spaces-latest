import React from "react"
import { ArrowLeft, Clock3, FolderOpen } from "lucide-react"

const cx = (...classes) => classes.filter(Boolean).join(" ")

function getStatusTone(status, isDarkMode) {
  if (status === "done") {
    return isDarkMode
      ? "border-slate-600 bg-slate-700/50 text-slate-200"
      : "border-slate-200 bg-slate-100 text-slate-700"
  }
  if (status === "blocked") {
    return isDarkMode
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : "border-amber-100 bg-amber-50 text-amber-700"
  }
  return isDarkMode
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : "border-emerald-100 bg-emerald-50 text-emerald-700"
}

function ContextRow({ context, isDarkMode, onOpenContext, renderOwner, formatUpdatedTime }) {
  const messageCount = (context.linkedMessageIds || []).length
  const fileCount = (context.linkedFileIds || []).length
  const contributorCount = (context.contributorIds || []).length
  const taskCount = (context.taskIds || []).length

  return (
    <article
      onClick={() => onOpenContext(context.id)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpenContext(context.id)
        }
      }}
      role="button"
      tabIndex={0}
      className={cx(
        "text-left transition-all duration-150 hover:-translate-y-0.5",
        isDarkMode
          ? "rounded-[1.5rem] border border-slate-800 bg-[#16181c] p-4 hover:border-slate-700"
          : "rounded-[1.75rem] border border-slate-200/90 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.04)] hover:border-slate-300/90"
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cx("truncate text-[1.05rem] font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>
            {context.title}
          </div>
          {context.summary ? (
            <div className={cx("mt-1 line-clamp-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-400")}>
              {context.summary}
            </div>
          ) : null}
        </div>

        <span className={cx("rounded-full border px-3 py-1 text-xs", getStatusTone(context.status, isDarkMode))}>
          {(context.status || "active").replace(/^\w/, char => char.toUpperCase())}
        </span>
      </div>

      <div className={cx("mb-5 grid grid-cols-2 gap-2 text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>
        <div className={cx("rounded-xl px-3 py-2", isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]")}>
          Messages {messageCount}
        </div>
        <div className={cx("rounded-xl px-3 py-2", isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]")}>
          Files {fileCount}
        </div>
        <div className={cx("rounded-xl px-3 py-2", isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]")}>
          Contributors {contributorCount}
        </div>
        <div className={cx("rounded-xl px-3 py-2", isDarkMode ? "border border-white/5 bg-black/5" : "bg-[#f3f5f7]")}>
          Tasks {taskCount}
        </div>
      </div>

      <div className={cx("flex flex-wrap items-center justify-between gap-3 text-xs", isDarkMode ? "text-slate-500" : "text-slate-400")}>
        <span>Owner {renderOwner(context.ownerId)}</span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {formatUpdatedTime(context.updatedAt)}
        </span>
      </div>
    </article>
  )
}

export default function ContextsHub({
  isDarkMode = false,
  contexts = [],
  renderOwner,
  formatUpdatedTime,
  onBack,
  onOpenContext,
  sourceLabel = "",
}) {
  return (
    <div className={cx("min-h-[100dvh] w-full overflow-y-auto", isDarkMode ? "bg-[#0a1118] text-slate-100" : "bg-[#fafbfc] text-slate-900")}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1520px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className={cx("shrink-0 border-b pb-4", isDarkMode ? "border-white/10" : "border-slate-200/90")}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={onBack}
                className={cx(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                  isDarkMode ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <div className={cx("truncate text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                  Contexts
                </div>
                <div className={cx("truncate text-[1.05rem] font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>
                  {sourceLabel || "Captured channel contexts"}
                </div>
              </div>
            </div>

            <div className={cx("inline-flex rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-600 shadow-sm")}>
              {contexts.length} visible
            </div>
          </div>
        </header>

        <div className="flex-1 py-6">
          {contexts.length === 0 ? (
            <div className={cx("flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed px-6 text-center", isDarkMode ? "border-white/10 bg-white/[0.03] text-slate-400" : "border-slate-200 bg-white text-slate-500")}>
              <div className="max-w-md">
                <div className={cx("mx-auto flex h-14 w-14 items-center justify-center rounded-[20px]", isDarkMode ? "bg-white/[0.06] text-sky-300" : "bg-[#f3f5f7] text-slate-600")}>
                  <FolderOpen className="h-7 w-7" />
                </div>
                <div className={cx("mt-4 text-lg font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>No contexts yet</div>
                <p className="mt-2 text-sm leading-6">Create one from key messages to turn the channel into a cleaner review surface.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-[440px] space-y-4">
              {contexts.map(context => (
                <ContextRow
                  key={context.id}
                  context={context}
                  isDarkMode={isDarkMode}
                  onOpenContext={onOpenContext}
                  renderOwner={renderOwner}
                  formatUpdatedTime={formatUpdatedTime}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
