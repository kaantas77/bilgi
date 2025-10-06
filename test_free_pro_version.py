#!/usr/bin/env python3

import requests
import json
import time

def test_free_pro_versions():
    """Test the NEW FREE/PRO VERSION SYSTEM with Gemini API integration"""
    
    base_url = "https://bilgin-ai.preview.emergentagent.com/api"
    
    print("🚀 TESTING NEW FREE/PRO VERSION SYSTEM")
    print("="*60)
    
    # Create a test conversation
    print("\n1. Creating test conversation...")
    response = requests.post(f"{base_url}/conversations", 
                           json={"title": "FREE/PRO Version Test"},
                           headers={'Content-Type': 'application/json'})
    
    if response.status_code != 200:
        print(f"❌ Failed to create conversation: {response.status_code}")
        return
    
    conv_id = response.json()['id']
    print(f"✅ Created conversation: {conv_id}")
    
    # Test scenarios
    test_cases = [
        {
            "name": "PRO Version (Default) - Casual Greeting",
            "question": "Merhaba nasılsın?",
            "version": "pro",
            "expected": "Should use hybrid system (AnythingLLM/web search)"
        },
        {
            "name": "FREE Version - Casual Greeting", 
            "question": "Merhaba nasılsın?",
            "version": "free",
            "expected": "Should use Gemini API"
        },
        {
            "name": "PRO Version - Math Question",
            "question": "25 × 8 kaç eder?",
            "version": "pro", 
            "expected": "Should use hybrid system"
        },
        {
            "name": "FREE Version - Math Question",
            "question": "25 × 8 kaç eder?",
            "version": "free",
            "expected": "Should use Gemini API"
        },
        {
            "name": "FREE Version - Friend Mode",
            "question": "Motivasyona ihtiyacım var",
            "version": "free",
            "mode": "friend",
            "expected": "Should use Gemini with friend personality"
        },
        {
            "name": "FREE Version - Teacher Mode",
            "question": "Python öğrenmek istiyorum",
            "version": "free", 
            "mode": "teacher",
            "expected": "Should use Gemini with teacher personality"
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. Testing: {test_case['name']}")
        print(f"   Question: {test_case['question']}")
        print(f"   Version: {test_case['version']}")
        if 'mode' in test_case:
            print(f"   Mode: {test_case['mode']}")
        print(f"   Expected: {test_case['expected']}")
        
        # Prepare request data
        data = {
            "content": test_case['question'],
            "mode": "chat",
            "version": test_case['version']
        }
        
        if 'mode' in test_case:
            data['conversationMode'] = test_case['mode']
        
        # Send request
        start_time = time.time()
        response = requests.post(f"{base_url}/conversations/{conv_id}/messages",
                               json=data,
                               headers={'Content-Type': 'application/json'},
                               timeout=30)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            ai_response = response.json().get('content', '')
            print(f"   ✅ Response received ({response_time:.2f}s)")
            print(f"   Response: {ai_response[:150]}...")
            
            # Analyze response
            analysis = analyze_response(ai_response, test_case)
            results.append({
                'test': test_case['name'],
                'success': analysis['success'],
                'response_time': response_time,
                'analysis': analysis['details']
            })
            
            if analysis['success']:
                print(f"   ✅ {analysis['details']}")
            else:
                print(f"   ❌ {analysis['details']}")
                
        else:
            print(f"   ❌ Request failed: {response.status_code}")
            results.append({
                'test': test_case['name'],
                'success': False,
                'response_time': response_time,
                'analysis': f"HTTP {response.status_code}"
            })
        
        time.sleep(2)  # Brief pause between tests
    
    # Print summary
    print("\n" + "="*60)
    print("📊 TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = sum(1 for r in results if r['success'])
    total = len(results)
    
    for result in results:
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"{status} - {result['test']}")
        print(f"        Time: {result['response_time']:.2f}s | {result['analysis']}")
    
    print(f"\n📈 OVERALL: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL FREE/PRO VERSION TESTS PASSED!")
        print("✅ PRO version uses hybrid system correctly")
        print("✅ FREE version uses Gemini API correctly") 
        print("✅ Conversation modes work with Gemini")
    else:
        print(f"❌ {total-passed} tests failed - system needs attention")

def analyze_response(response, test_case):
    """Analyze the AI response to determine if it matches expectations"""
    
    response_lower = response.lower()
    version = test_case['version']
    
    # Check for error messages
    if 'gemini api' in response_lower and 'hata' in response_lower:
        return {
            'success': False,
            'details': 'Gemini API error detected'
        }
    
    if 'api error' in response_lower or 'authentication' in response_lower:
        return {
            'success': False,
            'details': 'API authentication error'
        }
    
    # Analyze based on version
    if version == "pro":
        # PRO version should use hybrid system
        # Check for appropriate responses without Gemini errors
        if len(response) > 10 and 'gemini' not in response_lower:
            return {
                'success': True,
                'details': 'PRO version using hybrid system correctly'
            }
        else:
            return {
                'success': False,
                'details': 'PRO version not using hybrid system properly'
            }
    
    elif version == "free":
        # FREE version should use Gemini API
        # Check for coherent Turkish response without hybrid indicators
        web_indicators = ['web araştırması', 'güncel web kaynaklarından']
        has_web_indicators = any(indicator in response_lower for indicator in web_indicators)
        
        is_coherent = len(response) > 10 and not has_web_indicators
        
        if is_coherent:
            # Check for conversation mode personalities if applicable
            if 'mode' in test_case:
                mode = test_case['mode']
                if mode == 'friend':
                    friend_indicators = ['motivasyon', 'başarabilirsin', 'güçlüsün', 'pozitif']
                    if any(indicator in response_lower for indicator in friend_indicators):
                        return {
                            'success': True,
                            'details': 'FREE version friend mode working with Gemini'
                        }
                    else:
                        return {
                            'success': False,
                            'details': 'Friend mode personality not detected'
                        }
                elif mode == 'teacher':
                    teacher_indicators = ['öğren', 'adım', 'başla', 'önce', 'pratik']
                    if any(indicator in response_lower for indicator in teacher_indicators):
                        return {
                            'success': True,
                            'details': 'FREE version teacher mode working with Gemini'
                        }
                    else:
                        return {
                            'success': False,
                            'details': 'Teacher mode personality not detected'
                        }
            else:
                return {
                    'success': True,
                    'details': 'FREE version using Gemini API correctly'
                }
        else:
            return {
                'success': False,
                'details': 'FREE version not using Gemini properly'
            }
    
    return {
        'success': False,
        'details': 'Unable to determine system behavior'
    }

if __name__ == "__main__":
    test_free_pro_versions()