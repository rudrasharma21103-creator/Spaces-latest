from fastapi import APIRouter, HTTPException
from app.ws_manager import manager
from app.database import organizations_collection
import dns.resolver
import os
import re
import uuid
import time
import resend

# =========================
# Resend configuration
# =========================

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

if not RESEND_API_KEY:
    raise RuntimeError("RESEND_API_KEY not set")

resend.api_key = RESEND_API_KEY

# Resend sandbox sender (DEV MODE)
FROM_EMAIL = "Spaces <rudra@spacess.in>"

# =========================
# Router
# =========================

router = APIRouter(prefix="/api/org", tags=["Organizations"])

# =========================
# Public email domains block
# =========================

PUBLIC_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "aol.com",
}

# =========================
# Utilities
# =========================

def parse_domain_from_email(email: str) -> str:
    match = re.search(r"@([A-Za-z0-9.-]+)$", email)
    return match.group(1).lower() if match else ""

def is_public_domain(domain: str) -> bool:
    return domain in PUBLIC_EMAIL_DOMAINS

def build_email_html(otp: str, logo_url: str | None):
    logo = f'<img src="{logo_url}" style="max-width:160px;margin-bottom:16px" />' if logo_url else ""
    return f"""
    <html>
      <body style="font-family:Arial;background:#f7f8fb;padding:20px">
        <div style="max-width:520px;margin:auto;background:white;padding:24px;border-radius:10px">
          {logo}
          <h2>Verify your organization</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing:4px">{otp}</h1>
          <p>This code expires in <b>5 minutes</b>.</p>
        </div>
      </body>
    </html>
    """

def send_email(to_email: str, subject: str, html: str):
    text = re.sub(r"<[^>]+>", "", html)
    try:
        return resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        })
    except Exception as e:
        print("❌ Email send failed:", e)
        raise HTTPException(status_code=500, detail="Failed to send email")

# =========================
# Register organization
# =========================

@router.post("/register")
def register_org(payload: dict):
    name = payload.get("name")
    admin_email = payload.get("adminEmail")
    logo_url = payload.get("logoUrl")

    if not name or not admin_email:
        raise HTTPException(400, "name and adminEmail required")

    domain = parse_domain_from_email(admin_email)

    if not domain:
        raise HTTPException(400, "Invalid admin email")

    # 1️⃣ Reject public domains
    if is_public_domain(domain):
        raise HTTPException(400, "Public email domains are not allowed")

    # 2️⃣ MX check
    try:
        dns.resolver.resolve(domain, "MX")
    except Exception:
        raise HTTPException(400, "Email domain has no MX records")

    existing = organizations_collection.find_one({"domain": domain})

    otp = str(uuid.uuid4().int)[:6]
    now = int(time.time())

    # 3️⃣ Domain already exists
    if existing:
        if existing.get("verified"):
            raise HTTPException(400, "Domain already registered")

        organizations_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "verificationToken": otp,
                "verificationTokenExpiresAt": now + 300,
                "status": "pending",
            }}
        )

        html = build_email_html(otp, existing.get("logoUrl"))
        send_email(admin_email, "Spaces verification code", html)

        return {"status": "resent", "message": "OTP resent"}

    # 4️⃣ New organization
    org = {
        "name": name,
        "adminEmail": admin_email,
        "domain": domain,
        "logoUrl": logo_url,
        "status": "pending",
        "verified": False,
        "verificationMethod": None,

        # Email OTP
        "verificationToken": otp,
        "verificationTokenExpiresAt": now + 300,

        # DNS ownership
        "dnsToken": uuid.uuid4().hex,

        "createdAt": now,
    }

    organizations_collection.insert_one(org)

    html = build_email_html(otp, logo_url)
    send_email(admin_email, "Spaces verification code", html)

    return {"status": "created", "message": "OTP sent"}

# =========================
# Verify email OTP (Level-1)
# =========================

@router.post("/verify-otp")
def verify_otp(payload: dict):
    email = payload.get("adminEmail")
    code = payload.get("code")

    if not email or not code:
        raise HTTPException(400, "adminEmail and code required")

    org = organizations_collection.find_one({"adminEmail": email})
    if not org:
        raise HTTPException(404, "Organization not found")

    if org["verificationToken"] != code:
        raise HTTPException(400, "Invalid OTP")

    if org["verificationTokenExpiresAt"] < int(time.time()):
        raise HTTPException(400, "OTP expired")

    organizations_collection.update_one(
        {"_id": org["_id"]},
        {"$set": {
            "status": "email_verified",
            "emailVerifiedAt": int(time.time())
        }}
    )

    return {
        "status": "email_verified",
        "dns_instructions": {
            "type": "TXT",
            "name": "@",
            "value": f"spaces-verify={org['dnsToken']}"
        }
    }

import httpx
import time

@router.get("/check-dns")
async def check_dns(domain: str):
    org = organizations_collection.find_one({"domain": domain})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    expected_token = f"spaces-verify={org['dnsToken']}"
    print("Expected token:", expected_token)

    try:
        # 🔸 Use Cloudflare DNS to avoid stale cache
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://cloudflare-dns.com/dns-query",
                params={"name": domain, "type": "TXT", "_": str(int(time.time()))},
                headers={"accept": "application/dns-json"}
            )
            data = resp.json()

        # Extract all TXT records
        txt_records = [a.get("data", "").strip('"') for a in data.get("Answer", []) if "data" in a]
        for record in txt_records:
            print("🔍 Found TXT:", record)

        # ✅ Check for match
        if expected_token in txt_records:
            organizations_collection.update_one(
                {"_id": org["_id"]},
                {"$set": {
                    "verified": True,
                    "dns_verified": True,
                    "verificationMethod": "dns",
                    "verifiedAt": int(time.time()),
                    "status": "verified"
                }}
            )
            print(f"✅ Domain {domain} verified successfully")
            # Notify connected clients (notifications socket) that this domain was verified
            try:
                print(f"Sending org_verified websocket message for domain: {domain}")
                await manager.broadcast("notifications", {"type": "org_verified", "domain": domain})
            except Exception as e:
                print("Failed to send org_verified websocket message:", e)
            return {"verified": True, "status": "verified"}

        print("❌ Token not found in TXT records")
        return {"verified": False, "status": "not_verified"}

    except Exception as e:
        print("DNS check error:", e)
        raise HTTPException(status_code=500, detail=str(e))

# =========================
# Get organization (safe)
# =========================

@router.get("/org/{domain}")
def get_org(domain: str):
    org = organizations_collection.find_one({"domain": domain}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organization not found")

    org.pop("verificationToken", None)
    org.pop("dnsToken", None)

    return org
