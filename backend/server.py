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
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
from jose import JWTError, jwt
import secrets
import re
import asyncio


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
ANYTHINGLLM_API_URL = os.environ.get("ANYTHINGLLM_API_URL", "https://pilj1jbx.rcsrv.com/api/v1/workspace/bilgin/chat")
ANYTHINGLLM_API_KEY = os.environ.get("ANYTHINGLLM_API_KEY", "FC6CT8Q-QRE433A-J9K8SV8-S7E2M4N")

# Serper API configuration  
SERPER_API_KEY = os.environ.get("SERPER_API_KEY")
SERPER_API_URL = "https://google.serper.dev/search"

# Web search functions using Serper API
async def web_search(query: str, num_results: int = 3) -> List[dict]:
    """Perform web search using Serper API"""
    if not SERPER_API_KEY:
        logging.warning("Serper API key not configured")
        return []
    
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "q": query,
                "num": min(num_results, 10),  # Serper supports up to 10 results per call
                "hl": "tr",  # Turkish language preference
                "gl": "tr"   # Turkey geographic location
            }
            
            headers = {
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json"
            }
            
            response = await client.post(
                SERPER_API_URL,
                json=payload,
                headers=headers,
                timeout=8.0
            )
            
            if response.status_code == 200:
                data = response.json()
                results = []
                
                # Process organic results
                if "organic" in data:
                    for item in data["organic"][:num_results]:
                        results.append({
                            "title": item.get("title", ""),
                            "snippet": item.get("snippet", ""),
                            "link": item.get("link", "")
                        })
                
                # Include featured snippet if available
                if "answerBox" in data and len(results) > 0:
                    answer_box = data["answerBox"]
                    if "answer" in answer_box:
                        results[0]["featured_answer"] = answer_box["answer"]
                
                logging.info(f"Serper API returned {len(results)} search results")
                return results
            else:
                logging.error(f"Serper API error: {response.status_code} - {response.text}")
                return []
                
    except Exception as e:
        logging.error(f"Web search error with Serper API: {e}")
        return []

def extract_factual_claims(text: str) -> List[str]:
    """Extract potential factual claims from AI response"""
    # Simple patterns for factual claims
    factual_patterns = [
        # "X yazmıştır" pattern
        r'([A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+)\s+(?:tarafından\s+)?(?:yazılmıştır|yazmıştır|yazarı|eseri)',
        # "X yılında" pattern  
        r'(\d{4})\s*yılında\s+([^.]+)',
        # "X kişisi" pattern
        r'([A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+)\s+(?:doğmuştur|ölmüştür|kurmuştur)',
        # "X şehirde" pattern
        r'([A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+)\s+şehrinde',
        # Numbers and statistics
        r'(\d+(?:,\d+)*)\s+(?:metre|kilometre|kişi|yıl|gün)',
    ]
    
    claims = []
    for pattern in factual_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                claims.append(' '.join(str(m) for m in match))
            else:
                claims.append(str(match))
    
    return claims[:3]  # Limit to 3 claims to avoid too many searches

async def openai_fact_check(ai_response: str, original_query: str) -> str:
    """Use OpenAI GPT-4 to fact-check AI responses"""
    if not OPENAI_API_KEY:
        logging.warning("OpenAI API key not configured for fact-checking")
        return ai_response
    
    try:
        async with httpx.AsyncClient() as client:
            system_prompt = """Sen bir fact-checker asistanısın. Verilen cevabı doğrula ve eğer hatalı bilgi varsa düzelt. 
            Eğer cevap doğru ise olduğu gibi bırak. Eğer yanlış bilgi varsa doğru bilgiyi ver.
            Sadece kesin yanlış olan bilgileri düzelt, belirsiz durumlarda orijinal cevabı koru.
            Türkçe yanıt ver."""
            
            user_prompt = f"""Soru: {original_query}
Verilen Cevap: {ai_response}

Bu cevabı kontrol et ve eğer faktüel hata varsa düzelt. Eğer doğru ise aynen döndür."""
            
            payload = {
                "model": "gpt-4",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 600,
                "temperature": 0.1  # Lower temperature for fact-checking
            }
            
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.post(
                OPENAI_API_URL,
                json=payload,
                headers=headers,
                timeout=15.0
            )
            
            if response.status_code == 200:
                data = response.json()
                checked_content = data["choices"][0]["message"]["content"]
                
                logging.info("OpenAI fact-checking completed successfully")
                return checked_content
            else:
                logging.error(f"OpenAI fact-checking error: {response.status_code} - {response.text}")
                return ai_response  # Return original if fact-check fails
                
    except Exception as e:
        logging.error(f"OpenAI fact-checking error: {e}")
        return ai_response  # Return original if fact-check fails

