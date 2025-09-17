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