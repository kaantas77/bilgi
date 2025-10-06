import requests
import sys
import json
import time
import os
import tempfile
from datetime import datetime
import base64

class ImprovedSystemTester:
    def __init__(self, base_url="https://bilgin-ai.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.conversation_id = None
        self.anythingllm_tests_passed = 0
        self.anythingllm_tests_run = 0
        self.image_tests_passed = 0
        self.image_tests_run = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_conversation(self, title):
        """Create a test conversation"""
        success, response = self.run_test(
            f"Create Conversation: {title}",
            "POST",
            "conversations",
            200,
            data={"title": title}
        )
        
        if success and 'id' in response:
            return response['id']
        return None

    def create_test_image(self, image_type="jpg", content_type="simple"):
        """Create a test image file"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create a simple test image
            img = Image.new('RGB', (400, 200), color='white')
            draw = ImageDraw.Draw(img)
            
            if content_type == "simple":
                draw.text((50, 50), "Test Image", fill='black')
                draw.text((50, 100), "Bu bir test görseli", fill='blue')
            elif content_type == "text":
                draw.text((20, 20), "IMPORTANT TEXT:", fill='red')
                draw.text((20, 60), "This image contains", fill='black')
                draw.text((20, 100), "readable text content", fill='black')
                draw.text((20, 140), "for Vision API testing", fill='black')
            
            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(suffix=f'.{image_type}', delete=False)
            img.save(temp_file.name, format=image_type.upper())
            temp_file.close()
            
            return temp_file.name
        except ImportError:
            # Fallback: create a simple binary file
            temp_file = tempfile.NamedTemporaryFile(suffix=f'.{image_type}', delete=False)
            temp_file.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x01\x90\x00\x00\x00\xc8\x08\x02\x00\x00\x00')
            temp_file.close()
            return temp_file.name

    def test_anythingllm_knowledge_no_web_search(self):
        """Test Scenario 1: AnythingLLM Knowledge Test (Should NOT trigger web search)"""
        print("\n🧪 IMPROVED ANYTHINGLLM TEST 1: Knowledge Questions (No Web Search)")
        
        conv_id = self.create_test_conversation("AnythingLLM Knowledge Test")
        if not conv_id:
            return False
        
        self.anythingllm_tests_run += 1
        
        # Test questions where AnythingLLM should provide good answers without web search
        knowledge_questions = [
            "Einstein kimdir?",
            "Python nedir?", 
            "Matematik: 15 × 7 kaç eder?",
            "Türkiye'nin başkenti neresi?",
            "Güneş sistemi kaç gezegenden oluşur?"
        ]
        
        successful_tests = 0
        
        for question in knowledge_questions:
            print(f"   Testing knowledge question: '{question}'")
            
            start_time = time.time()
            success, response = self.run_test(
                f"Knowledge Question: '{question}'",
                "POST",
                f"conversations/{conv_id}/messages",
                200,
                data={"content": question, "mode": "chat"}
            )
            response_time = time.time() - start_time
            
            if success:
                ai_response = response.get('content', '')
                print(f"   Response Time: {response_time:.2f} seconds")
                print(f"   AI Response: {ai_response[:150]}...")
                
                # Check that NO web search was triggered
                web_search_indicators = [
                    'web araştırması sonucunda',
                    'güncel web kaynaklarından',
                    'web search',
                    'internet araştırması'
                ]
                
                has_web_search = any(indicator in ai_response.lower() for indicator in web_search_indicators)
                
                if not has_web_search:
                    print("   ✅ PASSED: No web search triggered (AnythingLLM used)")
                    successful_tests += 1
                    
                    # Check for reasonable response time (AnythingLLM should be faster)
                    if response_time < 15:
                        print("   ✅ PASSED: Fast response time (AnythingLLM direct)")
                    else:
                        print(f"   ⚠️  WARNING: Slow response ({response_time:.2f}s)")
                else:
                    print("   ❌ FAILED: Web search was triggered unnecessarily")
                    print(f"   Web indicators found: {[ind for ind in web_search_indicators if ind in ai_response.lower()]}")
            
            time.sleep(2)  # Brief pause between tests
        
        if successful_tests >= len(knowledge_questions) * 0.8:  # 80% success rate
            self.anythingllm_tests_passed += 1
            print(f"✅ PASSED: AnythingLLM knowledge test ({successful_tests}/{len(knowledge_questions)} successful)")
            return True
        else:
            print(f"❌ FAILED: AnythingLLM knowledge test ({successful_tests}/{len(knowledge_questions)} successful)")
            return False

    def test_anythingllm_inadequate_triggers_web_search(self):
        """Test Scenario 2: AnythingLLM Inadequate Response (Should trigger web search)"""
        print("\n🧪 IMPROVED ANYTHINGLLM TEST 2: Inadequate Response Detection")
        
        conv_id = self.create_test_conversation("AnythingLLM Inadequate Test")
        if not conv_id:
            return False
        
        self.anythingllm_tests_run += 1
        
        # Test questions that might make AnythingLLM give weak responses
        inadequate_questions = [
            "2024 yılının en son teknoloji haberleri nelerdir?",
            "Bugün Türkiye'de olan en önemli gelişmeler neler?",
            "Son çıkan iPhone modelinin özellikleri nelerdir?",
            "Güncel kripto para fiyatları nasıl?",
            "Bu hafta çıkan yeni filmler hangileri?"
        ]
        
        successful_tests = 0
        
        for question in inadequate_questions:
            print(f"   Testing potentially inadequate question: '{question}'")
            
            start_time = time.time()
            success, response = self.run_test(
                f"Inadequate Question: '{question}'",
                "POST",
                f"conversations/{conv_id}/messages",
                200,
                data={"content": question, "mode": "chat"}
            )
            response_time = time.time() - start_time
            
            if success:
                ai_response = response.get('content', '')
                print(f"   Response Time: {response_time:.2f} seconds")
                print(f"   AI Response: {ai_response[:150]}...")
                
                # Check if web search was triggered OR AnythingLLM gave adequate response
                web_search_indicators = [
                    'web araştırması sonucunda',
                    'güncel web kaynaklarından',
                    'internet araştırması'
                ]
                
                inadequate_indicators = [
                    'bilmiyorum',
                    'emin değilim', 
                    'kesin bilgi veremem',
                    'güncel bilgiye erişemiyorum',
                    'sorry',
                    'technical difficulties'
                ]
                
                has_web_search = any(indicator in ai_response.lower() for indicator in web_search_indicators)
                has_inadequate_response = any(indicator in ai_response.lower() for indicator in inadequate_indicators)
                
                if has_web_search:
                    print("   ✅ PASSED: Web search triggered due to inadequate AnythingLLM response")
                    successful_tests += 1
                elif not has_inadequate_response and len(ai_response.strip()) > 50:
                    print("   ✅ PASSED: AnythingLLM provided adequate response (no web search needed)")
                    successful_tests += 1
                else:
                    print("   ❌ FAILED: AnythingLLM gave inadequate response but web search not triggered")
                    print(f"   Inadequate indicators: {[ind for ind in inadequate_indicators if ind in ai_response.lower()]}")
            
            time.sleep(2)
        
        if successful_tests >= len(inadequate_questions) * 0.6:  # 60% success rate
            self.anythingllm_tests_passed += 1
            print(f"✅ PASSED: Inadequate response detection ({successful_tests}/{len(inadequate_questions)} successful)")
            return True
        else:
            print(f"❌ FAILED: Inadequate response detection ({successful_tests}/{len(inadequate_questions)} successful)")
            return False

    def test_image_upload_support(self):
        """Test Scenario 3: Image Upload Support (JPG, PNG, GIF, WEBP)"""
        print("\n🧪 IMAGE SUPPORT TEST 1: Image Upload Support")
        
        conv_id = self.create_test_conversation("Image Upload Test")
        if not conv_id:
            return False
        
        self.image_tests_run += 1
        
        # Test different image formats
        image_formats = ['jpg', 'png', 'gif', 'webp', 'bmp']
        successful_uploads = 0
        
        for img_format in image_formats:
            print(f"   Testing {img_format.upper()} upload...")
            
            # Create test image
            test_image_path = self.create_test_image(img_format)
            
            try:
                url = f"{self.base_url}/conversations/{conv_id}/upload"
                
                with open(test_image_path, 'rb') as file:
                    files = {'file': (f'test_image.{img_format}', file, f'image/{img_format}')}
                    response = requests.post(url, files=files, timeout=30)
                
                print(f"     Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    print(f"     ✅ {img_format.upper()} upload successful")
                    successful_uploads += 1
                    
                    try:
                        response_data = response.json()
                        if 'system_message' in response_data:
                            system_msg = response_data['system_message']
                            if '🖼️' in system_msg:
                                print(f"     ✅ Image icon (🖼️) found in system message")
                            else:
                                print(f"     ⚠️  WARNING: No image icon in system message")
                    except:
                        pass
                else:
                    print(f"     ❌ {img_format.upper()} upload failed: {response.status_code}")
                    
            except Exception as e:
                print(f"     ❌ {img_format.upper()} upload error: {str(e)}")
            finally:
                if os.path.exists(test_image_path):
                    os.remove(test_image_path)
            
            time.sleep(1)
        
        if successful_uploads >= len(image_formats) * 0.8:  # 80% success rate
            self.image_tests_passed += 1
            print(f"✅ PASSED: Image upload support ({successful_uploads}/{len(image_formats)} formats)")
            return True
        else:
            print(f"❌ FAILED: Image upload support ({successful_uploads}/{len(image_formats)} formats)")
            return False

    def test_chatgpt_vision_integration(self):
        """Test Scenario 4: ChatGPT Vision Integration"""
        print("\n🧪 IMAGE SUPPORT TEST 2: ChatGPT Vision Integration")
        
        conv_id = self.create_test_conversation("ChatGPT Vision Test")
        if not conv_id:
            return False
        
        self.image_tests_run += 1
        
        # First upload an image with text content
        print("   Step 1: Upload image with text content...")
        test_image_path = self.create_test_image("jpg", "text")
        
        try:
            url = f"{self.base_url}/conversations/{conv_id}/upload"
            
            with open(test_image_path, 'rb') as file:
                files = {'file': ('vision_test.jpg', file, 'image/jpeg')}
                upload_response = requests.post(url, files=files, timeout=30)
            
            if upload_response.status_code != 200:
                print("   ❌ Image upload failed")
                return False
            
            print("   ✅ Image uploaded successfully")
            
            # Test vision-related questions
            vision_questions = [
                "Bu görselde ne var?",
                "Görseldeki metni oku",
                "Bu resimde hangi renkler var?",
                "Görseli analiz et",
                "Bu fotoğrafta ne yazıyor?"
            ]
            
            successful_vision_tests = 0
            
            for question in vision_questions:
                print(f"   Testing vision question: '{question}'")
                
                start_time = time.time()
                success, response = self.run_test(
                    f"Vision Question: '{question}'",
                    "POST",
                    f"conversations/{conv_id}/messages",
                    200,
                    data={"content": question, "mode": "chat"}
                )
                response_time = time.time() - start_time
                
                if success:
                    ai_response = response.get('content', '')
                    print(f"     Response Time: {response_time:.2f} seconds")
                    print(f"     AI Response: {ai_response[:100]}...")
                    
                    # Check if ChatGPT Vision was used
                    vision_indicators = [
                        'görsel', 'resim', 'fotoğraf', 'image', 'metin',
                        'renk', 'yazı', 'içerik', 'analiz'
                    ]
                    
                    has_vision_response = any(indicator in ai_response.lower() for indicator in vision_indicators)
                    
                    if has_vision_response and len(ai_response.strip()) > 20:
                        print("     ✅ Vision API appears to be working")
                        successful_vision_tests += 1
                    else:
                        print("     ❌ Vision API response inadequate")
                
                time.sleep(2)
            
            if successful_vision_tests >= len(vision_questions) * 0.6:  # 60% success rate
                self.image_tests_passed += 1
                print(f"✅ PASSED: ChatGPT Vision integration ({successful_vision_tests}/{len(vision_questions)} successful)")
                return True
            else:
                print(f"❌ FAILED: ChatGPT Vision integration ({successful_vision_tests}/{len(vision_questions)} successful)")
                return False
                
        except Exception as e:
            print(f"❌ FAILED: ChatGPT Vision test error: {str(e)}")
            return False
        finally:
            if os.path.exists(test_image_path):
                os.remove(test_image_path)

    def test_file_visibility_in_chat(self):
        """Test Scenario 5: File Visibility (PDF and photos should be visible in chat)"""
        print("\n🧪 IMAGE SUPPORT TEST 3: File Visibility in Chat")
        
        conv_id = self.create_test_conversation("File Visibility Test")
        if not conv_id:
            return False
        
        self.image_tests_run += 1
        
        # Test file visibility workflow
        print("   Step 1: Upload PDF file...")
        
        # Create a test PDF-like file
        temp_pdf = tempfile.NamedTemporaryFile(mode='w', suffix='.pdf', delete=False, encoding='utf-8')
        temp_pdf.write("Test PDF content for visibility test")
        temp_pdf.close()
        
        try:
            url = f"{self.base_url}/conversations/{conv_id}/upload"
            
            # Upload PDF
            with open(temp_pdf.name, 'rb') as file:
                files = {'file': ('visibility_test.pdf', file, 'application/pdf')}
                pdf_response = requests.post(url, files=files, timeout=30)
            
            if pdf_response.status_code != 200:
                print("   ❌ PDF upload failed")
                return False
            
            print("   ✅ PDF uploaded successfully")
            
            # Check PDF system message
            try:
                pdf_data = pdf_response.json()
                if 'system_message' in pdf_data:
                    system_msg = pdf_data['system_message']
                    if '📎' in system_msg:
                        print("   ✅ PDF icon (📎) found in system message")
                    else:
                        print("   ⚠️  WARNING: No PDF icon in system message")
            except:
                pass
            
            # Step 2: Upload image file
            print("   Step 2: Upload image file...")
            test_image_path = self.create_test_image("jpg")
            
            with open(test_image_path, 'rb') as file:
                files = {'file': ('visibility_image.jpg', file, 'image/jpeg')}
                img_response = requests.post(url, files=files, timeout=30)
            
            if img_response.status_code != 200:
                print("   ❌ Image upload failed")
                return False
            
            print("   ✅ Image uploaded successfully")
            
            # Check image system message
            try:
                img_data = img_response.json()
                if 'system_message' in img_data:
                    system_msg = img_data['system_message']
                    if '🖼️' in system_msg:
                        print("   ✅ Image icon (🖼️) found in system message")
                    else:
                        print("   ⚠️  WARNING: No image icon in system message")
            except:
                pass
            
            # Step 3: Check file list endpoint
            print("   Step 3: Check file list...")
            success, file_list = self.run_test(
                "Get File List",
                "GET",
                f"conversations/{conv_id}/files",
                200
            )
            
            if success and isinstance(file_list, list):
                print(f"   ✅ File list retrieved: {len(file_list)} files")
                
                # Check if both files are listed
                pdf_found = any('pdf' in str(f).lower() for f in file_list)
                img_found = any('jpg' in str(f).lower() or 'image' in str(f).lower() for f in file_list)
                
                if pdf_found and img_found:
                    print("   ✅ Both PDF and image files found in list")
                else:
                    print(f"   ⚠️  WARNING: Files missing - PDF: {pdf_found}, Image: {img_found}")
            
            # Step 4: Test file visibility in conversation
            print("   Step 4: Test conversation with uploaded files...")
            success, response = self.run_test(
                "Ask about uploaded files",
                "POST",
                f"conversations/{conv_id}/messages",
                200,
                data={"content": "Hangi dosyalar yüklendi?", "mode": "chat"}
            )
            
            if success:
                ai_response = response.get('content', '')
                file_references = ['pdf', 'jpg', 'dosya', 'görsel', 'belge']
                has_file_references = any(ref in ai_response.lower() for ref in file_references)
                
                if has_file_references:
                    print("   ✅ AI response references uploaded files")
                    self.image_tests_passed += 1
                    return True
                else:
                    print("   ❌ AI response doesn't reference uploaded files")
                    return False
            
            return False
            
        except Exception as e:
            print(f"❌ FAILED: File visibility test error: {str(e)}")
            return False
        finally:
            if os.path.exists(temp_pdf.name):
                os.remove(temp_pdf.name)
            if 'test_image_path' in locals() and os.path.exists(test_image_path):
                os.remove(test_image_path)

    def run_improved_system_tests(self):
        """Run all improved system tests"""
        print("\n" + "="*80)
        print("🚀 STARTING IMPROVED SYSTEM TESTS")
        print("Testing IMPROVED AnythingLLM evaluation and NEW image support:")
        print("1. Improved AnythingLLM Evaluation - Better decision making")
        print("2. Image Upload Support - JPG, PNG, GIF, BMP, WEBP")
        print("3. ChatGPT Vision API - Image analysis capabilities")
        print("4. File Visibility - PDF and photos visible in chat")
        print("="*80)
        
        # AnythingLLM improvement tests
        anythingllm_tests = [
            self.test_anythingllm_knowledge_no_web_search,
            self.test_anythingllm_inadequate_triggers_web_search
        ]
        
        # Image support tests
        image_tests = [
            self.test_image_upload_support,
            self.test_chatgpt_vision_integration,
            self.test_file_visibility_in_chat
        ]
        
        print("\n📚 RUNNING ANYTHINGLLM IMPROVEMENT TESTS...")
        for test in anythingllm_tests:
            try:
                test()
                time.sleep(3)  # Pause between tests
            except Exception as e:
                print(f"❌ AnythingLLM test failed with exception: {e}")
        
        print("\n🖼️ RUNNING IMAGE SUPPORT TESTS...")
        for test in image_tests:
            try:
                test()
                time.sleep(3)  # Pause between tests
            except Exception as e:
                print(f"❌ Image test failed with exception: {e}")
        
        # Print results
        print("\n" + "="*80)
        print("📊 IMPROVED SYSTEM TEST RESULTS:")
        print(f"📚 AnythingLLM Tests: {self.anythingllm_tests_passed}/{self.anythingllm_tests_run} passed")
        print(f"🖼️ Image Support Tests: {self.image_tests_passed}/{self.image_tests_run} passed")
        print(f"🎯 Overall Tests: {self.tests_passed}/{self.tests_run} passed")
        
        # Detailed analysis
        if self.anythingllm_tests_passed == self.anythingllm_tests_run:
            print("✅ AnythingLLM evaluation improvements working perfectly!")
        else:
            print("❌ AnythingLLM evaluation needs attention")
        
        if self.image_tests_passed == self.image_tests_run:
            print("✅ Image support features working perfectly!")
        else:
            print("❌ Image support features need attention")
        
        total_feature_tests = self.anythingllm_tests_run + self.image_tests_run
        total_feature_passed = self.anythingllm_tests_passed + self.image_tests_passed
        
        success_rate = (total_feature_passed / total_feature_tests * 100) if total_feature_tests > 0 else 0
        print(f"🎯 Feature Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # 80% success rate required

def main():
    print("🔥 IMPROVED BILGIN AI SYSTEM TESTER")
    print("Testing improved AnythingLLM evaluation and new image support features")
    print("="*80)
    
    tester = ImprovedSystemTester()
    
    try:
        success = tester.run_improved_system_tests()
        
        if success:
            print("\n🎉 IMPROVED SYSTEM TESTS COMPLETED SUCCESSFULLY!")
            print("✅ AnythingLLM evaluation improvements verified")
            print("✅ Image support features verified")
            sys.exit(0)
        else:
            print("\n❌ IMPROVED SYSTEM TESTS FAILED!")
            print("Some features need attention")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Tests failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()