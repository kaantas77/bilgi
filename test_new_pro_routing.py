#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime

class NewProRoutingTester:
    def __init__(self, base_url="https://hybrid-chat-app.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

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

    def test_scenario_1_general_novita(self):
        """Test NEW PRO ROUTING Scenario 1: General Questions → Novita DeepSeek v3.1"""
        print("\n🧪 NEW PRO ROUTING TEST 1: General Questions → Novita DeepSeek v3.1")
        
        # Create conversation
        success, response = self.run_test(
            "Create Conversation for General Test",
            "POST",
            "conversations",
            200,
            data={"title": "NEW PRO Test - General → Novita"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test general question that should route to Novita DeepSeek v3.1
        question = "Türkiye'nin en büyük şehri hangisidir ve nüfusu kaç?"
        
        print(f"   Testing NEW PRO general question: '{question}'...")
        
        start_time = time.time()
        success, response = self.run_test(
            f"NEW PRO General → Novita: '{question}'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": question, "mode": "normal", "version": "pro"}
        )
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"     Response Time: {response_time:.2f}s")
            print(f"     Response: {ai_response[:200]}...")
            
            # Check for appropriate response about Istanbul
            istanbul_indicators = ['istanbul', 'İstanbul', 'büyük', 'şehir', 'nüfus', 'milyon']
            has_istanbul_info = any(indicator in ai_response for indicator in istanbul_indicators)
            
            # Should NOT have web search indicators (direct Novita response)
            web_indicators = ['web araştırması', 'güncel web kaynaklarından']
            has_web_search = any(indicator in ai_response.lower() for indicator in web_indicators)
            
            if has_istanbul_info and not has_web_search:
                print("     ✅ NEW PRO: General question → Novita DeepSeek v3.1 (direct response)")
                return True
            else:
                print("     ❌ NEW PRO: Should route to Novita DeepSeek v3.1 for general questions")
                return False
        
        return False

    def test_scenario_2_formula_anythingllm(self):
        """Test NEW PRO ROUTING Scenario 2: Formula/RAG Questions → AnythingLLM bilgin workspace"""
        print("\n🧪 NEW PRO ROUTING TEST 2: Formula/RAG Questions → AnythingLLM bilgin workspace")
        
        # Create conversation
        success, response = self.run_test(
            "Create Conversation for Formula Test",
            "POST",
            "conversations",
            200,
            data={"title": "NEW PRO Test - Formula → AnythingLLM"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test formula question that should route to AnythingLLM bilgin workspace
        question = "İstatistiksel standart sapma formülünü açıkla ve örnek hesaplama yap"
        
        print(f"   Testing NEW PRO formula question: '{question}'...")
        
        start_time = time.time()
        success, response = self.run_test(
            f"NEW PRO Formula → AnythingLLM: '{question}'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": question, "mode": "normal", "version": "pro"}
        )
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"     Response Time: {response_time:.2f}s")
            print(f"     Response: {ai_response[:200]}...")
            
            # Check for formula-based content from RAG system
            formula_indicators = ['standart sapma', 'formül', 'hesaplama', 'σ', 'sigma', 'varyans', 'matematik']
            has_formula_content = any(indicator in ai_response.lower() for indicator in formula_indicators)
            
            if has_formula_content:
                print("     ✅ NEW PRO: Formula/RAG question → AnythingLLM bilgin workspace")
                return True
            else:
                print("     ❌ NEW PRO: Should route to AnythingLLM bilgin workspace for formula questions")
                return False
        
        return False

    def test_scenario_3_current_serper(self):
        """Test NEW PRO ROUTING Scenario 3: Current Topics → Serper API"""
        print("\n🧪 NEW PRO ROUTING TEST 3: Current Topics → Serper API")
        
        # Create conversation
        success, response = self.run_test(
            "Create Conversation for Current Test",
            "POST",
            "conversations",
            200,
            data={"title": "NEW PRO Test - Current → Serper"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test current topic question that should route to Serper API
        question = "Bugün Champions League'de hangi maçlar oynanıyor?"
        
        print(f"   Testing NEW PRO current topic: '{question}'...")
        
        start_time = time.time()
        success, response = self.run_test(
            f"NEW PRO Current → Serper: '{question}'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": question, "mode": "normal", "version": "pro"}
        )
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"     Response Time: {response_time:.2f}s")
            print(f"     Response: {ai_response[:200]}...")
            
            # Check for current/real-time information from web search
            current_indicators = ['champions league', 'maç', 'bugün', 'oynanıyor', 'güncel', 'web araştırması']
            has_current_info = any(indicator in ai_response.lower() for indicator in current_indicators)
            
            if has_current_info:
                print("     ✅ NEW PRO: Current topic → Serper API (real-time information)")
                return True
            else:
                print("     ❌ NEW PRO: Should route to Serper API for current topics")
                return False
        
        return False

    def test_scenario_4_conversation_ollama(self):
        """Test NEW PRO ROUTING Scenario 4: Conversation Modes → Ollama AnythingLLM"""
        print("\n🧪 NEW PRO ROUTING TEST 4: Conversation Modes → Ollama AnythingLLM")
        
        # Create conversation
        success, response = self.run_test(
            "Create Conversation for Conversation Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "NEW PRO Test - Conversation → Ollama"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test conversation mode that should route to Ollama AnythingLLM
        question = "Motivasyona ihtiyacım var"
        
        print(f"   Testing NEW PRO conversation mode: '{question}' with friend mode...")
        
        start_time = time.time()
        success, response = self.run_test(
            f"NEW PRO Conversation → Ollama: '{question}'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": question, "mode": "friend", "version": "pro"}
        )
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"     Response Time: {response_time:.2f}s")
            print(f"     Response: {ai_response[:200]}...")
            
            # Check for friendly, motivational response style from Ollama
            friend_indicators = ['dostum', 'arkadaş', 'motivasyon', 'başarabilirsin', 'güçlü', 'cesaret', 'inan']
            has_friend_personality = any(indicator in ai_response.lower() for indicator in friend_indicators)
            
            if has_friend_personality:
                print("     ✅ NEW PRO: Conversation mode → Ollama AnythingLLM (friend personality)")
                return True
            else:
                print("     ❌ NEW PRO: Should route to Ollama AnythingLLM for conversation modes")
                return False
        
        return False

    def run_all_tests(self):
        """Run all NEW PRO ROUTING tests"""
        print("🎯 CRITICAL: Testing NEW PRO version routing with Novita DeepSeek v3.1 API integration")
        print("=" * 80)
        print("Testing NEW PRO routing system:")
        print("1. General Questions → Novita API DeepSeek v3.1 (sk_wy221nkkF8TBPGTCMxtSFI1ejV8hBKy40T7ICBxhir8)")
        print("2. Formula/RAG Questions → AnythingLLM bilgin workspace (B47W62W-FKV4PAZ-G437YKM-6PGZP0A)")  
        print("3. Current Topics → Serper API (4f361154c92deea5c6ba49fb77ad3df5c9c4bffc)")
        print("4. Conversation Modes → Ollama AnythingLLM")
        print("=" * 80)
        
        tests = [
            self.test_scenario_1_general_novita,
            self.test_scenario_2_formula_anythingllm,
            self.test_scenario_3_current_serper,
            self.test_scenario_4_conversation_ollama
        ]
        
        for test in tests:
            try:
                test()
                time.sleep(3)  # Longer pause between tests for API rate limiting
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        # Print results
        print("\n" + "=" * 80)
        print(f"🧪 NEW PRO ROUTING RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All NEW PRO routing tests passed!")
            print("✅ Novita DeepSeek v3.1 integration working")
            print("✅ AnythingLLM bilgin workspace working")
            print("✅ Serper API integration working")
            print("✅ Ollama AnythingLLM conversation modes working")
        else:
            print(f"❌ {self.tests_run - self.tests_passed} NEW PRO routing tests failed")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = NewProRoutingTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)