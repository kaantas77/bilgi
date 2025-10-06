import requests
import tempfile
import os
import time

def test_anythingllm_scenarios():
    """Test the specific AnythingLLM scenarios from review request"""
    base_url = "https://bilgin-ai.preview.emergentagent.com/api"
    
    print("🧪 TESTING IMPROVED ANYTHINGLLM EVALUATION")
    print("="*60)
    
    # Create conversation
    response = requests.post(f"{base_url}/conversations", json={"title": "AnythingLLM Evaluation Test"})
    conv_id = response.json()['id']
    
    # Scenario 1: Questions that should NOT trigger web search
    print("\n📚 SCENARIO 1: AnythingLLM Knowledge Test (Should NOT trigger web search)")
    knowledge_questions = [
        "Einstein kimdir?",
        "Python nedir?", 
        "Matematik: 15 × 7 kaç eder?"
    ]
    
    for question in knowledge_questions:
        print(f"\n  Testing: '{question}'")
        start_time = time.time()
        
        response = requests.post(
            f"{base_url}/conversations/{conv_id}/messages",
            json={"content": question, "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            ai_response = response.json()['content']
            print(f"  Response time: {response_time:.2f}s")
            print(f"  Response: {ai_response[:100]}...")
            
            # Check for web search indicators
            web_indicators = ['web araştırması sonucunda', 'güncel web kaynaklarından']
            has_web_search = any(indicator in ai_response.lower() for indicator in web_indicators)
            
            if not has_web_search:
                print("  ✅ PASSED: No web search triggered (AnythingLLM used)")
            else:
                print("  ❌ FAILED: Web search was triggered unnecessarily")
        else:
            print(f"  ❌ FAILED: API error {response.status_code}")
        
        time.sleep(2)
    
    # Scenario 2: Questions that might trigger web search if AnythingLLM is inadequate
    print("\n🔍 SCENARIO 2: AnythingLLM Inadequate Response (Should trigger web search if needed)")
    inadequate_questions = [
        "2024 yılının en son teknoloji haberleri nelerdir?",
        "Bugün dolar kuru kaç TL?"
    ]
    
    for question in inadequate_questions:
        print(f"\n  Testing: '{question}'")
        start_time = time.time()
        
        response = requests.post(
            f"{base_url}/conversations/{conv_id}/messages",
            json={"content": question, "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            ai_response = response.json()['content']
            print(f"  Response time: {response_time:.2f}s")
            print(f"  Response: {ai_response[:150]}...")
            
            # Check if web search was used OR AnythingLLM gave adequate response
            web_indicators = ['web araştırması sonucunda', 'güncel web kaynaklarından']
            inadequate_indicators = ['bilmiyorum', 'emin değilim', 'kesin bilgi veremem']
            
            has_web_search = any(indicator in ai_response.lower() for indicator in web_indicators)
            has_inadequate_response = any(indicator in ai_response.lower() for indicator in inadequate_indicators)
            
            if has_web_search:
                print("  ✅ PASSED: Web search triggered due to inadequate AnythingLLM response")
            elif not has_inadequate_response and len(ai_response.strip()) > 50:
                print("  ✅ PASSED: AnythingLLM provided adequate response (no web search needed)")
            else:
                print("  ❌ FAILED: AnythingLLM gave inadequate response but web search not triggered")
        else:
            print(f"  ❌ FAILED: API error {response.status_code}")
        
        time.sleep(2)

def test_image_support_scenarios():
    """Test the image support scenarios from review request"""
    base_url = "https://bilgin-ai.preview.emergentagent.com/api"
    
    print("\n\n🖼️ TESTING IMAGE SUPPORT FEATURES")
    print("="*60)
    
    # Create conversation
    response = requests.post(f"{base_url}/conversations", json={"title": "Image Support Test"})
    conv_id = response.json()['id']
    
    # Scenario 3: Image Upload Support
    print("\n📤 SCENARIO 3: Image Upload Support (JPG, PNG, GIF, WEBP)")
    image_formats = ['jpg', 'png', 'gif', 'webp', 'bmp']
    
    for img_format in image_formats:
        print(f"\n  Testing {img_format.upper()} upload...")
        
        # Create minimal test image file
        temp_file = tempfile.NamedTemporaryFile(suffix=f'.{img_format}', delete=False)
        temp_file.write(b'\xFF\xD8\xFF\xE0' if img_format == 'jpg' else b'\x89PNG\r\n\x1a\n')
        temp_file.close()
        
        try:
            with open(temp_file.name, 'rb') as f:
                files = {'file': (f'test.{img_format}', f, f'image/{img_format}')}
                upload_response = requests.post(f"{base_url}/conversations/{conv_id}/upload", files=files)
            
            if upload_response.status_code == 200:
                print(f"  ✅ {img_format.upper()} upload successful")
                try:
                    data = upload_response.json()
                    if 'system_message' in data:
                        system_msg = data['system_message']
                        if '🖼️' in system_msg:
                            print(f"  ✅ Image icon (🖼️) found in system message")
                        else:
                            print(f"  ⚠️  WARNING: No image icon in system message")
                except:
                    pass
            else:
                print(f"  ❌ {img_format.upper()} upload failed: {upload_response.status_code}")
        
        except Exception as e:
            print(f"  ❌ Exception: {e}")
        finally:
            if os.path.exists(temp_file.name):
                os.remove(temp_file.name)
    
    # Scenario 4: ChatGPT Vision Integration
    print("\n👁️ SCENARIO 4: ChatGPT Vision Integration")
    
    # First upload an image
    temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    temp_file.write(b'\xFF\xD8\xFF\xE0\x00\x10JFIF')  # Minimal JPEG header
    temp_file.close()
    
    try:
        with open(temp_file.name, 'rb') as f:
            files = {'file': ('vision_test.jpg', f, 'image/jpeg')}
            upload_response = requests.post(f"{base_url}/conversations/{conv_id}/upload", files=files)
        
        if upload_response.status_code == 200:
            print("  ✅ Image uploaded for vision test")
            
            # Test vision-related questions
            vision_questions = [
                "Bu görselde ne var?",
                "Görseldeki metni oku",
                "Bu resimde hangi renkler var?"
            ]
            
            for question in vision_questions:
                print(f"\n  Testing vision question: '{question}'")
                
                response = requests.post(
                    f"{base_url}/conversations/{conv_id}/messages",
                    json={"content": question, "mode": "chat"}
                )
                
                if response.status_code == 200:
                    ai_response = response.json()['content']
                    print(f"  Response: {ai_response[:100]}...")
                    
                    # Check if response indicates vision processing
                    vision_indicators = ['görsel', 'resim', 'fotoğraf', 'image', 'renk']
                    has_vision_response = any(indicator in ai_response.lower() for indicator in vision_indicators)
                    
                    if has_vision_response and len(ai_response.strip()) > 20:
                        print("  ✅ Vision API appears to be working")
                    else:
                        print("  ⚠️  Vision API response may need improvement")
                else:
                    print(f"  ❌ API error: {response.status_code}")
                
                time.sleep(2)
        else:
            print("  ❌ Image upload failed for vision test")
    
    except Exception as e:
        print(f"  ❌ Vision test exception: {e}")
    finally:
        if os.path.exists(temp_file.name):
            os.remove(temp_file.name)
    
    # Scenario 5: File Visibility
    print("\n👀 SCENARIO 5: File Visibility (PDF and photos should be visible in chat)")
    
    # Upload PDF
    temp_pdf = tempfile.NamedTemporaryFile(mode='w', suffix='.pdf', delete=False, encoding='utf-8')
    temp_pdf.write("Test PDF content for visibility")
    temp_pdf.close()
    
    try:
        with open(temp_pdf.name, 'rb') as f:
            files = {'file': ('visibility_test.pdf', f, 'application/pdf')}
            pdf_response = requests.post(f"{base_url}/conversations/{conv_id}/upload", files=files)
        
        if pdf_response.status_code == 200:
            print("  ✅ PDF uploaded successfully")
            try:
                data = pdf_response.json()
                if 'system_message' in data and '📎' in data['system_message']:
                    print("  ✅ PDF icon (📎) found in system message")
                else:
                    print("  ⚠️  WARNING: No PDF icon in system message")
            except:
                pass
        
        # Check file list
        file_list_response = requests.get(f"{base_url}/conversations/{conv_id}/files")
        if file_list_response.status_code == 200:
            files = file_list_response.json()
            print(f"  ✅ File list retrieved: {len(files)} files")
        else:
            print("  ❌ Failed to retrieve file list")
    
    except Exception as e:
        print(f"  ❌ File visibility test exception: {e}")
    finally:
        if os.path.exists(temp_pdf.name):
            os.remove(temp_pdf.name)

def main():
    print("🔥 FOCUSED IMPROVED SYSTEM TEST")
    print("Testing specific scenarios from review request")
    print("="*80)
    
    try:
        test_anythingllm_scenarios()
        test_image_support_scenarios()
        
        print("\n\n🎯 FOCUSED TEST COMPLETED")
        print("Check results above for detailed analysis")
        
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")

if __name__ == "__main__":
    main()