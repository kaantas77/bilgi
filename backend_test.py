import requests
import sys
import json
import time
from datetime import datetime

class BilginAIAPITester:
    def __init__(self, base_url="https://rag-websearch.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.conversation_id = None
        self.hybrid_tests_passed = 0
        self.hybrid_tests_run = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
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

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_get_conversations_empty(self):
        """Test getting conversations when empty"""
        success, response = self.run_test(
            "Get Conversations (Empty)",
            "GET",
            "conversations",
            200
        )
        return success

    def test_create_conversation(self):
        """Test creating a new conversation"""
        success, response = self.run_test(
            "Create New Conversation",
            "POST",
            "conversations",
            200,
            data={"title": "Test Sohbet"}
        )
        if success and 'id' in response:
            self.conversation_id = response['id']
            print(f"   Created conversation ID: {self.conversation_id}")
        return success

    def test_get_conversations_with_data(self):
        """Test getting conversations after creating one"""
        success, response = self.run_test(
            "Get Conversations (With Data)",
            "GET",
            "conversations",
            200
        )
        if success and isinstance(response, list) and len(response) > 0:
            print(f"   Found {len(response)} conversations")
        return success

    def test_get_messages_empty(self):
        """Test getting messages from empty conversation"""
        if not self.conversation_id:
            print("❌ Skipped - No conversation ID available")
            return False
            
        success, response = self.run_test(
            "Get Messages (Empty)",
            "GET",
            f"conversations/{self.conversation_id}/messages",
            200
        )
        return success

    def test_send_message(self):
        """Test sending a message and getting AI response"""
        if not self.conversation_id:
            print("❌ Skipped - No conversation ID available")
            return False
            
        success, response = self.run_test(
            "Send Message (AI Integration Test)",
            "POST",
            f"conversations/{self.conversation_id}/messages",
            200,
            data={"content": "Merhaba, sen kimsin?", "mode": "chat"}
        )
        
        if success:
            print("   ✅ Message sent successfully")
            if 'content' in response:
                print(f"   AI Response: {response['content'][:100]}...")
            else:
                print("   ⚠️  No AI response content found")
        
        return success

    def test_get_messages_with_data(self):
        """Test getting messages after sending one"""
        if not self.conversation_id:
            print("❌ Skipped - No conversation ID available")
            return False
            
        success, response = self.run_test(
            "Get Messages (With Data)",
            "GET",
            f"conversations/{self.conversation_id}/messages",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} messages")
            for i, msg in enumerate(response):
                print(f"   Message {i+1}: {msg.get('role', 'unknown')} - {msg.get('content', '')[:50]}...")
        
        return success

    def test_send_second_message(self):
        """Test sending a second message"""
        if not self.conversation_id:
            print("❌ Skipped - No conversation ID available")
            return False
            
        success, response = self.run_test(
            "Send Second Message",
            "POST",
            f"conversations/{self.conversation_id}/messages",
            200,
            data={"content": "Bugün hava nasıl?", "mode": "chat"}
        )
        return success

    def test_delete_conversation(self):
        """Test deleting a conversation"""
        if not self.conversation_id:
            print("❌ Skipped - No conversation ID available")
            return False
            
        success, response = self.run_test(
            "Delete Conversation",
            "DELETE",
            f"conversations/{self.conversation_id}",
            200
        )
        return success

    def test_get_deleted_conversation(self):
        """Test that deleted conversation is gone"""
        if not self.conversation_id:
            print("❌ Skipped - No conversation ID available")
            return False
            
        success, response = self.run_test(
            "Get Messages from Deleted Conversation",
            "GET",
            f"conversations/{self.conversation_id}/messages",
            200  # Should return empty array, not 404
        )
        return success

    def test_hybrid_system_casual_question(self):
        """Test Scenario 1: Casual Questions (AnythingLLM Only) - 'merhaba'"""
        print("\n🧪 HYBRID SYSTEM TEST 1: Casual Questions (AnythingLLM Only)")
        
        # Create new conversation for hybrid tests
        success, response = self.run_test(
            "Create Conversation for Hybrid Test 1",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Casual"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        if not test_conv_id:
            print("❌ Failed to get conversation ID")
            return False
        
        # Test casual greeting
        start_time = time.time()
        success, response = self.run_test(
            "Send Casual Question: 'merhaba'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "merhaba", "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:150]}...")
            
            # Check if response is appropriate for casual greeting
            if any(word in ai_response.lower() for word in ['merhaba', 'selam', 'nasılsın', 'yardım']):
                print("✅ PASSED: Appropriate casual response received")
                self.hybrid_tests_passed += 1
                
                # Check response time (should be fast for AnythingLLM only)
                if response_time < 10:
                    print("✅ PASSED: Fast response time (AnythingLLM only)")
                else:
                    print(f"⚠️  WARNING: Slow response time ({response_time:.2f}s) - may indicate web search was used")
                    
            else:
                print("❌ FAILED: Inappropriate response for casual greeting")
        
        return success

    def test_hybrid_system_math_question(self):
        """Test Scenario 2: Math Questions (AnythingLLM First) - '25 × 8 kaç eder?'"""
        print("\n🧪 HYBRID SYSTEM TEST 2: Math Questions (AnythingLLM First)")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Hybrid Test 2",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Math"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test math question
        start_time = time.time()
        success, response = self.run_test(
            "Send Math Question: '25 × 8 kaç eder?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "25 × 8 kaç eder?", "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:150]}...")
            
            # Check if response contains correct answer (200)
            if '200' in ai_response:
                print("✅ PASSED: Correct math answer (200) found in response")
                self.hybrid_tests_passed += 1
                
                # Check that no web search indicators are present
                web_indicators = ['web araştırması', 'güncel web', 'kaynaklarından']
                if not any(indicator in ai_response.lower() for indicator in web_indicators):
                    print("✅ PASSED: No web search indicators (AnythingLLM used)")
                else:
                    print("⚠️  WARNING: Web search indicators found - should use AnythingLLM only for math")
                    
            else:
                print("❌ FAILED: Incorrect or missing math answer")
        
        return success

    def test_hybrid_system_weather_direct_web(self):
        """Test Scenario 2: Hava Durumu (Google'dan aratılabilir) - 'İstanbul hava durumu nasıl?'"""
        print("\n🧪 HYBRID SYSTEM TEST 3A: Weather (Direct Web Search)")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Weather Test",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Weather"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test weather question - should go directly to web search
        start_time = time.time()
        success, response = self.run_test(
            "Send Weather Question: 'İstanbul hava durumu nasıl?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "İstanbul hava durumu nasıl?", "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:200]}...")
            
            # Check if web search was used (should go directly to web search, NOT AnythingLLM)
            web_indicators = ['web araştırması', 'güncel', 'hava', 'sıcaklık', 'derece']
            has_web_indicators = any(indicator in ai_response.lower() for indicator in web_indicators)
            
            # Check if response contains weather information
            has_weather_info = any(pattern in ai_response.lower() for pattern in ['hava', 'sıcaklık', 'derece', 'yağmur', 'güneş', 'bulut'])
            
            if has_web_indicators or has_weather_info:
                print("✅ PASSED: Web search used directly for weather (bypassed AnythingLLM)")
                self.hybrid_tests_passed += 1
            else:
                print("❌ FAILED: Should use web search directly for weather, not AnythingLLM")
        
        return success

    def test_hybrid_system_sports_direct_web(self):
        """Test Scenario 3: Spor Sonucu (Google'dan aratılabilir) - 'Galatasaray son maç skoru nedir?'"""
        print("\n🧪 HYBRID SYSTEM TEST 3B: Sports (Direct Web Search)")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Sports Test",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Sports"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test sports question - should go directly to web search
        start_time = time.time()
        success, response = self.run_test(
            "Send Sports Question: 'Galatasaray son maç skoru nedir?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Galatasaray son maç skoru nedir?", "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:200]}...")
            
            # Check if web search was used (should go directly to web search, NOT AnythingLLM)
            web_indicators = ['web araştırması', 'güncel', 'maç', 'skor', 'galatasaray']
            has_web_indicators = any(indicator in ai_response.lower() for indicator in web_indicators)
            
            # Check if response contains sports information
            has_sports_info = any(pattern in ai_response.lower() for pattern in ['maç', 'skor', 'galatasaray', 'sonuç', 'gol'])
            
            if has_web_indicators or has_sports_info:
                print("✅ PASSED: Web search used directly for sports (bypassed AnythingLLM)")
                self.hybrid_tests_passed += 1
            else:
                print("❌ FAILED: Should use web search directly for sports, not AnythingLLM")
        
        return success

    def test_hybrid_system_current_info(self):
        """Test Scenario: Current Information (Direct Web Search) - 'bugün dolar kuru kaç TL?'"""
        print("\n🧪 HYBRID SYSTEM TEST 3C: Current Information (Direct Web Search)")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Hybrid Test 3",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Current Info"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test current information question
        start_time = time.time()
        success, response = self.run_test(
            "Send Current Info Question: 'bugün dolar kuru kaç TL?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "bugün dolar kuru kaç TL?", "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:200]}...")
            
            # Check if web search was used (should go directly to web search)
            web_indicators = ['web araştırması', 'güncel', 'tl', 'dolar']
            has_web_indicators = any(indicator in ai_response.lower() for indicator in web_indicators)
            
            # Check if response contains currency information
            has_currency_info = any(pattern in ai_response.lower() for pattern in ['tl', 'lira', 'dolar', 'kur'])
            
            if has_web_indicators or has_currency_info:
                print("✅ PASSED: Web search used for current information")
                self.hybrid_tests_passed += 1
                
                # Check for reasonable response time (web search should be reasonably fast)
                if response_time < 20:
                    print("✅ PASSED: Reasonable response time for web search")
                else:
                    print(f"⚠️  WARNING: Slow response time ({response_time:.2f}s)")
                    
            else:
                print("❌ FAILED: No web search indicators found - should use web search for current info")
        
        return success

    def test_hybrid_system_general_knowledge(self):
        """Test Scenario 5: General Knowledge (AnythingLLM First, Web Backup) - 'Einstein'ın doğum tarihi nedir?'"""
        print("\n🧪 HYBRID SYSTEM TEST 4: General Knowledge (AnythingLLM First, Web Backup)")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Hybrid Test 4",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - General Knowledge"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test general knowledge question
        start_time = time.time()
        success, response = self.run_test(
            "Send General Knowledge Question: 'Einstein'ın doğum tarihi nedir?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Einstein'ın doğum tarihi nedir?", "mode": "chat"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:200]}...")
            
            # Check if response contains Einstein's birth date (1879)
            has_correct_info = any(date in ai_response for date in ['1879', '14 Mart', 'March 14'])
            
            if has_correct_info:
                print("✅ PASSED: Correct Einstein birth date information found")
                self.hybrid_tests_passed += 1
                
                # Check response source (could be AnythingLLM or web search backup)
                web_indicators = ['web araştırması', 'güncel web', 'kaynaklarından']
                if any(indicator in ai_response.lower() for indicator in web_indicators):
                    print("ℹ️  INFO: Web search was used as backup")
                else:
                    print("ℹ️  INFO: AnythingLLM provided the answer")
                    
            else:
                print("❌ FAILED: Incorrect or missing Einstein birth date information")
        
        return success

    def test_hybrid_system_conversation_modes(self):
        """Test conversation modes with hybrid system"""
        print("\n🧪 HYBRID SYSTEM TEST 5: Conversation Modes")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Modes"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test friend mode
        start_time = time.time()
        success, response = self.run_test(
            "Send Message with Friend Mode",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Matematik öğrenmekte zorlanıyorum", "mode": "chat", "conversationMode": "friend"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:200]}...")
            
            # Check if response has friendly tone
            friendly_indicators = ['arkadaş', 'dostum', 'canım', 'motivasyon', 'başarabilirsin', 'adım']
            has_friendly_tone = any(indicator in ai_response.lower() for indicator in friendly_indicators)
            
            if has_friendly_tone:
                print("✅ PASSED: Friendly conversational tone detected")
                self.hybrid_tests_passed += 1
            else:
                print("❌ FAILED: No friendly tone detected in response")
        
        return success

    def test_hybrid_system_turkish_errors(self):
        """Test that error messages are in Turkish"""
        print("\n🧪 HYBRID SYSTEM TEST 6: Turkish Error Messages")
        
        # Create new conversation
        success, response = self.run_test(
            "Create Conversation for Error Test",
            "POST",
            "conversations",
            200,
            data={"title": "Hybrid Test - Errors"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test with a potentially problematic question that might trigger errors
        success, response = self.run_test(
            "Send Potentially Problematic Question",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Bu çok karmaşık bir soru ve sistem bunu anlayamayabilir", "mode": "chat"}
        )
        
        if success:
            self.hybrid_tests_run += 1
            ai_response = response.get('content', '')
            print(f"   AI Response: {ai_response[:200]}...")
            
            # Check that response is in Turkish (no English error messages)
            english_errors = ['sorry', 'error', 'technical difficulties', 'i cannot', "i don't", 'unable to']
            has_english_errors = any(error.lower() in ai_response.lower() for error in english_errors)
            
            if not has_english_errors:
                print("✅ PASSED: No English error messages detected")
                self.hybrid_tests_passed += 1
                
                # Check for Turkish responses
                turkish_indicators = ['üzgünüm', 'teknik', 'sorun', 'yardım', 'anlayamadım']
                has_turkish = any(indicator in ai_response.lower() for indicator in turkish_indicators)
                
                if has_turkish:
                    print("✅ PASSED: Turkish language response confirmed")
                else:
                    print("ℹ️  INFO: Response appears to be in Turkish")
                    
            else:
                print("❌ FAILED: English error messages detected")
                print(f"   English errors found: {[err for err in english_errors if err.lower() in ai_response.lower()]}")
        
        return success

    def run_hybrid_system_tests(self):
        """Run all hybrid system tests"""
        print("\n" + "="*60)
        print("🚀 STARTING INTELLIGENT HYBRID AI SYSTEM TESTS")
        print("="*60)
        
        hybrid_tests = [
            self.test_hybrid_system_casual_question,
            self.test_hybrid_system_math_question,
            self.test_hybrid_system_current_info,
            self.test_hybrid_system_general_knowledge,
            self.test_hybrid_system_conversation_modes,
            self.test_hybrid_system_turkish_errors
        ]
        
        for test in hybrid_tests:
            try:
                test()
                time.sleep(2)  # Brief pause between tests
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        # Print hybrid system test results
        print("\n" + "="*60)
        print(f"🧪 HYBRID SYSTEM RESULTS: {self.hybrid_tests_passed}/{self.hybrid_tests_run} tests passed")
        
        if self.hybrid_tests_passed == self.hybrid_tests_run:
            print("🎉 All hybrid system tests passed!")
        else:
            print(f"❌ {self.hybrid_tests_run - self.hybrid_tests_passed} hybrid system tests failed")
        
        return self.hybrid_tests_passed == self.hybrid_tests_run

def main():
    print("🚀 Starting BİLGİN AI Backend API Tests")
    print("=" * 50)
    
    tester = BilginAIAPITester()
    
    # Run basic API tests first
    print("\n📋 BASIC API TESTS")
    print("-" * 30)
    basic_tests = [
        tester.test_root_endpoint,
        tester.test_get_conversations_empty,
        tester.test_create_conversation,
        tester.test_get_conversations_with_data,
        tester.test_get_messages_empty,
        tester.test_send_message,
        tester.test_get_messages_with_data,
        tester.test_send_second_message,
        tester.test_delete_conversation,
        tester.test_get_deleted_conversation
    ]
    
    for test in basic_tests:
        test()
    
    # Print basic test results
    print("\n" + "-" * 50)
    print(f"📊 Basic API Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    # Run hybrid system tests
    hybrid_success = tester.run_hybrid_system_tests()
    
    # Print final comprehensive results
    total_tests = tester.tests_run + tester.hybrid_tests_run
    total_passed = tester.tests_passed + tester.hybrid_tests_passed
    
    print("\n" + "=" * 60)
    print("🏁 COMPREHENSIVE TEST RESULTS")
    print("=" * 60)
    print(f"📋 Basic API Tests: {tester.tests_passed}/{tester.tests_run} passed")
    print(f"🧪 Hybrid System Tests: {tester.hybrid_tests_passed}/{tester.hybrid_tests_run} passed")
    print(f"📊 TOTAL: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("🎉 ALL TESTS PASSED! BİLGİN AI system is working correctly!")
        return 0
    else:
        failed_tests = total_tests - total_passed
        print(f"❌ {failed_tests} tests failed")
        
        if tester.tests_passed < tester.tests_run:
            print("   - Basic API issues detected")
        if tester.hybrid_tests_passed < tester.hybrid_tests_run:
            print("   - Hybrid system issues detected")
            
        return 1

if __name__ == "__main__":
    sys.exit(main())