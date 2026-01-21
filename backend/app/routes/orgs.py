from fastapi import APIRouter, HTTPException
from app.database import organizations_collection
import dns.resolver
import os
import re
import uuid
import time
import random
from datetime import datetime
import resend

# =========================
# Resend configuration
# =========================

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

if not RESEND_API_KEY:
    print("❌ RESEND_API_KEY not set")
    resend = None
else:
    resend.api_key = RESEND_API_KEY

FROM_EMAIL = "onboarding@resend.dev"  # sandbox sender (works without domain)

# =========================
# Router
# =========================

router = APIRouter(prefix="/api/org")

# =========================
# Public email domains
# =========================

PUBLIC_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
}

# =========================
# Utilities
# =========================

def parse_domain_from_email(email: str) -> str:
    m = re.search(r"@([A-Za-z0-9.-]+)$", email)
    return m.group(1).lower() if m else ""

def is_public_email_domain(domain: str) -> bool:
    return domain in PUBLIC_EMAIL_DOMAINS

def build_email_html(subject: str, otp: str, logo_url: str | None):
    logo = f'<img src="{logo_url}" style="max-width:180px;margin-bottom:16px;" />' if logo_url else ""
    return f"""
    <html>
      <body style="font-family:Arial;background:#f7f8fb;padding:20px">
        <div style="max-width:520px;margin:auto;background:white;padding:24px;border-radius:10px">
          {logo}
          <h2>{subject}</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing:3px">{otp}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>
      </body>
    </html>
    """

# =========================
# Email sender (WORKING)
# =========================

def send_email(to_email: str, subject: str, html: str):
    if resend is None:
        raise HTTPException(status_code=500, detail="Email service not configured")

    text = re.sub(r"<[^>]+>", "", html)

    try:
        resp = resend.Emails.send({
            "from": "Spaces <onboarding@resend.dev>",  # ✅ DEFAULT RESEND SENDER
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        })
        print("✅ Email sent:", resp)
        return resp
    except Exception as e:
        print("❌ Resend send failed:", e)
        raise HTTPException(status_code=500, detail="Failed to send verification email")


# =========================
# Register organization
# =========================

@router.post("/register")
def register_org(payload: dict):
    name = payload.get("name")
    admin_email = payload.get("adminEmail")
    logo = payload.get("logoUrl")

    if not name or not admin_email:
        raise HTTPException(status_code=400, detail="name and adminEmail required")

    domain = parse_domain_from_email(admin_email)

    if not domain:
        raise HTTPException(status_code=400, detail="Invalid adminEmail")

    if is_public_email_domain(domain):
        raise HTTPException(status_code=400, detail="Public email domains not allowed")

    # MX check
    try:
        dns.resolver.resolve(domain, "MX")
    except Exception:
        raise HTTPException(status_code=400, detail="Domain has no MX records")

    existing = organizations_collection.find_one({"domain": domain})

    otp = str(uuid.uuid4().int)[:6]
    now = int(time.time())

    if existing:
        organizations_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "verificationToken": otp,
                "verificationTokenExpiresAt": now + 300,
                "emailVerified": False,
            }}
        )
        html = build_email_html("Verify your Spaces account", otp, existing.get("logoUrl"))
        send_email(admin_email, "Spaces verification code", html)
        return {"status": "resent", "message": "OTP resent"}

    doc = {
        "name": name,
        "adminEmail": admin_email,
        "domain": domain,
        "logoUrl": logo,
        "verified": False,
        "emailVerified": False,
        "verificationToken": otp,
        "verificationTokenExpiresAt": now + 300,
        "dnsToken": uuid.uuid4().hex,
        "createdAt": now,
    }

    res = organizations_collection.insert_one(doc)

    html = build_email_html("Verify your Spaces account", otp, logo)
    send_email(admin_email, "Spaces verification code", html)

    return {"status": "created", "message": "OTP sent"}

# =========================
# Verify OTP
# =========================

@router.post("/verify-otp")
def verify_otp(payload: dict):
    email = payload.get("adminEmail")
    code = payload.get("code")

    if not email or not code:
        raise HTTPException(status_code=400, detail="adminEmail and code required")

    org = organizations_collection.find_one({"adminEmail": email})

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if org["verificationToken"] != code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if org["verificationTokenExpiresAt"] < int(time.time()):
        raise HTTPException(status_code=400, detail="OTP expired")

    organizations_collection.update_one(
        {"_id": org["_id"]},
        {"$set": {"emailVerified": True, "emailVerifiedAt": int(time.time())}}
    )

    return {
        "status": "email_verified",
        "dns_token": org["dnsToken"]
    }