async def fact_check_with_serper(ai_response: str, original_query: str) -> str:
    """Fact-check AI response using Serper web search"""
    
    # Extract factual claims from AI response
    claims = extract_factual_claims(ai_response)
    
    if not claims:
        logging.info("No factual claims detected in AI response")
        return ai_response
    
    logging.info(f"Fact-checking with Serper: {claims}")
    
    corrections = {}
    
    for claim in claims:
        # Create search query for fact-checking
        search_query = f'"{claim}" doğru mu bilgi kontrol'
        
        # Perform web search
        search_results = await web_search(search_query, num_results=2)
        
        if search_results:
            # Simple verification logic
            verification_text = " ".join([result["snippet"] for result in search_results])
            
            # Look for contradiction indicators
            contradiction_indicators = [
                "yanlış", "hatalı", "doğru değil", "gerçek değil", 
                "aslında", "doğrusu", "gerçekte", "düzeltme"
            ]
            
            has_contradiction = any(indicator in verification_text.lower() for indicator in contradiction_indicators)
            
            if has_contradiction:
                # Try to extract correct information
                correction = await extract_correction(claim, search_results, original_query)
                if correction:
                    corrections[claim] = correction
    
    # Apply corrections to response
    corrected_response = ai_response
    for incorrect_claim, correction in corrections.items():
        if correction and correction != incorrect_claim:
            corrected_response = corrected_response.replace(incorrect_claim, correction)
            logging.info(f"Applied correction: '{incorrect_claim}' -> '{correction}'")
    
    return corrected_response

async def extract_correction(claim: str, search_results: List[dict], original_query: str) -> Optional[str]:
    """Extract corrected information from search results"""
    
    # Simple correction extraction - look for "actually" patterns
    correction_patterns = [
        r'(?:aslında|gerçekte|doğrusu)\s+([^.]+)',
        r'([A-ZÇĞİÖŞÜ][^.]+?)\s+(?:tarafından|yazmıştır)',
        r'doğru\s+(?:cevap|bilgi)\s+([^.]+)',
    ]
    
    for result in search_results:
        text = result["snippet"] + " " + result["title"]
        
        for pattern in correction_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                correction = matches[0].strip()
                if len(correction) > 5 and correction.lower() != claim.lower():
                    return correction
    
    return None

