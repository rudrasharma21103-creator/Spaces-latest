from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from starlette import status
from app.database import files_collection
import tempfile
import os
import shutil
from datetime import datetime, timezone
from bson import ObjectId
from bson.binary import Binary
import io

router = APIRouter(prefix="/upload")

# Helper to add CORS headers to any response for this router
def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }

# Handle CORS preflight requests for /file/{file_id}
@router.options("/file/{file_id}")
def options_file_metadata(file_id: str):
    return Response(status_code=200, headers=_cors_headers())

@router.options("/file/{file_id}/download")
def options_file_download(file_id: str):
    return Response(status_code=200, headers=_cors_headers())

# Directory to store uploaded files inside the backend
STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploaded_files"))
os.makedirs(STORAGE_DIR, exist_ok=True)


def _save_temp(upload: UploadFile):
    # Save uploaded file to a temporary file and return path and size
    suffix = ""
    if upload.filename and "." in upload.filename:
        suffix = "." + upload.filename.rsplit(".", 1)[1]

    tf = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(upload.file, tf)
        tf.flush()
        size = os.path.getsize(tf.name)
        return tf.name, size
    finally:
        tf.close()


def _do_upload_and_update(doc_id, path, name, mime_type):
    try:
        # Read file bytes and store them in MongoDB (files_collection)
        try:
            with open(path, "rb") as f:
                data = f.read()
        except Exception as e:
            files_collection.update_one({"_id": doc_id}, {"$set": {"status": "error", "error": str(e)}})
            return

        final_size = len(data) if data is not None else None

        download_path = f"/upload/file/{str(doc_id)}/download"

        files_collection.update_one({"_id": doc_id}, {"$set": {"status": "done", "fileId": str(doc_id), "name": name, "size": final_size, "webViewLink": download_path, "data": Binary(data)}})
    except Exception as e:
        files_collection.update_one({"_id": doc_id}, {"$set": {"status": "error", "error": str(e)}})
    finally:
        # Ensure temp file is removed
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


@router.post("/file")
async def upload_file(request: Request, background: BackgroundTasks, file: UploadFile = File(...)):
    # Accept file and schedule upload in background so chat routes are not blocked.
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded")

    # Save to temp file quickly
    try:
        tmp_path, size = _save_temp(file)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    doc = {
        "filename": file.filename,
        "mimetype": file.content_type,
        "size": size,
        "status": "uploading",
        # Use UTC ISO string so clients can convert to local time reliably
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    res = files_collection.insert_one(doc)
    doc_id = res.inserted_id

    # Schedule background upload
    background.add_task(_do_upload_and_update, doc_id, tmp_path, file.filename, file.content_type)

    # Return metadata document (without blocking for Drive upload)
    return {"status": "accepted", "file_id": str(doc_id), "filename": file.filename, "size": size}


@router.get("/file/{file_id}")
def get_file_metadata(file_id: str):
    try:
        oid = ObjectId(file_id)
    except Exception:
        return JSONResponse({"error": "invalid id"}, headers=_cors_headers())
    doc = files_collection.find_one({"_id": oid}, {"_id": 0, "data": 0})
    if not doc:
        return JSONResponse({"error": "not found"}, headers=_cors_headers())
    # Normalize URL fields expected by the frontend (`url` / `public_url` / `previewUrl`)
    # Support older `webViewLink` field as well.
    web_link = doc.get("webViewLink")
    # If no explicit webViewLink present, build a download path
    if not web_link:
        web_link = f"/upload/file/{file_id}/download"

    doc.setdefault("url", web_link)
    doc.setdefault("public_url", web_link)

    # For image/pdf preview, allow `previewUrl` to point to same download endpoint
    if not doc.get("previewUrl"):
        doc["previewUrl"] = web_link

    return JSONResponse(doc, headers=_cors_headers())


@router.get("/file/{file_id}/download")
def download_file(file_id: str):
    try:
        oid = ObjectId(file_id)
    except Exception:
        return JSONResponse({"error": "invalid id"}, status_code=400, headers=_cors_headers())

    doc = files_collection.find_one({"_id": oid})
    if not doc:
        return JSONResponse({"error": "not found"}, status_code=404, headers=_cors_headers())

    data = doc.get("data")
    if not data:
        return JSONResponse({"error": "file not found"}, status_code=404, headers=_cors_headers())

    # `data` may be a bson.Binary; convert to bytes
    try:
        raw = bytes(data)
    except Exception:
        raw = data

    # Use inline disposition so browsers can preview images / PDFs; user can still save from UI
    return StreamingResponse(
        io.BytesIO(raw),
        media_type=doc.get("mimetype"),
        headers={
            "Content-Disposition": f"inline; filename=\"{doc.get('filename')}\"",
            **_cors_headers()
        }
    )
