"""
GridFS Storage Service
Provides persistent file storage with hierarchical organization for:
- Campaign documents
- Character sheets (PDFs)
- Maps and images
- Game session logs
- Admin configurations

Hierarchy Structure:
/maestros/{maestro_id}/
    /campaigns/{campaign_id}/
        /players/{player_id}/
            /characters/{character_id}/
                - character_sheet.pdf
                - portrait.png
                - notes.md
        /sessions/
            - session_001.json
            - session_002.json
        /maps/
            - campaign_map.png
        /documents/
            - rules.pdf
            - handouts/
    /templates/
        - character_template.pdf
/shared/
    /rules/
    /maps/
    /assets/
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, List
import io
import json
import mimetypes

from auth import get_current_user

router = APIRouter()


def _is_admin(user: dict) -> bool:
    return user.get("role") == "maestro"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_gridfs_bucket(db, bucket_name: str = "lotr_files"):
    """Get or create a GridFS bucket"""
    return AsyncIOMotorGridFSBucket(db, bucket_name=bucket_name)


def build_file_path(
    maestro_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    player_id: Optional[str] = None,
    character_id: Optional[str] = None,
    folder: str = "documents",
    filename: str = ""
) -> str:
    """Build hierarchical file path"""
    parts = []
    
    if maestro_id:
        parts.append(f"maestros/{maestro_id}")
        
        if campaign_id:
            parts.append(f"campaigns/{campaign_id}")
            
            if player_id:
                parts.append(f"players/{player_id}")
                
                if character_id:
                    parts.append(f"characters/{character_id}")
    else:
        parts.append("shared")
    
    if folder:
        parts.append(folder)
    
    if filename:
        parts.append(filename)
    
    return "/".join(parts)


def parse_file_path(path: str) -> dict:
    """Parse a file path into its components"""
    result = {
        "maestro_id": None,
        "campaign_id": None,
        "player_id": None,
        "character_id": None,
        "folder": None,
        "filename": None,
        "is_shared": False
    }
    
    parts = path.strip("/").split("/")
    
    i = 0
    while i < len(parts):
        part = parts[i]
        
        if part == "maestros" and i + 1 < len(parts):
            result["maestro_id"] = parts[i + 1]
            i += 2
        elif part == "campaigns" and i + 1 < len(parts):
            result["campaign_id"] = parts[i + 1]
            i += 2
        elif part == "players" and i + 1 < len(parts):
            result["player_id"] = parts[i + 1]
            i += 2
        elif part == "characters" and i + 1 < len(parts):
            result["character_id"] = parts[i + 1]
            i += 2
        elif part == "shared":
            result["is_shared"] = True
            i += 1
        elif part in ["documents", "maps", "sessions", "templates", "assets", "rules", "handouts", "portraits"]:
            result["folder"] = part
            i += 1
        else:
            # This should be the filename
            result["filename"] = "/".join(parts[i:])
            break
    
    return result


# ============================================================================
# FILE UPLOAD ENDPOINTS
# ============================================================================

@router.post("/storage/upload")
async def upload_file(
    file: UploadFile = File(...),
    maestro_id: Optional[str] = Form(None),
    campaign_id: Optional[str] = Form(None),
    player_id: Optional[str] = Form(None),
    character_id: Optional[str] = Form(None),
    folder: str = Form("documents"),
    custom_filename: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON array as string
    user: dict = Depends(get_current_user),
):
    """Upload a file to GridFS with hierarchical organization"""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Build the file path
        filename = custom_filename or file.filename
        file_path = build_file_path(
            maestro_id=maestro_id,
            campaign_id=campaign_id,
            player_id=player_id,
            character_id=character_id,
            folder=folder,
            filename=filename
        )
        
        # Read file content
        content = await file.read()
        
        # Prepare metadata
        content_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        tags_list = json.loads(tags) if tags else []
        
        metadata = {
            "original_filename": file.filename,
            "content_type": content_type,
            "path": file_path,
            "owner_id": user.get("id"),
            "owner_email": user.get("email"),
            "maestro_id": maestro_id,
            "campaign_id": campaign_id,
            "player_id": player_id,
            "character_id": character_id,
            "folder": folder,
            "description": description,
            "tags": tags_list,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "size_bytes": len(content)
        }
        
        # Check if file already exists at this path
        existing = await db.lotr_files.files.find_one({"metadata.path": file_path})
        if existing:
            # Delete the old file
            await bucket.delete(existing["_id"])
        
        # Upload to GridFS
        file_id = await bucket.upload_from_stream(
            filename=file_path,
            source=io.BytesIO(content),
            metadata=metadata
        )
        
        return {
            "success": True,
            "file_id": str(file_id),
            "path": file_path,
            "size_bytes": len(content),
            "content_type": content_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/storage/upload-json")
async def upload_json_data(
    data: dict,
    maestro_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    player_id: Optional[str] = None,
    character_id: Optional[str] = None,
    folder: str = "documents",
    filename: str = "data.json",
    description: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Upload JSON data as a file to GridFS"""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Build the file path
        file_path = build_file_path(
            maestro_id=maestro_id,
            campaign_id=campaign_id,
            player_id=player_id,
            character_id=character_id,
            folder=folder,
            filename=filename
        )
        
        # Convert to JSON bytes
        content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
        
        metadata = {
            "original_filename": filename,
            "content_type": "application/json",
            "path": file_path,
            "owner_id": user.get("id"),
            "owner_email": user.get("email"),
            "maestro_id": maestro_id,
            "campaign_id": campaign_id,
            "player_id": player_id,
            "character_id": character_id,
            "folder": folder,
            "description": description,
            "tags": ["json", "data"],
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "size_bytes": len(content)
        }
        
        # Check if file already exists at this path
        existing = await db.lotr_files.files.find_one({"metadata.path": file_path})
        if existing:
            await bucket.delete(existing["_id"])
        
        file_id = await bucket.upload_from_stream(
            filename=file_path,
            source=io.BytesIO(content),
            metadata=metadata
        )
        
        return {
            "success": True,
            "file_id": str(file_id),
            "path": file_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FILE RETRIEVAL ENDPOINTS
# ============================================================================

@router.get("/storage/download/{file_id}")
async def download_file(file_id: str, user: dict = Depends(get_current_user)):
    """Download a file by its ID (only owner or Maestro)."""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Get file info
        file_doc = await db.lotr_files.files.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        owner = file_doc.get("metadata", {}).get("owner_id")
        if not _is_admin(user) and owner != user.get("id"):
            raise HTTPException(status_code=403, detail="No tienes permiso para descargar este archivo")
        
        # Stream the file
        stream = await bucket.open_download_stream(ObjectId(file_id))
        content = await stream.read()
        
        content_type = file_doc.get("metadata", {}).get("content_type", "application/octet-stream")
        filename = file_doc.get("metadata", {}).get("original_filename", "download")
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/file")
async def get_file_by_path(path: str, user: dict = Depends(get_current_user)):
    """Get a file by its hierarchical path (only owner or Maestro)."""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Find file by path
        file_doc = await db.lotr_files.files.find_one({"metadata.path": path})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        owner = file_doc.get("metadata", {}).get("owner_id")
        if not _is_admin(user) and owner != user.get("id"):
            raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este archivo")
        
        # Stream the file
        stream = await bucket.open_download_stream(file_doc["_id"])
        content = await stream.read()
        
        content_type = file_doc.get("metadata", {}).get("content_type", "application/octet-stream")
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/json")
async def get_json_by_path(path: str, user: dict = Depends(get_current_user)):
    """Get JSON data from a file by its path (only owner or Maestro)."""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        file_doc = await db.lotr_files.files.find_one({"metadata.path": path})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        owner = file_doc.get("metadata", {}).get("owner_id")
        if not _is_admin(user) and owner != user.get("id"):
            raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este archivo")
        
        stream = await bucket.open_download_stream(file_doc["_id"])
        content = await stream.read()
        
        return json.loads(content.decode('utf-8'))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FILE LISTING ENDPOINTS
# ============================================================================

@router.get("/storage/list")
async def list_files(
    maestro_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    player_id: Optional[str] = None,
    character_id: Optional[str] = None,
    folder: Optional[str] = None,
    include_subfolders: bool = True,
    user: dict = Depends(get_current_user),
):
    """List files in a hierarchical location (filtered by owner unless Maestro)."""
    from server import db
    
    try:
        # Build query
        query = {}
        
        if maestro_id:
            query["metadata.maestro_id"] = maestro_id
        if campaign_id:
            query["metadata.campaign_id"] = campaign_id
        if player_id:
            query["metadata.player_id"] = player_id
        if character_id:
            query["metadata.character_id"] = character_id
        if folder and not include_subfolders:
            query["metadata.folder"] = folder
        
        # Filtro de propietario: cualquier usuario que NO sea Maestro sólo
        # ve los ficheros que él mismo subió.
        if not _is_admin(user):
            query["metadata.owner_id"] = user.get("id")
        
        cursor = db.lotr_files.files.find(query)
        files = []
        
        async for doc in cursor:
            files.append({
                "file_id": str(doc["_id"]),
                "filename": doc.get("filename", ""),
                "path": doc.get("metadata", {}).get("path", ""),
                "original_filename": doc.get("metadata", {}).get("original_filename", ""),
                "content_type": doc.get("metadata", {}).get("content_type", ""),
                "size_bytes": doc.get("metadata", {}).get("size_bytes", 0),
                "uploaded_at": doc.get("metadata", {}).get("uploaded_at", ""),
                "description": doc.get("metadata", {}).get("description", ""),
                "tags": doc.get("metadata", {}).get("tags", [])
            })
        
        return {
            "files": files,
            "count": len(files)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/tree")
async def get_file_tree(
    maestro_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Get a tree structure of all files (filtered by owner unless Maestro)."""
    from server import db
    
    try:
        query = {}
        if maestro_id:
            query["metadata.maestro_id"] = maestro_id
        # Filtro de propietario.
        if not _is_admin(user):
            query["metadata.owner_id"] = user.get("id")
        
        cursor = db.lotr_files.files.find(query)
        
        tree = {}
        
        async for doc in cursor:
            path = doc.get("metadata", {}).get("path", "")
            parts = path.strip("/").split("/")
            
            current = tree
            for i, part in enumerate(parts[:-1]):
                if part not in current:
                    current[part] = {"_files": [], "_folders": {}}
                current = current[part]["_folders"] if i < len(parts) - 2 else current[part]
            
            # Add file to current folder
            if parts:
                filename = parts[-1]
                if "_files" not in current:
                    current["_files"] = []
                current["_files"].append({
                    "name": filename,
                    "file_id": str(doc["_id"]),
                    "size_bytes": doc.get("metadata", {}).get("size_bytes", 0),
                    "content_type": doc.get("metadata", {}).get("content_type", "")
                })
        
        return tree
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FILE MANAGEMENT ENDPOINTS
# ============================================================================

@router.delete("/storage/file/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(get_current_user)):
    """Delete a file by ID (only owner or Maestro)."""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Verify file exists
        file_doc = await db.lotr_files.files.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Check ownership
        owner = file_doc.get("metadata", {}).get("owner_id")
        if not _is_admin(user) and owner != user.get("id"):
            raise HTTPException(status_code=403, detail="No tienes permiso para borrar este archivo")
        
        await bucket.delete(ObjectId(file_id))
        
        return {"success": True, "deleted": file_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/storage/folder")
async def delete_folder(
    maestro_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    player_id: Optional[str] = None,
    character_id: Optional[str] = None,
    folder: Optional[str] = None
):
    """Delete all files in a folder/hierarchy"""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Build query
        query = {}
        if maestro_id:
            query["metadata.maestro_id"] = maestro_id
        if campaign_id:
            query["metadata.campaign_id"] = campaign_id
        if player_id:
            query["metadata.player_id"] = player_id
        if character_id:
            query["metadata.character_id"] = character_id
        if folder:
            query["metadata.folder"] = folder
        
        if not query:
            raise HTTPException(status_code=400, detail="Must specify at least one filter")
        
        # Find and delete all matching files
        cursor = db.lotr_files.files.find(query)
        deleted_count = 0
        
        async for doc in cursor:
            await bucket.delete(doc["_id"])
            deleted_count += 1
        
        return {"success": True, "deleted_count": deleted_count}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/storage/move")
async def move_file(file_id: str, new_path: str):
    """Move/rename a file"""
    from server import db
    
    try:
        # Update metadata with new path
        path_info = parse_file_path(new_path)
        
        result = await db.lotr_files.files.update_one(
            {"_id": ObjectId(file_id)},
            {"$set": {
                "filename": new_path,
                "metadata.path": new_path,
                "metadata.maestro_id": path_info["maestro_id"],
                "metadata.campaign_id": path_info["campaign_id"],
                "metadata.player_id": path_info["player_id"],
                "metadata.character_id": path_info["character_id"],
                "metadata.folder": path_info["folder"]
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {"success": True, "new_path": new_path}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CHARACTER SHEET SPECIFIC ENDPOINTS
# ============================================================================

@router.post("/storage/character-sheet")
async def save_character_sheet(
    character_id: str,
    player_id: str,
    campaign_id: str,
    maestro_id: str,
    sheet_data: dict
):
    """Save a character sheet with all its data"""
    from server import db
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Build path for character data
        data_path = build_file_path(
            maestro_id=maestro_id,
            campaign_id=campaign_id,
            player_id=player_id,
            character_id=character_id,
            folder="data",
            filename="character_data.json"
        )
        
        # Add metadata
        sheet_data["_saved_at"] = datetime.now(timezone.utc).isoformat()
        sheet_data["_version"] = sheet_data.get("_version", 0) + 1
        
        content = json.dumps(sheet_data, ensure_ascii=False, indent=2).encode('utf-8')
        
        metadata = {
            "original_filename": "character_data.json",
            "content_type": "application/json",
            "path": data_path,
            "maestro_id": maestro_id,
            "campaign_id": campaign_id,
            "player_id": player_id,
            "character_id": character_id,
            "folder": "data",
            "character_name": sheet_data.get("nombre", "Unknown"),
            "character_culture": sheet_data.get("cultura", "Unknown"),
            "character_occupation": sheet_data.get("ocupacion", "Unknown"),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "size_bytes": len(content)
        }
        
        # Delete existing
        existing = await db.lotr_files.files.find_one({"metadata.path": data_path})
        if existing:
            await bucket.delete(existing["_id"])
        
        file_id = await bucket.upload_from_stream(
            filename=data_path,
            source=io.BytesIO(content),
            metadata=metadata
        )
        
        return {
            "success": True,
            "file_id": str(file_id),
            "path": data_path,
            "version": sheet_data["_version"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/character-sheet/{character_id}")
async def get_character_sheet(
    character_id: str,
    player_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    maestro_id: Optional[str] = None
):
    """Retrieve a character sheet"""
    from server import db
    
    try:
        query = {"metadata.character_id": character_id}
        if player_id:
            query["metadata.player_id"] = player_id
        if campaign_id:
            query["metadata.campaign_id"] = campaign_id
        if maestro_id:
            query["metadata.maestro_id"] = maestro_id
        
        query["metadata.folder"] = "data"
        query["filename"] = {"$regex": "character_data.json$"}
        
        file_doc = await db.lotr_files.files.find_one(query)
        if not file_doc:
            raise HTTPException(status_code=404, detail="Character sheet not found")
        
        bucket = get_gridfs_bucket(db)
        stream = await bucket.open_download_stream(file_doc["_id"])
        content = await stream.read()
        
        return json.loads(content.decode('utf-8'))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CAMPAIGN MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/storage/campaigns")
async def create_campaign(
    maestro_id: str,
    campaign_name: str,
    description: Optional[str] = None
):
    """Create a new campaign folder structure"""
    from server import db
    import uuid
    
    try:
        campaign_id = f"camp_{uuid.uuid4().hex[:8]}"
        
        # Create campaign metadata file
        campaign_data = {
            "campaign_id": campaign_id,
            "maestro_id": maestro_id,
            "name": campaign_name,
            "description": description,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "players": [],
            "status": "active"
        }
        
        # Save campaign info
        await upload_json_data(
            data=campaign_data,
            maestro_id=maestro_id,
            campaign_id=campaign_id,
            folder="meta",
            filename="campaign_info.json",
            description=f"Campaign metadata for {campaign_name}"
        )
        
        return {
            "success": True,
            "campaign_id": campaign_id,
            "campaign": campaign_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/campaigns/{maestro_id}")
async def list_campaigns(maestro_id: str):
    """List all campaigns for a maestro"""
    from server import db
    
    try:
        query = {
            "metadata.maestro_id": maestro_id,
            "metadata.folder": "meta",
            "filename": {"$regex": "campaign_info.json$"}
        }
        
        cursor = db.lotr_files.files.find(query)
        campaigns = []
        
        bucket = get_gridfs_bucket(db)
        
        async for doc in cursor:
            stream = await bucket.open_download_stream(doc["_id"])
            content = await stream.read()
            campaign_data = json.loads(content.decode('utf-8'))
            campaigns.append(campaign_data)
        
        return {
            "campaigns": campaigns,
            "count": len(campaigns)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BACKUP/EXPORT ENDPOINTS
# ============================================================================

@router.get("/storage/backup/{maestro_id}")
async def backup_maestro_data(maestro_id: str):
    """Create a full backup of all maestro data"""
    from server import db
    import zipfile
    
    try:
        bucket = get_gridfs_bucket(db)
        
        # Create in-memory ZIP
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            query = {"metadata.maestro_id": maestro_id}
            cursor = db.lotr_files.files.find(query)
            
            async for doc in cursor:
                path = doc.get("metadata", {}).get("path", "unknown")
                stream = await bucket.open_download_stream(doc["_id"])
                content = await stream.read()
                
                # Add to ZIP with relative path
                relative_path = path.replace(f"maestros/{maestro_id}/", "")
                zip_file.writestr(relative_path, content)
        
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="backup_{maestro_id}_{datetime.now().strftime("%Y%m%d")}.zip"'
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/storage/stats")
async def get_storage_stats(maestro_id: Optional[str] = None):
    """Get storage statistics"""
    from server import db
    
    try:
        query = {}
        if maestro_id:
            query["metadata.maestro_id"] = maestro_id
        
        pipeline = [
            {"$match": query} if query else {"$match": {}},
            {"$group": {
                "_id": "$metadata.maestro_id",
                "total_files": {"$sum": 1},
                "total_bytes": {"$sum": "$metadata.size_bytes"},
                "campaigns": {"$addToSet": "$metadata.campaign_id"},
                "characters": {"$addToSet": "$metadata.character_id"}
            }}
        ]
        
        cursor = db.lotr_files.files.aggregate(pipeline)
        stats = []
        
        async for doc in cursor:
            stats.append({
                "maestro_id": doc["_id"],
                "total_files": doc["total_files"],
                "total_bytes": doc["total_bytes"],
                "total_mb": round(doc["total_bytes"] / (1024 * 1024), 2),
                "campaign_count": len([c for c in doc["campaigns"] if c]),
                "character_count": len([c for c in doc["characters"] if c])
            })
        
        return {"stats": stats}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