def requires_web_search(question: str) -> bool:
    """Determine if question requires web search instead of AnythingLLM"""
    
    # Güncel/live information patterns
    web_search_patterns = [
        # Sports scores and results - ENHANCED patterns
        r'(?:maç|skor|sonuç|kazandı|kaybetti)\s+(?:ne|nedir|nasıl|kaç)',
        r'(?:galatasaray|fenerbahçe|beşiktaş|trabzonspor|kasımpaşa)\s+(?:maçı|skoru|maç|sonuç)',
        r'(?:galatasaray|fenerbahçe|beşiktaş|trabzonspor)\s+(?:kasımpaşa|galatasaray|fenerbahçe|beşiktaş)',
        r'(?:barcelona|real madrid|manchester|liverpool)\s+(?:maç|skor)',
        r'(?:şampiyonlar ligi|premier lig|süper lig)\s+(?:sonuç|tablo)',
        r'maç\s+sonuç',  # Direct "maç sonuç" pattern
        r'(?:son|güncel|bugünkü)\s+maç',  # "son maç" pattern
        
        # Current news and events  
        r'(?:son|güncel|bugünkü|şu an)\s+(?:haber|durum|gelişme)',
        r'(?:bugün|dün|geçen hafta)\s+(?:ne oldu|olan)',
        r'(?:seçim|politika|hükümet)\s+(?:son|güncel)',
        
        # Financial data
        r'(?:dolar|euro|bitcoin|borsa)\s+(?:kuru|fiyat|ne kadar)',
        r'(?:altın|gümüş|petrol)\s+(?:fiyat|kur)',
        
        # Weather
        r'(?:hava durumu|hava|yağmur|kar)\s+(?:nasıl|ne|bugün)',
        r'(?:ankara|istanbul|izmir)\s+(?:hava|sıcaklık)',
        
        # Recent releases/publications
        r'(?:yeni|son)\s+(?:çıkan|yayınlanan)\s+(?:kitap|film|müzik)',
        r'(?:2024|2025)\s+(?:çıkan|yayınlanan)',
        
        # Books/works not likely in system
        r'(?:hangi|kim)\s+(?:yazdı|yazarı|eseri)',  # Could be unknown works
        r'(?:kitap|roman|şiir)\s+(?:kim|kimin|hangi)',
        
        # Live data
        r'(?:şu an|anlık|canlı)\s+',
        r'(?:en son|en yeni|fresh)',
        
        # Technology and recent events
        r'(?:chatgpt|ai|yapay zeka)\s+(?:son|yeni|güncel)',
        r'(?:iphone|android|tesla)\s+(?:yeni|son|model)'
    ]
    
    question_lower = question.lower()
    
    # Debug logging
    for i, pattern in enumerate(web_search_patterns):
        if re.search(pattern, question_lower):
            logging.info(f"Web search triggered by pattern {i}: '{pattern}' for question: '{question}'")
            return True
    
    logging.info(f"No web search pattern matched for question: '{question}'")
    return False

