"""
OhmGuard Mobile API Backend
Simplified backend for the mobile alert client application.
"""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import asyncio
import socketio
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise ValueError("MONGO_URL environment variable is required")

db_name = os.environ.get('DB_NAME', 'ohmguard')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'ohmguard-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI(title="OhmGuard Mobile API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=[],
    logger=False,
    engineio_logger=False,
)
socket_app = socketio.ASGIApp(sio, socketio_path='')

# ==================== MODELS ====================

RoleType = Literal["SUPER_ADMIN", "TENANT_ADMIN", "SUPERVISOR", "OPERATOR", "VIEWER"]
EventType = Literal["FALL", "PRE_FALL", "PRESENCE", "INACTIVITY", "UNKNOWN"]
SeverityType = Literal["LOW", "MED", "HIGH"]
EventStatus = Literal["NEW", "ACK", "RESOLVED", "FALSE_ALARM"]

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    role: RoleType = "VIEWER"
    tenant_id: Optional[str] = None
    language: str = "fr"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sensor_id: Optional[str] = None
    device_id: Optional[str] = None
    type: EventType
    confidence: float = Field(ge=0, le=1, default=1.0)
    severity: SeverityType = "LOW"
    status: EventStatus = "NEW"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    tenant_id: Optional[str] = None
    site_id: Optional[str] = None
    zone_id: Optional[str] = None
    presence_status: Optional[str] = None
    presence_detected: Optional[bool] = None
    active_regions: Optional[List[int]] = None
    target_count: Optional[int] = None
    occurred_at: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    location_path: Optional[str] = None
    location: Optional[dict] = None
    radar_name: Optional[str] = None
    serial_product: Optional[str] = None

class EventUpdate(BaseModel):
    status: Optional[EventStatus] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class PushToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    token: str
    device_type: Optional[str] = None  # 'ios' or 'android'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PushTokenRequest(BaseModel):
    token: str
    device_type: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise credentials_exception
    return UserInDB(**user)

def check_permission(user: UserInDB, required_roles: List[RoleType]):
    if user.role not in required_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/login", response_model=Token)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=400, detail="Utilisateur inactif")
    
    access_token = create_access_token(
        data={"sub": user['id'], "tenant_id": user.get('tenant_id'), "role": user['role']}
    )
    refresh_token = create_refresh_token(
        data={"sub": user['id'], "tenant_id": user.get('tenant_id'), "role": user['role']}
    )
    
    return Token(access_token=access_token, refresh_token=refresh_token)

@api_router.post("/auth/refresh", response_model=Token)
async def refresh_token(refresh_token: str = Query(...)):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        access_token = create_access_token(
            data={"sub": user['id'], "tenant_id": user.get('tenant_id'), "role": user['role']}
        )
        new_refresh_token = create_refresh_token(
            data={"sub": user['id'], "tenant_id": user.get('tenant_id'), "role": user['role']}
        )
        return Token(access_token=access_token, refresh_token=new_refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: UserInDB = Depends(get_current_user)):
    return User(**current_user.model_dump())

# ==================== PUSH NOTIFICATION ENDPOINTS ====================

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_expo_push_notification(tokens: List[str], title: str, body: str, data: dict = None):
    """Send push notification via Expo Push API"""
    if not tokens:
        logger.info("[Push] No tokens to send notification to")
        return
    
    messages = []
    for token in tokens:
        if not token.startswith('ExponentPushToken'):
            continue
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "priority": "high",
            "channelId": "alerts",
        }
        if data:
            message["data"] = data
        messages.append(message)
    
    if not messages:
        logger.info("[Push] No valid Expo tokens found")
        return
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                }
            )
            result = response.json()
            logger.info(f"[Push] Notification sent: {result}")
            return result
    except Exception as e:
        logger.error(f"[Push] Error sending notification: {e}")
        return None

