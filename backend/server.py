from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
from jose import JWTError, jwt
import secrets


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# AnythingLLM configuration
ANYTHINGLLM_API_URL = "https://pilj1jbx.rcsrv.com/api/v1/workspace/bilgin/chat"
ANYTHINGLLM_API_KEY = "FC6CT8Q-QRE433A-J9K8SV8-S7E2M4N"

# JWT Configuration
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Security
security = HTTPBearer(auto_error=False)

# Admin credentials
ADMIN_USERNAME = "kaantas77"
ADMIN_PASSWORD_HASH = bcrypt.hashpw("64Ekremimaro2004MKüge.".encode('utf-8'), bcrypt.gensalt())

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    password_hash: str
    name: Optional[str] = None  # User's display name
    is_verified: bool = False
    is_admin: bool = False
    onboarding_completed: bool = False  # Track if user completed onboarding
    oauth_provider: Optional[str] = None
    oauth_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class OnboardingData(BaseModel):
    name: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    name: Optional[str]
    is_verified: bool
    is_admin: bool
    onboarding_completed: bool
    created_at: datetime
    last_login: Optional[datetime]

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversationCreate(BaseModel):
    title: str

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    content: str
    mode: str = "chat"  # "chat" or "query"

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    timestamp: datetime

class AdminStats(BaseModel):
    total_users: int
    verified_users: int
    total_conversations: int
    total_messages: int
    recent_users: List[UserResponse]

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        for key, value in item.items():
            if key in ['created_at', 'updated_at', 'timestamp', 'last_login', 'expires_at'] and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    pass
    return item

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expire

async def get_current_user(request: Request, session_token: Optional[str] = Cookie(None)) -> Optional[dict]:
    """Get current user from session token (cookie or header)"""
    token = session_token
    
    # Fallback to Authorization header if no cookie
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        return None
    
    try:
        # Check if token exists in database and is not expired
        session = await db.sessions.find_one({
            "session_token": token,
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        })
        
        if not session:
            return None
        
        # Get user
        user = await db.users.find_one({"id": session["user_id"]})
        if user:
            return parse_from_mongo(user)
        
    except Exception as e:
        logging.error(f"Error getting current user: {e}")
        return None
    
    return None

async def require_auth(request: Request, session_token: Optional[str] = Cookie(None)) -> dict:
    """Require authentication"""
    user = await get_current_user(request, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request, session_token: Optional[str] = Cookie(None)) -> dict:
    """Require admin privileges"""
    user = await require_auth(request, session_token)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

