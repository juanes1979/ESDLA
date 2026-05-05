from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone

# Import routes
from routes.data_routes import router as data_router
from routes.character import router as character_router
from routes.trading_routes import router as trading_router
from routes.storage_routes import router as storage_router
from routes.travel_routes import router as travel_router
from routes.name_generator import router as name_router
from routes.portrait_routes import router as portrait_router
from routes.climate_routes import router as climate_router
from routes.weather_routes import router as weather_router
from routes.admin_routes import router as admin_router
from routes.moderation_routes import router as moderation_router
from routes.eye_routes import router as eye_router
from routes.eye_ai_routes import router as eye_ai_router
from routes.region_hierarchy_routes import router as region_hierarchy_router


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(
    title="LOTR 5e RPG API",
    description="API for the Lord of the Rings 5e tabletop RPG application",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Base routes
@api_router.get("/")
async def root():
    return {"message": "LOTR 5e RPG API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check MongoDB connection
        await db.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include sub-routers
api_router.include_router(data_router)
api_router.include_router(character_router)
api_router.include_router(trading_router)
api_router.include_router(storage_router)
api_router.include_router(travel_router)
api_router.include_router(name_router)
api_router.include_router(portrait_router)
api_router.include_router(climate_router)
api_router.include_router(weather_router)
api_router.include_router(admin_router)
api_router.include_router(moderation_router)
api_router.include_router(eye_router)
api_router.include_router(eye_ai_router)
api_router.include_router(region_hierarchy_router)

# Include the main router in the app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()