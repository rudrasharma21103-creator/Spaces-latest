export const CHANNEL_TABS = ["messages", "contexts", "files", "decisions"]

export const CONTEXT_STATUS_META = {
  active: {
    label: "Active",
    light: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dark: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  blocked: {
    label: "Blocked",
    light: "bg-amber-50 text-amber-700 border-amber-100",
    dark: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  done: {
    label: "Done",
    light: "bg-slate-100 text-slate-700 border-slate-200",
    dark: "bg-slate-700/60 text-slate-200 border-slate-600/80",
  },
}

export function createContextRecord({
  channelId,
  title,
  summary,
  status,
  ownerId,
  createdBy,
  linkedMessageIds = [],
}) {
  const now = new Date().toISOString()
  return {
    id: `context-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    channelId,
    title,
    summary,
    status,
    ownerId,
    contributorIds: [createdBy],
    linkedMessageIds,
    linkedFileIds: [],
    decisionIds: [],
    taskIds: [],
    activity: [
      {
        id: `activity-created-${Date.now()}`,
        type: "created",
        userId: createdBy,
        timestamp: now,
      },
    ],
    createdBy,
    createdAt: now,
    updatedAt: now,
  }
}
