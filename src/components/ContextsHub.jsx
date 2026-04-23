import React, { useMemo } from "react"
import { ArrowLeft, Clock3, FolderOpen, MessageSquare, Users } from "lucide-react"

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

function SummaryMetric({ label, value, hint, isDarkMode }) {
  return (
    <div
      className={cx(
        "rounded-[20px] border px-4 py-3.5",
        isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/88 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      )}
    >
      <div className={cx("text-[10px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
        {label}
      </div>
      <div className={cx("mt-1.5 text-[1.35rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-950")}>
        {value}
      </div>
      {hint ? (
        <div className={cx("mt-1 text-xs", isDarkMode ? "text-slate-500" : "text-slate-500")}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function ContextCard({ context, isDarkMode, onOpen, renderOwner, formatUpdatedTime }) {
  const messageCount = (context.linkedMessageIds || []).length
  const contributorCount = (context.contributorIds || []).length

  return (
    <article
      onClick={() => onOpen(context.id)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(context.id)
        }
      }}
      role="button"
      tabIndex={0}
      className={cx(
        "group rounded-[24px] border p-5 transition-all duration-150",
        isDarkMode
          ? "border-white/10 bg-white/[0.03] hover:border-sky-400/20 hover:bg-white/[0.05]"
          : "border-slate-200/80 bg-white/92 hover:border-slate-300/80 hover:shadow-[0_18px_44px_rgba(15,23,42,0.06)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cx(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
                getStatusTone(context.status, isDarkMode)
              )}
            >
              {context.status || "active"}
            </span>
            <span className={cx("text-[11px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
              Context
            </span>
          </div>
          <h2 className={cx("mt-3 text-[1.2rem] font-semibold tracking-[-0.04em]", isDarkMode ? "text-white" : "text-slate-950")}>
            {context.title}
          </h2>
          <p className={cx("mt-2 max-w-2xl text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-600")}>
            {context.summary || "Review the linked conversation, captured decisions, and related follow-up work."}
          </p>
        </div>

        <div className={cx("rounded-full px-3 py-1.5 text-xs font-semibold transition", isDarkMode ? "bg-white/[0.05] text-slate-300 group-hover:bg-white/[0.08]" : "bg-slate-100 text-slate-700")}>
          Open reading view
        </div>
      </div>

      <div className={cx("mt-5 grid gap-3 border-t pt-4 sm:grid-cols-3", isDarkMode ? "border-white/8" : "border-slate-200/80")}>
        <div>
          <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
            Owner
          </div>
          <div className={cx("mt-1.5 text-sm font-medium", isDarkMode ? "text-slate-200" : "text-slate-800")}>
            {renderOwner(context.ownerId)}
          </div>
        </div>
        <div>
          <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
            Linked messages
          </div>
          <div className={cx("mt-1.5 inline-flex items-center gap-2 text-sm font-medium", isDarkMode ? "text-slate-200" : "text-slate-800")}>
            <MessageSquare className="h-4 w-4" />
            {messageCount}
          </div>
        </div>
        <div>
          <div className={cx("text-[10px] font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
            Contributors
          </div>
          <div className={cx("mt-1.5 inline-flex items-center gap-2 text-sm font-medium", isDarkMode ? "text-slate-200" : "text-slate-800")}>
            <Users className="h-4 w-4" />
            {contributorCount}
          </div>
        </div>
      </div>

      <div className={cx("mt-4 flex flex-wrap items-center gap-4 text-xs", isDarkMode ? "text-slate-500" : "text-slate-500")}>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          Updated {formatUpdatedTime(context.updatedAt)}
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
  const summary = useMemo(() => {
    return contexts.reduce(
      (acc, context) => {
        acc.contexts += 1
        acc.messages += (context.linkedMessageIds || []).length
        acc.contributors += (context.contributorIds || []).length
        return acc
      },
      { contexts: 0, messages: 0, contributors: 0 }
    )
  }, [contexts])

  return (
    <div className={cx("min-h-[100dvh] w-full overflow-y-auto", isDarkMode ? "bg-[#0a1118] text-slate-100" : "bg-[#eff4f8] text-slate-900")}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1520px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className={cx("shrink-0 border-b pb-5", isDarkMode ? "border-white/10" : "border-slate-200/80")}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <button
                  onClick={onBack}
                  className={cx(
                    "mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                    isDarkMode ? "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  title="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="min-w-0">
                  <div className={cx("text-[11px] font-semibold uppercase tracking-[0.22em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    Context Workspace
                  </div>
                  <h1 className={cx("mt-2 text-[1.7rem] font-semibold tracking-[-0.05em] sm:text-[1.95rem]", isDarkMode ? "text-white" : "text-slate-950")}>
                    Contexts
                  </h1>
                  <p className={cx("mt-2 max-w-3xl text-sm leading-6", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                    Review captured threads, open a focused reading view, and move from raw conversation to organized context without leaving the workflow.
                  </p>
                  {sourceLabel ? (
                    <div className={cx("mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-medium", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-600 shadow-sm")}>
                      {sourceLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[440px]">
              <SummaryMetric label="Contexts" value={summary.contexts} hint="Captured threads" isDarkMode={isDarkMode} />
              <SummaryMetric label="Messages" value={summary.messages} hint="Linked into review" isDarkMode={isDarkMode} />
              <SummaryMetric label="Contributors" value={summary.contributors} hint="Visible participants" isDarkMode={isDarkMode} />
            </div>
          </div>
        </header>

        <div className="flex-1 py-6">
          {contexts.length === 0 ? (
            <div className={cx("flex min-h-[360px] items-center justify-center rounded-[28px] border border-dashed px-6 text-center", isDarkMode ? "border-white/10 bg-white/[0.03] text-slate-400" : "border-slate-200 bg-white/70 text-slate-500")}>
              <div className="max-w-md">
                <div className={cx("mx-auto flex h-14 w-14 items-center justify-center rounded-[20px]", isDarkMode ? "bg-white/[0.06] text-sky-300" : "bg-white text-sky-700 shadow-sm")}>
                  <FolderOpen className="h-7 w-7" />
                </div>
                <div className={cx("mt-4 text-lg font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>No contexts yet</div>
                <p className="mt-2 text-sm leading-6">Create one from key messages to turn the channel into a cleaner, searchable review surface.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className={cx("text-[11px] font-semibold uppercase tracking-[0.2em]", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    Review Queue
                  </div>
                  <div className={cx("mt-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                    Open any context below to read the linked conversation in a dedicated workspace.
                  </div>
                </div>
                <div className={cx("inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-slate-600 shadow-sm")}>
                  {contexts.length} visible
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {contexts.map(context => (
                  <ContextCard
                    key={context.id}
                    context={context}
                    isDarkMode={isDarkMode}
                    onOpen={onOpenContext}
                    renderOwner={renderOwner}
                    formatUpdatedTime={formatUpdatedTime}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