@api_router.post("/push-tokens", status_code=status.HTTP_201_CREATED)
async def register_push_token(
    token_data: PushTokenRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Register or update a push notification token for the current user"""
    
    # Check if token already exists for this user
    existing = await db.push_tokens.find_one({
        "user_id": current_user.id,
        "token": token_data.token
    })
    
    if existing:
        # Update existing token
        await db.push_tokens.update_one(
            {"_id": existing["_id"]},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(f"[Push] Token updated for user {current_user.id}")
        return {"message": "Token updated", "token_id": existing.get("id")}
    
    # Create new token entry
    push_token = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "tenant_id": current_user.tenant_id,
        "token": token_data.token,
        "device_type": token_data.device_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.push_tokens.insert_one(push_token)
    logger.info(f"[Push] New token registered for user {current_user.id}: {token_data.token[:20]}...")
    
    return {"message": "Token registered", "token_id": push_token["id"]}

@api_router.delete("/push-tokens")
async def delete_push_token(
    token: str = Query(...),
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a push notification token"""
    result = await db.push_tokens.delete_one({
        "user_id": current_user.id,
        "token": token
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    
    logger.info(f"[Push] Token deleted for user {current_user.id}")
    return {"message": "Token deleted"}

async def send_notification_to_tenant(tenant_id: str, title: str, body: str, data: dict = None):
    """Send notification to all users of a tenant"""
    # Get all push tokens for this tenant
    tokens_cursor = db.push_tokens.find({"tenant_id": tenant_id}, {"token": 1, "_id": 0})
    tokens = await tokens_cursor.to_list(length=100)
    token_list = [t["token"] for t in tokens if t.get("token")]
    
    if token_list:
        await send_expo_push_notification(token_list, title, body, data)
        logger.info(f"[Push] Sent notification to {len(token_list)} devices for tenant {tenant_id}")
    else:
        logger.info(f"[Push] No registered devices for tenant {tenant_id}")

# ==================== EVENT ENDPOINTS ====================

@api_router.get("/events", response_model=List[Event])
async def list_events(
    status: Optional[EventStatus] = None,
    event_type: Optional[EventType] = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
    current_user: UserInDB = Depends(get_current_user)
):
    query = {}
    
    # Filter by tenant for non-super-admin users
    if current_user.role != "SUPER_ADMIN" and current_user.tenant_id:
        query["tenant_id"] = current_user.tenant_id
    
    if status:
        query["status"] = status
    if event_type:
        query["type"] = event_type
    
    events = await db.events.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich events with location data
    for event in events:
        sensor_id = event.get("sensor_id")
        if sensor_id:
            sensor = await db.sensors.find_one({"id": sensor_id}, {"_id": 0})
            if sensor:
                event["radar_name"] = sensor.get("name")
                event["serial_product"] = sensor.get("serial_product")
                
                # Build location path
                location_parts = []
                location = {}
                
                if sensor.get("client_id"):
                    client = await db.clients.find_one({"id": sensor["client_id"]}, {"_id": 0})
                    if client:
                        location_parts.append(client.get("name", ""))
                        location["client_name"] = client.get("name")
                
                if sensor.get("building_id"):
                    building = await db.buildings.find_one({"id": sensor["building_id"]}, {"_id": 0})
                    if building:
                        location_parts.append(building.get("name", ""))
                        location["building_name"] = building.get("name")
                
                if sensor.get("floor_id"):
                    floor = await db.floors.find_one({"id": sensor["floor_id"]}, {"_id": 0})
                    if floor:
                        location_parts.append(floor.get("name", ""))
                        location["floor_name"] = floor.get("name")
                
                if sensor.get("room_id"):
                    room = await db.rooms.find_one({"id": sensor["room_id"]}, {"_id": 0})
                    if room:
                        room_num = room.get("room_number") or room.get("name", "")
                        location_parts.append(f"Ch. {room_num}")
                        location["room_number"] = room_num
                
                event["location_path"] = " > ".join(location_parts) if location_parts else None
                event["location"] = location if location else None
    
    return events

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str, current_user: UserInDB = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    if current_user.role != "SUPER_ADMIN" and current_user.tenant_id != event.get('tenant_id'):
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    # Enrich with location data
    sensor_id = event.get("sensor_id")
    if sensor_id:
        sensor = await db.sensors.find_one({"id": sensor_id}, {"_id": 0})
        if sensor:
            event["radar_name"] = sensor.get("name")
            event["serial_product"] = sensor.get("serial_product")
            
            # Build location path
            location_parts = []
            location = {}
            
            if sensor.get("client_id"):
                client = await db.clients.find_one({"id": sensor["client_id"]}, {"_id": 0})
                if client:
                    location_parts.append(client.get("name", ""))
                    location["client_name"] = client.get("name")
            
            if sensor.get("building_id"):
                building = await db.buildings.find_one({"id": sensor["building_id"]}, {"_id": 0})
                if building:
                    location_parts.append(building.get("name", ""))
                    location["building_name"] = building.get("name")
            
            if sensor.get("floor_id"):
                floor = await db.floors.find_one({"id": sensor["floor_id"]}, {"_id": 0})
                if floor:
                    location_parts.append(floor.get("name", ""))
                    location["floor_name"] = floor.get("name")
            
            if sensor.get("room_id"):
                room = await db.rooms.find_one({"id": sensor["room_id"]}, {"_id": 0})
                if room:
                    room_num = room.get("room_number") or room.get("name", "")
                    location_parts.append(f"Ch. {room_num}")
                    location["room_number"] = room_num
            
            event["location_path"] = " > ".join(location_parts) if location_parts else None
            event["location"] = location if location else None
    
    return event

@api_router.patch("/events/{event_id}", response_model=Event)
async def update_event(event_id: str, update: EventUpdate, current_user: UserInDB = Depends(get_current_user)):
    # Check permission for acknowledge
    check_permission(current_user, ["SUPER_ADMIN", "TENANT_ADMIN", "SUPERVISOR", "OPERATOR"])
    
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    if current_user.role != "SUPER_ADMIN" and current_user.tenant_id != event.get('tenant_id'):
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
        
        # Broadcast update via Socket.IO
        if event.get('tenant_id'):
            await broadcast_event_update(event['tenant_id'], event_id, update_data)
    
    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    return updated

# ==================== SOCKET.IO EVENTS ====================

connected_clients = {}

@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Client connected: {sid}")
    return True

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    for tenant_id, clients in connected_clients.items():
        if sid in clients:
            clients.discard(sid)
            await sio.leave_room(sid, f"tenant_{tenant_id}")

@sio.event
async def join_tenant(sid, data):
    tenant_id = data.get('tenant_id')
    if not tenant_id:
        return {"success": False, "error": "tenant_id required"}
    
    room = f"tenant_{tenant_id}"
    await sio.enter_room(sid, room)
    
    if tenant_id not in connected_clients:
        connected_clients[tenant_id] = set()
    connected_clients[tenant_id].add(sid)
    
    logger.info(f"Client {sid} joined room {room}")
    await sio.emit('joined', {'tenant_id': tenant_id, 'room': room}, room=sid)
    return {"success": True, "room": room}

@sio.event
async def leave_tenant(sid, data):
    tenant_id = data.get('tenant_id')
    if tenant_id:
        room = f"tenant_{tenant_id}"
        await sio.leave_room(sid, room)
        if tenant_id in connected_clients:
            connected_clients[tenant_id].discard(sid)
    return {"success": True}

async def broadcast_new_event(tenant_id: str, event: dict):
    room = f"tenant_{tenant_id}"
    await sio.emit('new_event', {'type': 'new_event', 'event': event}, room=room)

async def broadcast_event_update(tenant_id: str, event_id: str, update: dict):
    room = f"tenant_{tenant_id}"
    await sio.emit('event_updated', {'type': 'event_updated', 'event_id': event_id, 'update': update}, room=room)

# ==================== WEBSOCKET ENDPOINT ====================

@app.websocket("/ws/{tenant_id}")
async def websocket_endpoint(websocket: WebSocket, tenant_id: str, token: Optional[str] = None):
    if token:
        try:
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            await websocket.close(code=4001)
            return
    
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== CREATE FALL EVENT WITH NOTIFICATION ====================

@api_router.post("/create-fall-event")
async def create_fall_event(current_user: UserInDB = Depends(get_current_user)):
    """Create a new fall event and send push notification"""
    
    # Get tenant's sensor
    sensor = await db.sensors.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0})
    if not sensor:
        raise HTTPException(status_code=404, detail="No sensor found for tenant")
    
    # Create the event
    event_id = str(uuid.uuid4())
    event = {
        "id": event_id,
        "sensor_id": sensor["id"],
        "type": "FALL",
        "severity": "HIGH",
        "status": "NEW",
        "tenant_id": current_user.tenant_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "confidence": 0.95
    }
    
    await db.events.insert_one(event)
    
    # Remove MongoDB _id for JSON serialization
    event.pop('_id', None)
    
    # Get location info for notification
    location_parts = []
    if sensor.get("client_id"):
        client_doc = await db.clients.find_one({"id": sensor["client_id"]}, {"_id": 0})
        if client_doc:
            location_parts.append(client_doc.get("name", ""))
    if sensor.get("room_id"):
        room = await db.rooms.find_one({"id": sensor["room_id"]}, {"_id": 0})
        if room:
            location_parts.append(f"Ch. {room.get('room_number', room.get('name', ''))}")
    
    location_str = " > ".join(location_parts) if location_parts else "Localisation inconnue"
    
    # Broadcast via Socket.IO
    await broadcast_new_event(current_user.tenant_id, event)
    
    # Send push notification
    await send_notification_to_tenant(
        current_user.tenant_id,
        "🚨 ALERTE CHUTE DÉTECTÉE",
        f"Chute détectée - {location_str}",
        {
            "type": "new_event",
            "eventId": event_id,
            "eventType": "FALL",
            "location": location_str,
            "severity": "HIGH"
        }
    )
    
    logger.info(f"[Event] Fall event created: {event_id}")
    
    return {
        "message": "Fall event created and notification sent",
        "event_id": event_id
    }

@api_router.post("/test-notification")
async def test_notification(current_user: UserInDB = Depends(get_current_user)):
    """Send a test notification to the current user's devices"""
    
    # Get user's push tokens
    tokens_cursor = db.push_tokens.find({"user_id": current_user.id}, {"token": 1, "_id": 0})
    tokens = await tokens_cursor.to_list(length=10)
    token_list = [t["token"] for t in tokens if t.get("token")]
    
    if not token_list:
        raise HTTPException(status_code=404, detail="No push tokens registered for this user")
    
    # Send test notification
    result = await send_expo_push_notification(
        token_list,
        "🔔 Test de Notification",
        "Les notifications push fonctionnent correctement !",
        {
            "type": "test",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )
    
    return {
        "message": "Test notification sent",
        "tokens_count": len(token_list),
        "result": result
    }

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Create demo data for testing"""
    
    # Check if already seeded
    existing_user = await db.users.find_one({"email": "demo@ohmguard.com"})
    if existing_user:
        return {"message": "Data already seeded"}
    
    # Create demo tenant
    tenant_id = str(uuid.uuid4())
    
    # Create demo user
    user = {
        "id": str(uuid.uuid4()),
        "email": "demo@ohmguard.com",
        "full_name": "Demo User",
        "hashed_password": get_password_hash("demo123"),
        "role": "OPERATOR",
        "tenant_id": tenant_id,
        "language": "fr",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Create demo client
    client_doc = {
        "id": tenant_id,
        "name": "EHPAD Les Oliviers",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.clients.insert_one(client_doc)
    
    # Create demo building
    building_id = str(uuid.uuid4())
    building = {
        "id": building_id,
        "client_id": tenant_id,
        "name": "Bâtiment A",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.buildings.insert_one(building)
    
    # Create demo floor
    floor_id = str(uuid.uuid4())
    floor = {
        "id": floor_id,
        "building_id": building_id,
        "name": "1er Étage",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.floors.insert_one(floor)
    
    # Create demo room
    room_id = str(uuid.uuid4())
    room = {
        "id": room_id,
        "floor_id": floor_id,
        "room_number": "101",
        "name": "Chambre 101",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rooms.insert_one(room)
    
    # Create demo sensor
    sensor_id = str(uuid.uuid4())
    sensor = {
        "id": sensor_id,
        "name": "Radar Chambre 101",
        "type": "RADAR",
        "tenant_id": tenant_id,
        "client_id": tenant_id,
        "building_id": building_id,
        "floor_id": floor_id,
        "room_id": room_id,
        "serial_product": "VY-2024-001",
        "status": "ONLINE",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sensors.insert_one(sensor)
    
    # Create demo events
    events = [
        {
            "id": str(uuid.uuid4()),
            "sensor_id": sensor_id,
            "type": "FALL",
            "severity": "HIGH",
            "status": "NEW",
            "tenant_id": tenant_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "confidence": 0.95
        },
        {
            "id": str(uuid.uuid4()),
            "sensor_id": sensor_id,
            "type": "FALL",
            "severity": "HIGH",
            "status": "ACK",
            "tenant_id": tenant_id,
            "timestamp": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "occurred_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "confidence": 0.92
        },
        {
            "id": str(uuid.uuid4()),
            "sensor_id": sensor_id,
            "type": "PRE_FALL",
            "severity": "MED",
            "status": "NEW",
            "tenant_id": tenant_id,
            "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat(),
            "occurred_at": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat(),
            "confidence": 0.88
        }
    ]
    
    for event in events:
        await db.events.insert_one(event)
    
    return {
        "message": "Demo data created",
        "credentials": {
            "email": "demo@ohmguard.com",
            "password": "demo123"
        }
    }

# Include the router in the main app
app.include_router(api_router)

# Mount Socket.IO
app.mount("/api/socket.io", socket_app)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
