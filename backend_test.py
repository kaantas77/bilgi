import requests
import sys
import json
from datetime import datetime

class BilginAIAPITester:
    def __init__(self, base_url="https://rag-websearch.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.conversation_id = None

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

def main():
    print("🚀 Starting BİLGİN AI Backend API Tests")
    print("=" * 50)
    
    tester = BilginAIAPITester()
    
    # Run all tests in sequence
    tests = [
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
    
    for test in tests:
        test()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())