def generate_conversation_title(message_content: str) -> str:
    """Generate a professional conversation title based on the first message content"""
    message = message_content.lower().strip()
    
    # Simple conversational messages should be labeled as "Sohbet Mesajı"
    casual_greetings = ["merhaba", "selam", "naber", "nasılsın", "hey", "hi", "hello", "iyi misin", "sa", "selamlar"]
    if any(greeting in message for greeting in casual_greetings) and len(message.split()) <= 3:
        return "Sohbet Mesajı"
    
    # Professional patterns for title generation
    title_patterns = {
        # Questions and Information Requests
        "nasıl": "Nasıl Yapılır Rehberi",
        "nedir": "Kavram Açıklaması",
        "ne demek": "Terim Tanımı",
        "açıkla": "Detaylı Açıklama",
        "anlat": "Bilgi Talebi",
        "öğrenmek istiyorum": "Öğrenme Planı",
        "öğretir misin": "Eğitim Talebi",
        "yardım": "Destek Talebi",
        "destek": "Teknik Destek",
        
        # Design and Creative Work
        "logo": "Logo Tasarımı",
        "tasarla": "Tasarım Projesi", 
        "çiz": "Görsel Tasarım",
        "resim": "Görsel İçerik",
        "design": "Kreatif Tasarım",
        "grafik": "Grafik Tasarımı",
        
        # Programming and Technology
        "kod": "Kod Geliştirme",
        "program": "Yazılım Geliştirme",
        "python": "Python Programlama",
        "javascript": "JavaScript Geliştirme",
        "web sitesi": "Web Projesi",
        "uygulama": "Mobil Uygulama",
        "yazılım": "Yazılım Projesi",
        "database": "Veritabanı Yönetimi",
        "api": "API Entegrasyonu",
        
        # Content Creation
        "yaz": "İçerik Yazımı",
        "makale": "Makale Hazırlama",
        "mektup": "Resmi Yazışma",
        "içerik": "İçerik Stratejisi",
        "metin": "Metin Düzenleme",
        "çevir": "Çeviri Hizmeti",
        
        # Analysis and Research
        "analiz": "Veri Analizi",
        "karşılaştır": "Karşılaştırmalı Analiz",
        "araştır": "Araştırma Projesi",
        "incele": "Detaylı İnceleme",
        "değerlendir": "Performans Değerlendirmesi",
        
        # Problem Solving
        "çöz": "Problem Çözümü",
        "hata": "Hata Giderme", 
        "sorun": "Teknik Sorun",
        "düzelt": "Sistem Onarımı",
        "optimize": "Performans Optimizasyonu",
        
        # Learning and Education
        "öğren": "Eğitim Planı",
        "ders": "Ders Materyali",
        "kurs": "Kurs Bilgileri",
        "kitap": "Kaynak Önerileri",
        "sınav": "Sınav Hazırlığı",
        
        # Business and Strategy
        "plan": "Strateji Planı",
        "iş": "İş Geliştirme",
        "proje": "Proje Yönetimi",
        "pazarlama": "Pazarlama Stratejisi",
        "satış": "Satış Stratejisi",
        "budget": "Bütçe Planlaması",
        
        # General Services
        "öneri": "Öneri Listesi",
        "tavsiye": "Uzman Tavsiyesi",
        "fikir": "Fikir Geliştirme",
        "görüş": "Uzman Görüşü",
        "konsept": "Konsept Geliştirme"
    }
    
    # Check for specific patterns and generate professional titles
    for keyword, title_type in title_patterns.items():
        if keyword in message:
            words = message_content.split()
            
            # Handle specific professional cases
            if "logo" in message:
                return "Logo Tasarım Projesi"
            elif "web sitesi" in message or "website" in message:
                return "Web Geliştirme Projesi"
            elif any(lang in message for lang in ["python", "javascript", "java", "c++", "php", "react", "vue", "angular"]):
                lang_found = next(lang for lang in ["python", "javascript", "java", "c++", "php", "react", "vue", "angular"] if lang in message)
                return f"{lang_found.title()} Geliştirme"
            elif "nasıl" in message:
                # Extract main topic for "how to" questions
                main_words = [w for w in words if len(w) > 3 and w.lower() not in ["nasıl", "yapılır", "yaparım", "için", "olan", "kullanılır", "öğrenirim"]]
                if main_words:
                    subject = main_words[0].title()
                    return f"{subject} Nasıl Yapılır"
            elif any(q in message for q in ["nedir", "ne demek"]):
                # Extract main topic for definition questions
                main_words = [w for w in words if len(w) > 3 and w.lower() not in ["nedir", "demek", "olan", "için"]]
                if main_words:
                    subject = main_words[0].title()
                    return f"{subject} Nedir"
            
            # For other patterns, try to extract subject
            if len(words) >= 2:
                meaningful_words = [w for w in words[:4] if len(w) > 2 and w.lower() not in ["bir", "için", "ile", "olan", "gibi", "kadar", "hakkında"]]
                if meaningful_words and len(meaningful_words) >= 2:
                    subject = " ".join(meaningful_words[:2]).title()
                    return f"{subject} Projesi"
            
            return title_type
    
    # Advanced fallback with better categorization
    words = message_content.split()
    meaningful_words = [w for w in words if len(w) > 2 and w.lower() not in ["bir", "için", "ile", "olan", "gibi", "kadar", "hakkında", "şey", "böyle"]]
    
    # If it's a question
    if message.endswith('?') or any(q in message for q in ["mi", "mı", "mu", "mü"]):
        if meaningful_words:
            if len(meaningful_words) >= 2:
                return f"{' '.join(meaningful_words[:2]).title()} Sorusu"
            else:
                return f"{meaningful_words[0].title()} Hakkında"
    
    # If it contains technical terms
    tech_terms = ["sistem", "network", "server", "data", "algoritma", "machine learning", "ai", "yapay zeka"]
    if any(term in message for term in tech_terms):
        if meaningful_words:
            return f"{meaningful_words[0].title()} Teknoloji"
    
    # General meaningful title
    if len(meaningful_words) >= 3:
        return " ".join(meaningful_words[:3]).title()
    elif len(meaningful_words) >= 2:
        return f"{' '.join(meaningful_words[:2]).title()} Projesi"
    elif meaningful_words:
        return f"{meaningful_words[0].title()} Hakkında"
    else:
        return "Sohbet Mesajı"

