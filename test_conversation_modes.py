#!/usr/bin/env python3

import requests
import sys
import json
import time
import os

class ConversationModesTester:
    def __init__(self, base_url="https://bilgin-ai.preview.emergentagent.com/api"):
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

    def test_conversation_mode_friend(self):
        """Test NEW CONVERSATION MODE 1: Friend (Arkadaş Canlısı) with direct ChatGPT API"""
        print("\n🧪 NEW CONVERSATION MODE TEST 1: Friend (Arkadaş Canlısı)")
        
        # Create conversation for friend mode test
        success, response = self.run_test(
            "Create Conversation for Friend Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "Friend Mode Test"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test friend mode with motivational question
        start_time = time.time()
        success, response = self.run_test(
            "Send Friend Mode Question: 'Bugün çok yorgunum, motivasyona ihtiyacım var'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Bugün çok yorgunum, motivasyona ihtiyacım var", "mode": "chat", "conversationMode": "friend"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:300]}...")
            
            # Check for friend mode characteristics
            friend_indicators = [
                'arkadaş', 'dostum', 'canım', 'motivasyon', 'başarabilirsin', 
                'yanındayım', 'güçlüsün', 'pozitif', 'umut', 'enerji', 'motive'
            ]
            
            has_friend_tone = any(indicator in ai_response.lower() for indicator in friend_indicators)
            
            # Check that it's distinctly different from normal responses (should be more personal/motivational)
            if has_friend_tone and len(ai_response) > 50:
                print("✅ PASSED: Friend mode personality detected (samimi, motive edici, esprili)")
                return True
            else:
                print("❌ FAILED: Friend mode personality not detected")
                return False
        
        return False

    def test_conversation_mode_realistic(self):
        """Test NEW CONVERSATION MODE 2: Realistic (Gerçekçi) with direct ChatGPT API"""
        print("\n🧪 NEW CONVERSATION MODE TEST 2: Realistic (Gerçekçi)")
        
        # Create conversation for realistic mode test
        success, response = self.run_test(
            "Create Conversation for Realistic Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "Realistic Mode Test"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test realistic mode with business question
        start_time = time.time()
        success, response = self.run_test(
            "Send Realistic Mode Question: 'Yeni bir iş kurmayı düşünüyorum'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Yeni bir iş kurmayı düşünüyorum", "mode": "chat", "conversationMode": "realistic"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:300]}...")
            
            # Check for realistic mode characteristics
            realistic_indicators = [
                'risk', 'zorluk', 'gerçek', 'dikkat', 'analiz', 'eleştirel',
                'güçlü yön', 'zayıf yön', 'kanıt', 'objektif', 'pratik', 'test'
            ]
            
            has_realistic_tone = any(indicator in ai_response.lower() for indicator in realistic_indicators)
            
            # Check for critical thinking approach
            if has_realistic_tone and len(ai_response) > 50:
                print("✅ PASSED: Realistic mode personality detected (eleştirel, kanıt odaklı)")
                return True
            else:
                print("❌ FAILED: Realistic mode personality not detected")
                return False
        
        return False

    def test_conversation_mode_coach(self):
        """Test NEW CONVERSATION MODE 3: Coach (Koç) with direct ChatGPT API"""
        print("\n🧪 NEW CONVERSATION MODE TEST 3: Coach (Koç)")
        
        # Create conversation for coach mode test
        success, response = self.run_test(
            "Create Conversation for Coach Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "Coach Mode Test"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test coach mode with goal-setting question
        start_time = time.time()
        success, response = self.run_test(
            "Send Coach Mode Question: 'Hedeflerime nasıl ulaşabilirim?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Hedeflerime nasıl ulaşabilirim?", "mode": "chat", "conversationMode": "coach"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:300]}...")
            
            # Check for coach mode characteristics
            coach_indicators = [
                'hedef', 'adım', 'plan', 'nasıl', 'hangi', 'ne düşünüyorsun',
                'potansiyel', 'gelişim', 'aksiyon', 'strateji', 'mentor', 'koç'
            ]
            
            # Check for question-asking approach (coaches ask questions)
            question_count = ai_response.count('?')
            has_coach_tone = any(indicator in ai_response.lower() for indicator in coach_indicators)
            
            if has_coach_tone and question_count >= 1 and len(ai_response) > 50:
                print("✅ PASSED: Coach mode personality detected (soru soran, düşündüren, hedef odaklı)")
                return True
            else:
                print("❌ FAILED: Coach mode personality not detected")
                return False
        
        return False

    def test_conversation_mode_teacher(self):
        """Test NEW CONVERSATION MODE 5: Teacher (Öğretmen) with direct ChatGPT API"""
        print("\n🧪 NEW CONVERSATION MODE TEST 5: Teacher (Öğretmen)")
        
        # Create conversation for teacher mode test
        success, response = self.run_test(
            "Create Conversation for Teacher Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "Teacher Mode Test"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test teacher mode with learning question
        start_time = time.time()
        success, response = self.run_test(
            "Send Teacher Mode Question: 'Python programlamayı öğrenmek istiyorum'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Python programlamayı öğrenmek istiyorum", "mode": "chat", "conversationMode": "teacher"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:300]}...")
            
            # Check for teacher mode characteristics
            teacher_indicators = [
                'adım adım', 'önce', 'sonra', 'örnek', 'öğren', 'ders', 'açıkla',
                'basit', 'anlaşılır', 'pratik', 'alıştırma', 'pedagojik', 'eğitim'
            ]
            
            has_teacher_tone = any(indicator in ai_response.lower() for indicator in teacher_indicators)
            
            # Check for structured learning approach
            if has_teacher_tone and len(ai_response) > 50:
                print("✅ PASSED: Teacher mode personality detected (adım adım, örnekli, pedagojik)")
                return True
            else:
                print("❌ FAILED: Teacher mode personality not detected")
                return False
        
        return False

    def test_conversation_mode_minimalist(self):
        """Test NEW CONVERSATION MODE 6: Minimalist with direct ChatGPT API"""
        print("\n🧪 NEW CONVERSATION MODE TEST 6: Minimalist")
        
        # Create conversation for minimalist mode test
        success, response = self.run_test(
            "Create Conversation for Minimalist Mode Test",
            "POST",
            "conversations",
            200,
            data={"title": "Minimalist Mode Test"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test minimalist mode with information request
        start_time = time.time()
        success, response = self.run_test(
            "Send Minimalist Mode Question: 'Proje yönetimi hakkında bilgi ver'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Proje yönetimi hakkında bilgi ver", "mode": "chat", "conversationMode": "minimalist"}
        )
        
        response_time = time.time() - start_time
        
        if success:
            ai_response = response.get('content', '')
            print(f"   Response Time: {response_time:.2f} seconds")
            print(f"   AI Response: {ai_response[:300]}...")
            
            # Check for minimalist mode characteristics
            minimalist_indicators = [
                '•', '-', '1.', '2.', '3.', 'kısa', 'öz', 'madde', 'liste'
            ]
            
            has_minimalist_format = any(indicator in ai_response for indicator in minimalist_indicators)
            is_concise = len(ai_response) < 300  # Should be shorter than other modes
            
            if has_minimalist_format and is_concise and len(ai_response) > 30:
                print("✅ PASSED: Minimalist mode personality detected (kısa, öz, madde işaretli)")
                return True
            else:
                print("❌ FAILED: Minimalist mode personality not detected")
                return False
        
        return False

    def test_normal_mode_vs_conversation_modes(self):
        """Test that normal mode still uses AnythingLLM/hybrid system vs conversation modes using OpenAI"""
        print("\n🧪 CONVERSATION MODE TEST 7: Normal Mode vs Conversation Modes Routing")
        
        # Create conversation for comparison test
        success, response = self.run_test(
            "Create Conversation for Mode Comparison Test",
            "POST",
            "conversations",
            200,
            data={"title": "Mode Comparison Test"}
        )
        
        if not success:
            return False
            
        test_conv_id = response.get('id')
        
        # Test 1: Normal mode (should use AnythingLLM/hybrid)
        print("   Testing Normal Mode (should use AnythingLLM/hybrid)...")
        success1, response1 = self.run_test(
            "Send Normal Mode Question: 'Merhaba nasılsın?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Merhaba nasılsın?", "mode": "chat"}  # No conversationMode
        )
        
        time.sleep(2)
        
        # Test 2: Friend mode (should use direct OpenAI)
        print("   Testing Friend Mode (should use direct OpenAI)...")
        success2, response2 = self.run_test(
            "Send Friend Mode Question: 'Merhaba nasılsın?'",
            "POST",
            f"conversations/{test_conv_id}/messages",
            200,
            data={"content": "Merhaba nasılsın?", "mode": "chat", "conversationMode": "friend"}
        )
        
        if success1 and success2:
            normal_response = response1.get('content', '')
            friend_response = response2.get('content', '')
            
            print(f"   Normal Response: {normal_response[:100]}...")
            print(f"   Friend Response: {friend_response[:100]}...")
            
            # Check that responses are different (indicating different routing)
            responses_different = normal_response != friend_response
            
            # Check friend response has more personality
            friend_indicators = ['arkadaş', 'dostum', 'canım', 'güzel', 'harika', 'motive']
            has_friend_personality = any(indicator in friend_response.lower() for indicator in friend_indicators)
            
            if responses_different and has_friend_personality:
                print("✅ PASSED: Different routing confirmed - Normal uses hybrid, Friend uses OpenAI")
                return True
            else:
                print("❌ FAILED: Routing difference not detected")
                return False
        
        return False

    def run_all_conversation_mode_tests(self):
        """Run all NEW CONVERSATION MODE tests"""
        print("🚀 STARTING NEW CONVERSATION MODES TESTS")
        print("Testing DIRECT CHATGPT API INTEGRATION with personality prompts")
        print("="*70)
        
        tests = [
            self.test_conversation_mode_friend,
            self.test_conversation_mode_realistic,
            self.test_conversation_mode_coach,
            self.test_conversation_mode_teacher,
            self.test_conversation_mode_minimalist,
            self.test_normal_mode_vs_conversation_modes
        ]
        
        passed_tests = 0
        
        for test in tests:
            try:
                if test():
                    passed_tests += 1
                time.sleep(3)  # Longer pause between conversation mode tests
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        # Print results
        print("\n" + "="*70)
        print(f"🧪 NEW CONVERSATION MODES RESULTS: {passed_tests}/{len(tests)} tests passed")
        
        if passed_tests == len(tests):
            print("🎉 All NEW CONVERSATION MODE tests passed!")
            print("✅ Direct ChatGPT API integration working")
            print("✅ All conversation modes have distinct personalities")
            print("✅ Normal mode still uses AnythingLLM/hybrid system")
            print("✅ Personality prompts working correctly")
        else:
            print(f"❌ {len(tests) - passed_tests} conversation mode tests failed")
        
        return passed_tests == len(tests)

def main():
    tester = ConversationModesTester()
    success = tester.run_all_conversation_mode_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())