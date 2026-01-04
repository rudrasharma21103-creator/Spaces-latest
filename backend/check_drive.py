from app.core.drive import _default_service_account_path
from google.oauth2 import service_account

path = _default_service_account_path()
print('service-account path:', path)
if not path.exists():
    print('MISSING: service-account.json not found')
else:
    try:
        creds = service_account.Credentials.from_service_account_file(str(path))
        info = creds.service_account_email if hasattr(creds, 'service_account_email') else None
        print('LOADED credentials, service account email:', info)
    except Exception as e:
        print('FAILED to load credentials:', e)
