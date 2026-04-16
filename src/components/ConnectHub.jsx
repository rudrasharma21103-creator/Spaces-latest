import React, { useEffect, useMemo, useState } from "react"
import { BriefcaseBusiness, CheckCircle2, ExternalLink, Link2, LoaderCircle, Search, ShieldCheck, Sparkles, Users } from "lucide-react"
import * as Storage from "../services/storage"

const cx = (...classes) => classes.filter(Boolean).join(" ")

const getProfessionalProfile = user => {
  const profile = user?.professionalProfile || {}
  return {
    companyName: profile.companyName || user?.companyName || "",
    position: profile.position || user?.position || "",
    linkedInUrl: profile.linkedInUrl || profile.linkedinUrl || user?.linkedInUrl || user?.linkedinUrl || "",
  }
}

const getResultMeta = person => {
  const profile = person?.professionalProfile || {}
  return {
    headline: profile.position && profile.companyName ? `${profile.position} at ${profile.companyName}` : profile.position || profile.companyName || "",
    linkedInUrl: profile.linkedInUrl || "",
  }
}

const patchResults = (items, personId, patch) => items.map(item => String(item.id) === String(personId) ? { ...item, ...patch } : item)

const getLocalRelationship = (person, currentUser, friends, pendingRequests) => {
  const personId = String(person?.id || "")
  if (personId && personId === String(currentUser?.id || "")) return { relationshipStatus: "self", incomingRequestNotificationId: null }
  if (new Set((friends || []).map(friend => String(friend?.id || friend))).has(personId)) return { relationshipStatus: "connected", incomingRequestNotificationId: null }
  const incomingRequest = (pendingRequests || []).find(request => String(request?.fromId || "") === personId)
  if (incomingRequest) return { relationshipStatus: "incoming_request", incomingRequestNotificationId: incomingRequest.id || null }
  return { relationshipStatus: "can_connect", incomingRequestNotificationId: null }
}

const buildInstantResults = (query, currentUser, friends, pendingRequests) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  return Storage.peekUsers()
    .filter(user => (user?.name || "").toLowerCase().includes(normalizedQuery))
    .slice(0, 10)
    .map(user => {
      const profile = getProfessionalProfile(user)
      return {
        id: user.id,
        name: user.name || "",
        avatar_url: user.avatar_url,
        avatar_preset: user.avatar_preset,
        professionalProfile: profile.companyName || profile.position || profile.linkedInUrl ? profile : null,
        ...getLocalRelationship(user, currentUser, friends, pendingRequests),
      }
    })
}

const getActionLabel = status => status === "connected" ? "Message" : status === "outgoing_request" ? "Pending" : status === "incoming_request" ? "Accept" : status === "self" ? "You" : "Connect"