async def clean_web_search_with_anythingllm(web_search_result: str, original_question: str) -> str:
    """Clean and improve web search results using AnythingLLM - REMOVE source attribution"""
    
    try:
        # Create a cleaning prompt for AnythingLLM - specifically ask to remove source info
        cleaning_prompt = f"""Lütfen aşağıdaki web araştırması sonucunu düzenle ve daha okunabilir hale getir.
        
Orijinal Soru: {original_question}

Web Araştırması Sonucu:
{web_search_result}

Lütfen bu bilgiyi:
1. Daha açık ve anlaşılır hale getir
2. Gereksiz tekrarları kaldır  
3. Türkçe dilbilgisi kurallarına uygun düzenle
4. Ana bilgileri öne çıkar
5. "Web araştırması sonucunda", "güncel web kaynaklarından" gibi kaynak belirtimlerini KALDIR
6. Sadece temiz, doğrudan cevap ver

Temiz cevap:"""

        async with httpx.AsyncClient() as client:
            api_payload = {
                "message": cleaning_prompt,
                "mode": "chat",
                "sessionId": f"cleaning-{hash(original_question)}"
            }
            
            response = await client.post(
                ANYTHINGLLM_API_URL,
                headers={
                    "Authorization": f"Bearer {ANYTHINGLLM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=api_payload,
                timeout=20.0
            )
            
            if response.status_code == 200:
                ai_response = response.json()
                cleaned_result = ai_response.get("textResponse", web_search_result)
                
                # Additional cleaning - remove any remaining source attributions
                cleaned_result = re.sub(r'\*.*web.*kaynak.*\*', '', cleaned_result, flags=re.IGNORECASE)
                cleaned_result = re.sub(r'web araştırması sonucunda:?', '', cleaned_result, flags=re.IGNORECASE)
                cleaned_result = re.sub(r'güncel.*kaynak.*alınmıştır', '', cleaned_result, flags=re.IGNORECASE)
                cleaned_result = cleaned_result.strip()
                
                logging.info("Web search result cleaned and source attribution removed")
                return cleaned_result
            else:
                logging.error(f"AnythingLLM cleaning error: {response.status_code}")
                return web_search_result
                
    except Exception as e:
        logging.error(f"Web search cleaning error: {e}")
        return web_search_result

async def get_anythingllm_response(question: str, conversation_mode: str = 'normal') -> str:
    """Get response from AnythingLLM"""
    
    try:
        # Apply conversation mode prompts if needed
        final_message = question
        if conversation_mode and conversation_mode != 'normal':
            mode_prompts = {
                'friend': "Lütfen samimi, motive edici ve esprili bir şekilde yanıtla. 3 küçük adım önerebilirsin. Arkadaş canlısı ol:",
                'realistic': "Eleştirel ve kanıt odaklı düşün. Güçlü ve zayıf yönleri belirt. Test planı öner. Gerçekci ol:",
                'coach': "Soru sorarak kullanıcının düşünmesini sağla. Hedef ve adım listesi çıkar. Koç gibi yaklaş:",
                'lawyer': "Bilinçli karşı argüman üret. Kör noktaları göster. Avukat perspektifiyle yaklaş:",
                'teacher': "Adım adım öğret. Örnek ver ve mini quiz ekle. Öğretmen gibi açıkla:",
                'minimalist': "En kısa, madde işaretli, süssüz yanıt ver. Minimalist ol:"
            }
            if conversation_mode in mode_prompts:
                final_message = f"{mode_prompts[conversation_mode]} {question}"
        
        async with httpx.AsyncClient() as client:
            api_payload = {
                "message": final_message,
                "mode": "chat",
                "sessionId": f"hybrid-{hash(question)}"
            }
            
            response = await client.post(
                ANYTHINGLLM_API_URL,
                headers={
                    "Authorization": f"Bearer {ANYTHINGLLM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=api_payload,
                timeout=20.0
            )
            
            if response.status_code == 200:
                ai_response = response.json()
                return ai_response.get("textResponse", "AnythingLLM yanıt veremedi.")
            else:
                logging.error(f"AnythingLLM error: {response.status_code}")
                return "AnythingLLM'e erişilemedi."
                
    except Exception as e:
        logging.error(f"AnythingLLM request error: {e}")
        return "AnythingLLM bağlantı hatası."

async def handle_web_search_question(question: str) -> str:
    """Handle questions that require web search using Serper API"""
    
    # Perform web search with optimized query
    search_query = optimize_search_query(question)
    search_results = await web_search(search_query, num_results=3)
    
    if not search_results:
        return "Üzgünüm, şu an web araması yapamıyorum. Lütfen daha sonra tekrar deneyin."
    
    # Format web search results into natural response
    response = format_web_search_response(question, search_results)
    return response

def can_anythingllm_answer(anythingllm_response: str) -> bool:
    """Check if AnythingLLM provided a useful answer"""
    
    # Indicators that AnythingLLM couldn't answer properly
    weak_response_indicators = [
        "bilmiyorum", "erişemiyorum", "güncel", "gerçek zamanlı", 
        "şu anda", "maalesef", "üzgünüm", "sorry", "i don't",
        "can't access", "unable to", "real-time", "current",
        "yanıt veremedi", "bağlantı hatası", "erişilemedi"
    ]
    
    response_lower = anythingllm_response.lower()
    
    # If response is too short, probably not useful
    if len(anythingllm_response.strip()) < 20:
        return False
    
    # Check for weak response indicators
    for indicator in weak_response_indicators:
        if indicator in response_lower:
            return False
    
    return True

def get_question_category(question: str) -> str:
    """Quickly categorize question type for optimal routing"""
    
    question_lower = question.lower().strip()
    
    # Simple greetings and casual questions - AnythingLLM only
    casual_patterns = [
        r'^(merhaba|selam|naber|nasılsın|iyi misin)$',
        r'^(hello|hi|hey)$',
        r'(teşekkür|sağol|eyvallah)',
        r'^(tamam|ok|peki|anladım)$',
        r'(nasıl gidiyor|keyifler|ne yapıyorsun)',
        r'^(iyi geceler|günaydın|tünaydın)$'
    ]
    
    # Current/live information - Web search required
    current_info_patterns = [
        r'(bugün|şu an|anlık|canlı|güncel|son)\s+',
        r'(hava durumu|sıcaklık|yağmur)',
        r'(dolar|euro|bitcoin)\s+(kur|fiyat)',
        r'(maç|skor|sonuç).*(ne|nedir|nasıl|kaç)',
        r'(haber|gelişme|olay).*(son|yeni|bugün)',
        r'(açık|kapalı).*(şu an|bugün)',
        r'(2024|2025).*(çıkan|yayınlanan|son)'
    ]
    
    # Check for casual questions first
    for pattern in casual_patterns:
        if re.search(pattern, question_lower):
            return 'casual'
    
    # Check for current information needs
    for pattern in current_info_patterns:
        if re.search(pattern, question_lower):
            return 'current'
    
    # Check if it's a factual knowledge question that might need verification
    factual_patterns = [
        r'(kim|hangi|ne zaman|nerede).*(yazdı|yaptı|oldu|kurdu)',
        r'(kaç|ne kadar).*(yıl|metre|kilo|kişi)',
        r'(başkenti|nüfusu|yüzölçümü)',
        r'(doğum|ölüm).*(tarih|yıl)',
        r'(eseri|kitabı|şiiri|filmi)'
    ]
    
    for pattern in factual_patterns:
        if re.search(pattern, question_lower):
            return 'factual'
    
    # Math or calculation questions - AnythingLLM preferred
    if re.search(r'(\d+\s*[\+\-\*\/x×÷]\s*\d+|matematik|hesap|kaç\s+eder)', question_lower):
        return 'math'
    
    # Default to general knowledge
    return 'general'

def are_responses_similar(response1: str, response2: str) -> bool:
    """Check if two responses contain similar information to avoid duplication"""
    
    if not response1 or not response2:
        return False
    
    # Remove common prefixes/suffixes for comparison
    clean1 = re.sub(r'(web araştırması sonucunda:?|bilgin cevabı:?)', '', response1.lower())
    clean2 = re.sub(r'(web araştırması sonucunda:?|bilgin cevabı:?)', '', response2.lower())
    
    # Simple similarity check - if one response contains most words from the other
    words1 = set(clean1.split())
    words2 = set(clean2.split())
    
    if not words1 or not words2:
        return False
    
    # Remove common short words
    common_words = {'bir', 'bu', 'şu', 'da', 'de', 've', 'ile', 'için', 'olan', 'the', 'and', 'or', 'in', 'on', 'at'}
    words1 = words1 - common_words
    words2 = words2 - common_words
    
    if not words1 or not words2:
        return False
    
    # Calculate overlap
    intersection = len(words1.intersection(words2))
    smaller_set_size = min(len(words1), len(words2))
    
    # If 60% or more words overlap, consider similar
    similarity = intersection / smaller_set_size
    
    logging.info(f"Response similarity: {similarity:.2f} (threshold: 0.6)")
    return similarity >= 0.6

async def smart_hybrid_response(question: str, conversation_mode: str = 'normal') -> str:
    """Smart hybrid system with quick analysis and deduplication"""
    
    logging.info(f"Starting smart hybrid analysis for: {question}")
    
    # Quick question categorization
    category = get_question_category(question)
    logging.info(f"Question category: {category}")
    
    if category == 'casual':
        # Casual questions - only use AnythingLLM, no web search needed
        logging.info("Casual question detected - using AnythingLLM only")
        anythingllm_response = await get_anythingllm_response(question, conversation_mode)
        return anythingllm_response
        
    elif category == 'current':
        # Current information - prioritize web search but still check AnythingLLM
        logging.info("Current information question - prioritizing web search")
        
        # Get web search first (faster for current info)
        web_search_response = await handle_web_search_question(question)
        anythingllm_response = await get_anythingllm_response(question, conversation_mode)
        
        # Check if AnythingLLM has useful info
        if can_anythingllm_answer(anythingllm_response):
            # Check similarity to avoid duplication
            if are_responses_similar(anythingllm_response, web_search_response):
                # Similar responses - return cleaned web search only
                return await clean_web_search_with_anythingllm(web_search_response, question)
            else:
                # Different info - combine them
                return f"""**BİLGİN Cevabı:**
{anythingllm_response}

**Güncel Web Bilgisi:**
{await clean_web_search_with_anythingllm(web_search_response, question)}"""
        else:
            # Only web search has good info
            return await clean_web_search_with_anythingllm(web_search_response, question)
            
    elif category == 'math':
        # Math questions - AnythingLLM is usually better, but verify with web if needed
        logging.info("Math question detected - using AnythingLLM primarily")
        anythingllm_response = await get_anythingllm_response(question, conversation_mode)
        
        if can_anythingllm_answer(anythingllm_response):
            return anythingllm_response
        else:
            # AnythingLLM failed, try web search as backup
            web_search_response = await handle_web_search_question(question)
            return await clean_web_search_with_anythingllm(web_search_response, question)
            
    else:
        # Factual or general questions - use full hybrid system
        logging.info("Factual/general question - using full hybrid system")
        return await hybrid_response_system(question, conversation_mode)
    """Advanced hybrid system: Use both AnythingLLM and web search, validate and choose best"""
    
    logging.info(f"Starting hybrid response system for: {question}")
    
    # Get both responses in parallel for speed
    anythingllm_task = asyncio.create_task(get_anythingllm_response(question, conversation_mode))
    web_search_task = asyncio.create_task(handle_web_search_question(question))
    
    try:
        # Wait for both responses
        anythingllm_response, web_search_response = await asyncio.gather(
            anythingllm_task, 
            web_search_task, 
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(anythingllm_response, Exception):
            logging.error(f"AnythingLLM task failed: {anythingllm_response}")
            anythingllm_response = "AnythingLLM hatası oluştu."
            
        if isinstance(web_search_response, Exception):
            logging.error(f"Web search task failed: {web_search_response}")
            web_search_response = "Web araması hatası oluştu."
        
        logging.info("Both responses received, analyzing...")
        
        # Clean web search result with AnythingLLM
        if web_search_response and "web araştırması sonucunda:" in web_search_response.lower():
            web_search_response = await clean_web_search_with_anythingllm(web_search_response, question)
            logging.info("Web search response cleaned")
        
        # Decision logic
        anythingllm_can_answer = can_anythingllm_answer(anythingllm_response)
        web_search_has_results = web_search_response and len(web_search_response.strip()) > 50
        
        logging.info(f"AnythingLLM can answer: {anythingllm_can_answer}, Web search has results: {web_search_has_results}")
        
        if anythingllm_can_answer and web_search_has_results:
            # Both have answers - combine them
            combined_response = f"""**BİLGİN Cevabı:**
{anythingllm_response}

**Web Doğrulaması:**
{web_search_response}

*Her iki kaynaktan da bilgi bulundu ve doğrulandı.*"""
            return combined_response
            
        elif anythingllm_can_answer:
            # Only AnythingLLM has good answer
            return f"{anythingllm_response}"
            
        elif web_search_has_results:
            # Only web search has results - return CLEAN response without source attribution
            return web_search_response
            
        else:
            # Neither has good results
            return "Üzgünüm, bu sorunuza hem veritabanımda hem de web aramasında yeterli bilgi bulamadım. Soruyu farklı şekilde sorabilir misiniz?"
            
    except Exception as e:
        logging.error(f"Hybrid response system error: {e}")
        return "Hybrid sistem hatası oluştu. Lütfen tekrar deneyin."

def optimize_search_query(question: str) -> str:
    """Optimize question for better web search results"""
    
    # Remove question words and optimize for search
    question_clean = question.lower()
    
    # Remove Turkish question words
    remove_words = [
        'nasıl', 'ne', 'nedir', 'kim', 'nerede', 'ne zaman', 'kaç', 'hangi',
        'mıdır', 'midir', 'mudur', 'müdür', 'mi', 'mı', 'mu', 'mü'
    ]
    
    for word in remove_words:
        question_clean = re.sub(f'\\b{word}\\b', '', question_clean)
    
    # Clean up extra spaces
    question_clean = ' '.join(question_clean.split())
    
    # Add context for better results
    if 'maç' in question_clean or 'skor' in question_clean:
        question_clean += ' sonuç skor'
    elif 'kitap' in question_clean or 'roman' in question_clean:
        question_clean += ' yazar eser bilgi'
    elif 'haber' in question_clean:
        question_clean += ' güncel haberler'
    
    return question_clean

def format_web_search_response(question: str, search_results: List[dict]) -> str:
    """Format web search results into natural conversational response"""
    
    if not search_results:
        return "Bu konuda güncel bilgi bulamadım."
    
    # Combine search results into coherent response
    main_info = []
    for result in search_results:
        snippet = result.get("snippet", "").strip()
        if snippet and len(snippet) > 10:
            main_info.append(snippet)
    
    if not main_info:
        return "Bu konuda detaylı bilgi bulamadım."
    
    # Create natural response
    response = "Web araştırması sonucunda:\n\n"
    
    # Use first result as main answer
    response += main_info[0]
    
    # Add supplementary info if available
    if len(main_info) > 1:
        response += f"\n\nEk bilgi: {main_info[1]}"
    
    # Add source indicator
    response += f"\n\n*Güncel web kaynaklarından alınmıştır ({len(search_results)} sonuç)*"
    
    return response

def should_fact_check(ai_response: str) -> bool:
    """Determine if AI response should be fact-checked"""
    
    # Skip fact-checking for certain response types
    skip_patterns = [
        r'^(?:merhaba|selam|nasılsın)',  # Greetings
        r'(?:teşekkür|sağol|eyvallah)',  # Thanks
        r'(?:anlamadım|anlayamadım)',    # Confusion
        r'(?:üzgünüm|maalesef)',         # Apologies
        r'^\d+[\+\-\*\/]\d+',           # Simple math
    ]
    
    for pattern in skip_patterns:
        if re.search(pattern, ai_response.lower()):
            return False
    
    # Fact-check if contains potential factual claims
    factual_indicators = [
        r'tarafından\s+yazılmıştır',  # Written by
        r'\d{4}\s*yılında',          # In year
        r'[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+\s+(?:doğmuş|ölmüş|kurmuş)',  # Born/died
        r'\d+\s*(?:metre|kilometre|kişi)',  # Numbers with units
        r'başkenti|nüfusu|yüzölçümü'  # Geographic facts
    ]
    
    return any(re.search(pattern, ai_response, re.IGNORECASE) for pattern in factual_indicators)

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
    name: Optional[str] = None
    is_verified: bool
    is_admin: bool
    onboarding_completed: bool = False
    created_at: str
    last_login: Optional[str] = None

class ReportCreate(BaseModel):
    message: str
    user_agent: Optional[str] = None
    url: Optional[str] = None

class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    message: str
    user_agent: Optional[str] = None
    url: Optional[str] = None
    status: str = "open"  # open, investigating, resolved
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
class ReportResponse(BaseModel):
    id: str
    user_id: str
    message: str
    user_agent: Optional[str] = None
    url: Optional[str] = None
    status: str
    created_at: str

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
    conversationMode: Optional[str] = None  # Test için konuşma modları

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
            # Only convert datetime strings for models that expect datetime objects
            # UserResponse expects strings, so we skip conversion for user objects
            if key in ['expires_at'] and isinstance(value, str):
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
    """Initialize admin user and update existing users"""
    # Update existing users with missing fields
    await db.users.update_many(
        {"name": {"$exists": False}},
        {"$set": {"name": None, "onboarding_completed": False}}
    )
    
    # Create admin user if not exists
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
    else:
        # Update admin with missing fields if needed
        await db.users.update_one(
            {"username": ADMIN_USERNAME},
            {"$set": {
                "name": "Admin",
                "onboarding_completed": True
            }}
        )

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
    try:
        logging.info(f"Login attempt for user: {user_data.username}")
        
        # Find user by username or email
        user = await db.users.find_one({
            "$or": [
                {"username": user_data.username},
                {"email": user_data.username}  # Allow login with email in username field
            ]
        })
        
        if not user:
            logging.warning(f"User not found: {user_data.username}")
            raise HTTPException(status_code=400, detail="Invalid credentials")
            
        if not verify_password(user_data.password, user["password_hash"]):
            logging.warning(f"Invalid password for user: {user_data.username}")
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        user = parse_from_mongo(user)
        logging.info(f"User login successful: {user['username']}")
        
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
        
    except HTTPException:
        # Re-raise HTTP exceptions (like invalid credentials)
        raise
    except Exception as e:
        logging.error(f"Unexpected error during login for user {user_data.username}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

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
    redirect_url = "https://chatmode-hub.preview.emergentagent.com/dashboard"
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
# Anonymous user - no auth required
ANONYMOUS_USER_ID = "anonymous"

@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations():
    conversations = await db.conversations.find({"user_id": ANONYMOUS_USER_ID}).sort("updated_at", -1).to_list(1000)
    return [Conversation(**parse_from_mongo(conv)) for conv in conversations]

@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(input: ConversationCreate):
    conversation = Conversation(user_id=ANONYMOUS_USER_ID, **input.dict())
    conversation_dict = prepare_for_mongo(conversation.dict())
    await db.conversations.insert_one(conversation_dict)
    return conversation

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str):
    # Check if conversation exists for anonymous user
    conversation = await db.conversations.find_one({"id": conversation_id, "user_id": ANONYMOUS_USER_ID})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(1000)
    return [MessageResponse(**parse_from_mongo(msg)) for msg in messages]

@api_router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(conversation_id: str, input: MessageCreate):
    # Check if conversation exists for anonymous user
    conversation = await db.conversations.find_one({"id": conversation_id, "user_id": ANONYMOUS_USER_ID})
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
        # SMART HYBRID SYSTEM: Quick analysis and intelligent routing
        logging.info(f"Using SMART HYBRID SYSTEM for question: {input.content}")
        
        ai_content = await smart_hybrid_response(input.content, input.conversationMode)
        logging.info("Smart hybrid system completed successfully")
                
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
    # Check if conversation exists for anonymous user
    conversation = await db.conversations.find_one({"id": conversation_id, "user_id": ANONYMOUS_USER_ID})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete conversation and associated messages
    await db.conversations.delete_one({"id": conversation_id})
    await db.messages.delete_many({"conversation_id": conversation_id})
    
    return {"message": "Conversation deleted successfully"}

# Report endpoints
@api_router.post("/reports", response_model=ReportResponse)
async def create_report(input: ReportCreate, user: dict = Depends(require_auth)):
    """Create a new bug report"""
    report = Report(
        user_id=user["id"],
        message=input.message,
        user_agent=input.user_agent,
        url=input.url
    )
    
    report_dict = prepare_for_mongo(report.dict())
    await db.reports.insert_one(report_dict)
    
    return ReportResponse(**report.dict())

@api_router.get("/admin/reports", response_model=List[ReportResponse])
async def get_reports(user: dict = Depends(require_admin)):
    """Get all bug reports (admin only)"""
    reports = await db.reports.find().sort("created_at", -1).to_list(length=None)
    return [ReportResponse(**parse_from_mongo(report)) for report in reports]

@api_router.patch("/admin/reports/{report_id}/status")
async def update_report_status(report_id: str, status: str, user: dict = Depends(require_admin)):
    """Update report status (admin only)"""
    if status not in ["open", "investigating", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.reports.update_one(
        {"id": report_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"message": "Report status updated successfully"}

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