# Initialize admin user
async def init_admin():
    """Initialize admin user if not exists"""
    admin_user = await db.users.find_one({"username": ADMIN_USERNAME})
    if not admin_user:
        admin = User(
            username=ADMIN_USERNAME,
            email="admin@bilgin.ai",
            password_hash=ADMIN_PASSWORD_HASH.decode('utf-8'),
            name="Admin",
            is_verified=True,
            is_admin=True,
            onboarding_completed=True
        )
        admin_dict = prepare_for_mongo(admin.dict())
        await db.users.insert_one(admin_dict)
        logging.info("Admin user created")

# Authentication Routes
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": user_data.email},
            {"username": user_data.username}
        ]
    })
    
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password)
    )
    
    user_dict = prepare_for_mongo(user.dict())
    await db.users.insert_one(user_dict)
    
    return {"message": "User registered successfully. Please verify your email."}

@api_router.post("/auth/login")
async def login_user(user_data: UserLogin, response: Response):
    # Find user
    user = await db.users.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    user = parse_from_mongo(user)
    
    # Create session token
    session_token, expires_at = create_access_token({"user_id": user["id"]})
    
    # Save session to database
    session = Session(
        user_id=user["id"],
        session_token=session_token,
        expires_at=expires_at
    )
    session_dict = prepare_for_mongo(session.dict())
    await db.sessions.insert_one(session_dict)
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        expires=expires_at
    )
    
    user_response = UserResponse(**user)
    return {"user": user_response, "message": "Login successful"}

@api_router.post("/auth/logout")
async def logout_user(response: Response, user: dict = Depends(require_auth)):
    # Delete session from database
    await db.sessions.delete_many({"user_id": user["id"]})
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logout successful"}

@api_router.get("/auth/me")
async def get_current_user_info(user: dict = Depends(require_auth)):
    return UserResponse(**user)

@api_router.post("/auth/onboarding")
async def complete_onboarding(onboarding_data: OnboardingData, user: dict = Depends(require_auth)):
    """Complete user onboarding by setting their name"""
    # Update user with name and mark onboarding as completed
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "name": onboarding_data.name,
            "onboarding_completed": True
        }}
    )
    
    # Get updated user
    updated_user = await db.users.find_one({"id": user["id"]})
    updated_user = parse_from_mongo(updated_user)
    
    return {"message": "Onboarding completed successfully", "user": UserResponse(**updated_user)}

# Google OAuth Routes
@api_router.get("/auth/google")
async def google_auth():
    redirect_url = "https://ai-bilgin.preview.emergentagent.com/dashboard"
    google_auth_url = f"https://auth.emergentagent.com/?redirect={redirect_url}"
    return {"auth_url": google_auth_url}

@api_router.post("/auth/google/callback")
async def google_callback(request: Request, response: Response):
    # Get session_id from request
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    
    try:
        # Get user data from Emergent Auth
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session")
            
            user_data = auth_response.json()
            
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data["email"]})
        
        if existing_user:
            user = parse_from_mongo(existing_user)
        else:
            # Create new user from Google data
            user = User(
                username=user_data["email"].split("@")[0],  # Use email prefix as username
                email=user_data["email"],
                password_hash="",  # No password for OAuth users
                name=user_data.get("name", ""),  # Get name from Google if available
                is_verified=True,  # Google users are auto-verified
                onboarding_completed=bool(user_data.get("name")),  # Complete onboarding if name exists
                oauth_provider="google",
                oauth_id=user_data["id"]
            )
            
            user_dict = prepare_for_mongo(user.dict())
            await db.users.insert_one(user_dict)
            user = user.dict()
        
        # Create session token
        session_token = user_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        # Save session to database
        session = Session(
            user_id=user["id"],
            session_token=session_token,
            expires_at=expires_at
        )
        session_dict = prepare_for_mongo(session.dict())
        await db.sessions.insert_one(session_dict)
        
        # Update last login
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            expires=expires_at
        )
        
        user_response = UserResponse(**user)
        return {"user": user_response, "message": "Google login successful"}
        
    except Exception as e:
        logging.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=400, detail="OAuth authentication failed")