export default function ConnectHub({
  currentUser,
  friends = [],
  pendingRequests = [],
  renderAvatar,
  onOpenDM,
  onAcceptRequest,
  onRejectRequest,
  onConnectUser,
  isDarkMode = false,
}) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [savingIds, setSavingIds] = useState([])

  const currentProfile = useMemo(() => getProfessionalProfile(currentUser), [currentUser])
  const profileStrength = [currentProfile.companyName, currentProfile.position, currentProfile.linkedInUrl].filter(Boolean).length

  const ui = {
    shell: isDarkMode ? "border-white/10 bg-white/[0.04]" : "border-[#e8edf4] bg-white",
    soft: isDarkMode ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]" : "border-[#ebf0f6] bg-white hover:bg-[#fcfdff]",
    tint: isDarkMode ? "border-white/10 bg-white/[0.03]" : "border-[#dfe8f2] bg-[#fbfdff]",
    textPrimary: isDarkMode ? "text-white" : "text-[#102036]",
    textSecondary: isDarkMode ? "text-slate-300" : "text-[#42526b]",
    textMuted: isDarkMode ? "text-slate-400" : "text-[#6d7b91]",
    textSoft: isDarkMode ? "text-slate-500" : "text-[#8a97aa]",
    input: isDarkMode ? "border-white/10 bg-[#07111d]/80 text-white placeholder:text-slate-500" : "border-[#dbe5ef] bg-white text-[#102036] placeholder:text-[#98a6b8]",
    primaryButton: isDarkMode ? "bg-white text-slate-950 hover:bg-slate-100" : "bg-[#102036] text-white hover:bg-[#1b2e49]",
    secondaryButton: isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.09]" : "border-[#dde6ef] bg-white text-[#334155] hover:bg-[#f8fbff]",
    pill: isDarkMode ? "border-white/10 bg-white/[0.05] text-slate-200" : "border-[#e4ebf2] bg-white text-[#4b5b72]",
  }

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query.trim()), 120)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    let ignore = false

    if (!debouncedQuery) {
      setResults([])
      setSearchError("")
      setLoadingResults(false)
      return
    }

    const instantResults = buildInstantResults(debouncedQuery, currentUser, friends, pendingRequests)
    setResults(instantResults)
    setLoadingResults(true)
    setSearchError("")

    Storage.searchUsersByName(debouncedQuery, { limit: 12, cacheTtl: 15000 })
      .then(items => {
        if (!ignore) setResults(Array.isArray(items) ? items : [])
      })
      .catch(() => {
        if (!ignore && instantResults.length === 0) {
          setResults([])
          setSearchError("We could not load matches right now. Please try again.")
        }
      })
      .finally(() => {
        if (!ignore) setLoadingResults(false)
      })

    return () => {
      ignore = true
    }
  }, [currentUser, debouncedQuery, friends, pendingRequests])

  const handlePersonAction = async person => {
    if (!person || savingIds.includes(person.id)) return
    if (person.relationshipStatus === "connected") {
      onOpenDM?.(person.id)
      return
    }
    if (person.relationshipStatus === "self" || person.relationshipStatus === "outgoing_request") return

    setSavingIds(prev => [...prev, person.id])

    try {
      if (person.relationshipStatus === "incoming_request" && person.incomingRequestNotificationId) {
        await onAcceptRequest?.(person.incomingRequestNotificationId)
        setResults(prev => patchResults(prev, person.id, { relationshipStatus: "connected", incomingRequestNotificationId: null }))
        return
      }

      const response = await onConnectUser?.(person.id)
      if (response?.status === "already_connected") {
        setResults(prev => patchResults(prev, person.id, { relationshipStatus: "connected" }))
      } else if (response?.status === "incoming_request") {
        setResults(prev => patchResults(prev, person.id, { relationshipStatus: "incoming_request", incomingRequestNotificationId: response?.notificationId || null }))
      } else {
        setResults(prev => patchResults(prev, person.id, { relationshipStatus: "outgoing_request" }))
      }
    } finally {
      setSavingIds(prev => prev.filter(id => String(id) !== String(person.id)))
    }
  }

  const renderPersonCard = person => {
    const meta = getResultMeta(person)
    const isBusy = savingIds.includes(person.id)
    const disabled = person.relationshipStatus === "self" || person.relationshipStatus === "outgoing_request" || isBusy

    return (
      <div key={person.id} className={cx("rounded-[24px] border p-4 transition sm:p-5", ui.soft, !isDarkMode && "hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]")}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className={cx("flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[20px]", isDarkMode ? "bg-white/[0.04]" : "bg-[#f3f7fb]")}>
              {renderAvatar(person, 50)}
            </div>
            <div className="min-w-0">
              <div className={cx("truncate text-[1.08rem] font-semibold", ui.textPrimary)}>{person.name}</div>
              <div className={cx("mt-1 text-sm leading-6", meta.headline ? ui.textSecondary : ui.textMuted)}>{meta.headline || "Professional details appear here when available."}</div>
              <div className={cx("mt-1.5 text-sm", ui.textMuted)}>
                {person.relationshipStatus === "connected"
                  ? "Already in your network."
                  : person.relationshipStatus === "incoming_request"
                    ? "This person sent you a request."
                    : person.relationshipStatus === "outgoing_request"
                      ? "Your request is waiting for a response."
                      : person.relationshipStatus === "self"
                        ? "This is you."
                        : "Available to connect."}
              </div>
              {meta.linkedInUrl ? (
                <a href={meta.linkedInUrl} target="_blank" rel="noreferrer" className={cx("mt-3 inline-flex items-center gap-1.5 text-sm font-medium", isDarkMode ? "text-sky-300 hover:text-sky-200" : "text-sky-700 hover:text-sky-800")}>
                  <Link2 className="h-3.5 w-3.5" />
                  LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {person.relationshipStatus === "connected" ? <CheckCircle2 className={cx("h-5 w-5", isDarkMode ? "text-emerald-300" : "text-emerald-600")} /> : null}
            <button type="button" onClick={() => handlePersonAction(person)} disabled={disabled} className={cx("inline-flex min-w-[118px] items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60", person.relationshipStatus === "connected" ? ui.secondaryButton : ui.primaryButton)}>
              {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : getActionLabel(person.relationshipStatus)}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_320px]">
      <div className="space-y-5">
        <section className={cx("rounded-[28px] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] sm:p-6", ui.shell)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", ui.pill)}>
                  <Search className="h-3.5 w-3.5" />
                  Find people
                </div>
                <div className={cx("mt-3 text-[1.45rem] font-semibold tracking-[-0.03em]", ui.textPrimary)}>Search your network by name</div>
                <p className={cx("mt-1.5 max-w-2xl text-sm leading-6", ui.textMuted)}>
                  A cleaner people-search experience focused on fast scanning, professional context, and simple connect actions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  ["People", true],
                  ["Connected", friends.length > 0],
                  ["Pending", pendingRequests.length > 0],
                  ["Profile ready", profileStrength > 0],
                ].map(([label, active]) => (
                  <span key={label} className={cx("rounded-full border px-3 py-1.5 text-sm font-medium", active ? ui.secondaryButton : ui.pill)}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <label className="relative block">
              <Search className={cx("pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2", ui.textSoft)} />
              <input
                type="text"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search for teammates, collaborators, or friends"
                className={cx("h-14 w-full rounded-[22px] border pl-14 pr-4 text-[15px] outline-none transition", ui.input)}
              />
            </label>
          </div>
        </section>

        {pendingRequests.length > 0 ? (
          <section className={cx("rounded-[28px] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] sm:p-6", ui.shell)}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={cx("text-[1.15rem] font-semibold tracking-[-0.03em]", ui.textPrimary)}>Pending requests</div>
                <p className={cx("mt-1 text-sm", ui.textMuted)}>Respond here without leaving the connect workspace.</p>
              </div>
              <div className={cx("rounded-full border px-3 py-1 text-xs font-semibold", ui.pill)}>{pendingRequests.length}</div>
            </div>

            <div className="mt-4 space-y-2.5">
              {pendingRequests.map(request => (
                <div key={request.id} className={cx("flex flex-col gap-3 rounded-[22px] border p-4 sm:flex-row sm:items-center sm:justify-between", ui.soft)}>
                  <div>
                    <div className={cx("text-sm font-semibold", ui.textPrimary)}>{request.from || "New request"}</div>
                    <div className={cx("mt-1 text-sm", ui.textMuted)}>Sent you a connection request.</div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => onRejectRequest?.(request.id)} className={cx("rounded-full border px-4 py-2.5 text-sm font-semibold transition", ui.secondaryButton)}>
                      Ignore
                    </button>
                    <button type="button" onClick={() => onAcceptRequest?.(request.id)} className={cx("rounded-full px-4 py-2.5 text-sm font-semibold transition", ui.primaryButton)}>
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={cx("rounded-[28px] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] sm:p-6", ui.shell)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={cx("text-[1.25rem] font-semibold tracking-[-0.03em]", ui.textPrimary)}>Search results</div>
              <p className={cx("mt-1.5 text-sm leading-6", ui.textMuted)}>
                {debouncedQuery
                  ? loadingResults && results.length > 0
                    ? "Showing quick matches first while the backend refreshes."
                    : "Results are coming from the backend in real time."
                  : "Start typing above to look for people in your network."}
              </p>
            </div>
            <div className={cx("rounded-full border px-3 py-1 text-xs font-semibold", ui.pill)}>{results.length}</div>
          </div>

          <div className="mt-5">
            {loadingResults && results.length === 0 ? (
              <div className={cx("flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed text-center", isDarkMode ? "border-white/10 bg-white/[0.02]" : "border-[#e5edf5] bg-[#fbfdff]")}>
                <LoaderCircle className={cx("h-6 w-6 animate-spin", ui.textSoft)} />
                <p className={cx("mt-3 text-sm", ui.textMuted)}>Searching people...</p>
              </div>
            ) : searchError ? (
              <div className={cx("min-h-[220px] rounded-[24px] border border-dashed px-6 py-10 text-center", isDarkMode ? "border-rose-400/20 bg-rose-500/5 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700")}>
                {searchError}
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">{results.map(renderPersonCard)}</div>
            ) : (
              <div className={cx("min-h-[220px] rounded-[24px] border border-dashed px-6 py-10 text-center", isDarkMode ? "border-white/10 bg-white/[0.02]" : "border-[#e5edf5] bg-[#fbfdff]")}>
                <div className={cx("mx-auto flex h-16 w-16 items-center justify-center rounded-full", isDarkMode ? "bg-white/[0.05] text-slate-300" : "bg-white text-[#506176] shadow-[0_12px_24px_rgba(15,23,42,0.06)]")}>
                  <Users className="h-7 w-7" />
                </div>
                <div className={cx("mt-5 text-xl font-semibold", ui.textPrimary)}>{debouncedQuery ? "No matching people found" : "Search for someone new"}</div>
                <p className={cx("mx-auto mt-2 max-w-md text-sm leading-6", ui.textMuted)}>
                  {debouncedQuery ? "Try another spelling or a shorter name to widen the search." : "Type a name above to search the backend for possible connections."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className={cx("rounded-[28px] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] sm:p-6", ui.shell)}>
          <div className={cx("text-sm font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Network pulse</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[["Connections", friends.length], ["Pending", pendingRequests.length]].map(([label, value]) => (
              <div key={label} className={cx("rounded-[20px] border p-4", ui.tint)}>
                <div className={cx("text-[1.8rem] font-semibold", ui.textPrimary)}>{value}</div>
                <div className={cx("mt-1 text-sm", ui.textMuted)}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={cx("rounded-[28px] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)] sm:p-6", ui.shell)}>
          <div className="flex items-start gap-4">
            <div className={cx("flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px]", isDarkMode ? "bg-white/[0.05]" : "bg-[#f3f7fb]")}>
              {currentUser ? renderAvatar(currentUser, 52) : null}
            </div>
            <div className="min-w-0">
              <div className={cx("text-[1.05rem] font-semibold", ui.textPrimary)}>{currentUser?.name}</div>
              <div className={cx("mt-1 text-sm leading-6", ui.textMuted)}>
                {profileStrength > 0 ? "Your profile has enough context to look credible in search." : "Add role, company, or LinkedIn from Settings to strengthen your card."}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className={cx("rounded-[18px] border px-4 py-3", ui.tint)}>
              <div className={cx("text-[11px] font-semibold uppercase tracking-[0.18em]", ui.textSoft)}>Profile strength</div>
              <div className={cx("mt-1 text-base font-semibold", ui.textPrimary)}>{profileStrength}/3 fields added</div>
            </div>
            {currentProfile.position || currentProfile.companyName ? (
              <div className={cx("rounded-[18px] border px-4 py-3", ui.tint)}>
                <div className={cx("flex items-center gap-2 text-sm font-medium", ui.textPrimary)}>
                  <BriefcaseBusiness className="h-4 w-4" />
                  {currentProfile.position && currentProfile.companyName ? `${currentProfile.position} at ${currentProfile.companyName}` : currentProfile.position || currentProfile.companyName}
                </div>
              </div>
            ) : null}
            <div className={cx("rounded-[18px] border px-4 py-3 text-sm leading-6", ui.tint, ui.textSecondary)}>
              <ShieldCheck className="mb-2 h-4 w-4" />
              Keep the page focused on discovery. Manage profile details from the homepage settings menu.
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
