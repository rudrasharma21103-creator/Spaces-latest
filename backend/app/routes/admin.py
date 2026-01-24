from fastapi import APIRouter, HTTPException
from app.database import users_collection, organizations_collection, events_collection, notifications_collection
import time
import statistics
from bson import ObjectId


def sanitize(obj):
    """Recursively convert ObjectId to str and remove _id keys from dicts."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "_id":
                continue
            out[k] = sanitize(v)
        return out
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    return obj

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/overview")
def admin_overview(domain: str = None, adminEmail: str = None):
    if not domain and not adminEmail:
        raise HTTPException(status_code=400, detail="domain or adminEmail required")

    # Prefer explicit domain param, otherwise derive from adminEmail
    if not domain and adminEmail:
        import re
        m = re.search(r"@([A-Za-z0-9.-]+)$", adminEmail)
        domain = m.group(1).lower() if m else None

    if not domain:
        raise HTTPException(status_code=400, detail="Invalid domain")

    org = organizations_collection.find_one({"domain": domain}, {"_id": 0})
    if not org:
        # return minimal company info if org not found
        company = {"name": None, "logoUrl": None, "domain": domain, "adminEmail": None, "verified": False}
    else:
        # keep dnsToken so admins can view DNS TXT verification instructions
        org.pop("verificationToken", None)
        org = sanitize(org)
        company = {
            "name": org.get("name"),
            "logo": org.get("logoUrl"),
            "domain": org.get("domain"),
            "adminEmail": org.get("adminEmail"),
            "verified": bool(org.get("verified", False)),
            "dnsToken": org.get("dnsToken")
        }

    # Employees: users whose email domain matches
    q = {"email": {"$regex": f"@{domain}$", "$options": "i"}}
    employees_raw = list(users_collection.find(q, {"_id": 0}))
    employees = [sanitize(e) for e in employees_raw]
    # sanitize passwords
    for e in employees:
        e.pop("password", None)

    totalEmployees = len(employees)

    # activeToday: users with lastActive in last 24 hours
    cutoff_today = int(time.time()) - 86400
    activeToday = users_collection.count_documents({"email": {"$regex": f"@{domain}$", "$options": "i"}, "lastActive": {"$gte": cutoff_today}})

    # onlineNow: isOnline true
    onlineNow = users_collection.count_documents({"email": {"$regex": f"@{domain}$", "$options": "i"}, "isOnline": True})

    # avgActiveHours: compute from user field "activeHours" if present, otherwise 0
    hours = []
    for u in employees:
        h = u.get("activeHours") or 0
        try:
            hours.append(float(h))
        except Exception:
            pass
    avgActiveHours = statistics.mean(hours) if hours else 0.0

    # recentEvents: combine notifications and events collections (best-effort)
    recent = []
    try:
        recent_notifs = list(notifications_collection.find({"email": {"$regex": f"@{domain}$", "$options": "i"}}, {"_id": 0}).sort("timestamp", -1).limit(20))
        recent_events = list(events_collection.find({"domain": domain}, {"_id": 0}).sort("timestamp", -1).limit(20))
        # normalize simple list and sanitize
        for n in recent_notifs:
            nn = sanitize(n)
            recent.append({"type": nn.get("type"), "msg": nn.get("message") or nn.get("text") or nn})
        for e in recent_events:
            ee = sanitize(e)
            recent.append({"type": ee.get("type") or "event", "msg": ee})
    except Exception:
        recent = []

    # employees summary
    employees_summary = []
    for u in employees:
        # ensure invitePermissions exists and is normalized for the frontend
        inv = u.get("invitePermissions")
        if not isinstance(inv, dict):
            # sensible defaults: org members -> company-only, others -> allow all
            if u.get("organizationId"):
                inv = {"canInviteAll": False, "canInviteCompanyOnly": True}
            else:
                inv = {"canInviteAll": True, "canInviteCompanyOnly": False}
        else:
            # normalize to booleans and provide both keys
            inv = {
                "canInviteAll": bool(inv.get("canInviteAll")),
                "canInviteCompanyOnly": bool(inv.get("canInviteCompanyOnly"))
            }

        employees_summary.append({
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role"),
            "isOnline": bool(u.get("isOnline", False)),
            "lastActive": u.get("lastActive"),
            "activeHours": u.get("activeHours", 0),
            "invitePermissions": inv
        })

    return {
        "company": company,
        "stats": {
            "totalEmployees": totalEmployees,
            "activeToday": activeToday,
            "onlineNow": onlineNow,
            "avgActiveHours": avgActiveHours
        },
        "recentEvents": recent,
        "employees": employees_summary
    }