# Admin Routes
@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(admin: dict = Depends(require_admin)):
    # Get statistics
    total_users = await db.users.count_documents({})
    verified_users = await db.users.count_documents({"is_verified": True})
    total_conversations = await db.conversations.count_documents({})
    total_messages = await db.messages.count_documents({})
    
    # Get recent users
    recent_users_data = await db.users.find().sort("created_at", -1).limit(10).to_list(10)
    recent_users = [UserResponse(**parse_from_mongo(user)) for user in recent_users_data]
    
    return AdminStats(
        total_users=total_users,
        verified_users=verified_users,
        total_conversations=total_conversations,
        total_messages=total_messages,
        recent_users=recent_users
    )

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("created_at", -1).to_list(1000)
    return [UserResponse(**parse_from_mongo(user)) for user in users]

# Chat Routes (Protected)
@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations(user: dict = Depends(require_auth)):
    conversations = await db.conversations.find({"user_id": user["id"]}).sort("updated_at", -1).to_list(1000)
    return [Conversation(**parse_from_mongo(conv)) for conv in conversations]

@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(input: ConversationCreate, user: dict = Depends(require_auth)):
    conversation = Conversation(user_id=user["id"], **input.dict())
    conversation_dict = prepare_for_mongo(conversation.dict())
    await db.conversations.insert_one(conversation_dict)
    return conversation

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, user: dict = Depends(require_auth)):
    # Check if conversation belongs to user
    conversation = await db.conversations.find_one({"id": conversation_id, "user_id": user["id"]})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(1000)
    return [MessageResponse(**parse_from_mongo(msg)) for msg in messages]

@api_router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(conversation_id: str, input: MessageCreate, user: dict = Depends(require_auth)):
    # Check if conversation belongs to user
    conversation = await db.conversations.find_one({"id": conversation_id, "user_id": user["id"]})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Save user message
    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=input.content
    )
    user_message_dict = prepare_for_mongo(user_message.dict())
    await db.messages.insert_one(user_message_dict)
    
    # Check if this is the first message and update conversation title
    message_count = await db.messages.count_documents({"conversation_id": conversation_id})
    if message_count == 1:  # This is the first message
        # Generate meaningful title using the new function
        new_title = generate_conversation_title(input.content)
            
        # Update conversation title
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"title": new_title, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    try:
        # Call AnythingLLM API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                ANYTHINGLLM_API_URL,
                headers={
                    "Authorization": f"Bearer {ANYTHINGLLM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "message": input.content,
                    "mode": input.mode,
                    "sessionId": conversation_id
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                ai_response = response.json()
                ai_content = ai_response.get("textResponse", "Sorry, I couldn't process your request.")
            else:
                ai_content = "Sorry, I'm having trouble connecting to the AI service."
                
    except Exception as e:
        logging.error(f"AnythingLLM API error: {e}")
        ai_content = "Sorry, I'm experiencing technical difficulties."
    
    # Save AI response
    ai_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=ai_content
    )
    ai_message_dict = prepare_for_mongo(ai_message.dict())
    await db.messages.insert_one(ai_message_dict)
    
    # Update conversation timestamp
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return MessageResponse(**ai_message.dict())

@api_router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(require_auth)):
    # Check if conversation belongs to user
    conversation = await db.conversations.find_one({"id": conversation_id, "user_id": user["id"]})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete messages first
    await db.messages.delete_many({"conversation_id": conversation_id})
    # Delete conversation
    await db.conversations.delete_one({"id": conversation_id})
    
    return {"message": "Conversation deleted successfully"}

# Include the router in the main app
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

@app.on_event("startup")
async def startup_event():
    await init_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()