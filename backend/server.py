from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx

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
ANYTHINGLLM_API_URL = "https://malz4o1p.rcld.app/api/v1/workspace/bilgin/chat"
ANYTHINGLLM_API_KEY = "KPTQKBG-W8E40WK-MZQ3XSX-ZWZC0PM"

# Define Models
class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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

# Helper function to prepare datetime for MongoDB
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        for key, value in item.items():
            if key in ['created_at', 'updated_at', 'timestamp'] and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    pass
    return item

def generate_conversation_title(message_content: str) -> str:
    """Generate a meaningful conversation title based on the first message content"""
    message = message_content.lower().strip()
    
    # Common patterns for title generation
    title_patterns = {
        # Questions and requests
        "nasıl": "Nasıl Yapılır",
        "nedir": "Bilgi Talebi",
        "ne demek": "Kavram Açıklaması",
        "öğrenmek istiyorum": "Öğrenme İsteği",
        "öğretir misin": "Öğretim Talebi",
        "yardım": "Yardım İsteği",
        "destek": "Destek Talebi",
        
        # Design and creativity
        "logo": "Logo Tasarlama",
        "tasarla": "Tasarım İsteği", 
        "çiz": "Çizim İsteği",
        "resim": "Görsel İsteği",
        "design": "Tasarım Projesi",
        
        # Programming and tech
        "kod": "Programlama",
        "program": "Programlama",
        "python": "Python Programlama",
        "javascript": "JavaScript Geliştirme",
        "web sitesi": "Web Geliştirme",
        "uygulama": "Uygulama Geliştirme",
        "yazılım": "Yazılım Geliştirme",
        
        # Writing and content
        "yaz": "Yazım İsteği",
        "makale": "Makale Yazımı",
        "mektup": "Mektup Yazımı",
        "içerik": "İçerik Üretimi",
        "metin": "Metin Yazımı",
        
        # Analysis and explanation
        "açıkla": "Açıklama İsteği",
        "analiz": "Analiz Talebi",
        "karşılaştır": "Karşılaştırma",
        "fark": "Fark Analizi",
        
        # Problem solving
        "çöz": "Problem Çözme",
        "hata": "Hata Giderme", 
        "sorun": "Sorun Çözme",
        "düzelt": "Düzeltme İsteği",
        
        # Learning and education
        "öğren": "Öğrenme",
        "eğit": "Eğitim",
        "ders": "Ders İsteği",
        "kurs": "Kurs Bilgisi",
        "kitap": "Kitap Önerisi",
        
        # Business and planning
        "plan": "Planlama",
        "strateji": "Strateji Geliştirme",
        "iş": "İş Konuları",
        "proje": "Proje Yönetimi",
        "pazarlama": "Pazarlama Stratejisi",
        
        # General topics
        "öneri": "Öneri İsteği",
        "tavsiye": "Tavsiye Talebi",
        "fikir": "Fikir Paylaşımı",
        "görüş": "Görüş Paylaşımı"
    }
    
    # Check for specific patterns
    for keyword, title_type in title_patterns.items():
        if keyword in message:
            # Try to extract the main subject
            words = message_content.split()
            
            # Handle questions
            if any(q in message for q in ["nasıl", "nedir", "ne demek"]):
                # Extract main topic from question
                main_words = [w for w in words if len(w) > 3 and w.lower() not in ["nasıl", "nedir", "demek", "için", "olan", "yapılır", "kullanılır"]]
                if main_words:
                    return f"{main_words[0].title()} Hakkında"
            
            # Handle requests with specific subjects
            if "logo" in message:
                return "Logo Tasarlama İsteği"
            if "web sitesi" in message or "website" in message:
                return "Web Sitesi Geliştirme"
            if any(lang in message for lang in ["python", "javascript", "java", "c++", "php"]):
                lang_found = next(lang for lang in ["python", "javascript", "java", "c++", "php"] if lang in message)
                return f"{lang_found.title()} Programlama"
            
            # Extract subject for other patterns
            if len(words) > 2:
                # Get meaningful words (longer than 2 chars)
                meaningful_words = [w for w in words[:5] if len(w) > 2 and not w.lower() in ["bir", "bir", "için", "ile", "olan", "gibi", "kadar"]]
                if meaningful_words:
                    subject = meaningful_words[0].title()
                    return f"{subject} - {title_type}"
            
            return title_type
    
    # Fallback: Use first few meaningful words
    words = message_content.split()
    meaningful_words = [w for w in words[:6] if len(w) > 2]
    
    if len(meaningful_words) >= 3:
        return " ".join(meaningful_words[:3]).title()
    elif len(meaningful_words) >= 2:
        return " ".join(meaningful_words[:2]).title()
    elif meaningful_words:
        return meaningful_words[0].title()
    else:
        return "Yeni Sohbet"

# Routes
@api_router.get("/")
async def root():
    return {"message": "BİLGİN AI Chat API"}

@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations():
    conversations = await db.conversations.find().sort("updated_at", -1).to_list(1000)
    return [Conversation(**parse_from_mongo(conv)) for conv in conversations]

@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(input: ConversationCreate):
    conversation = Conversation(**input.dict())
    conversation_dict = prepare_for_mongo(conversation.dict())
    await db.conversations.insert_one(conversation_dict)
    return conversation

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str):
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(1000)
    return [MessageResponse(**parse_from_mongo(msg)) for msg in messages]

@api_router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(conversation_id: str, input: MessageCreate):
    # Check if conversation exists
    conversation = await db.conversations.find_one({"id": conversation_id})
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
        # Generate title from first message (first 4-5 words or max 50 chars)
        words = input.content.split()
        if len(words) <= 5:
            new_title = input.content[:50]
        else:
            new_title = " ".join(words[:5]) + "..."
        
        # Clean title and ensure it's not empty
        new_title = new_title.strip()
        if not new_title:
            new_title = "Yeni Sohbet"
            
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
async def delete_conversation(conversation_id: str):
    # Delete messages first
    await db.messages.delete_many({"conversation_id": conversation_id})
    # Delete conversation
    result = await db.conversations.delete_one({"id": conversation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()