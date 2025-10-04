import requests
import tempfile
import os

def create_simple_test_file(extension, content="Test content"):
    """Create a simple test file"""
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=f'.{extension}', delete=False, encoding='utf-8')
    temp_file.write(content)
    temp_file.close()
    return temp_file.name

def test_image_upload():
    base_url = "https://hybrid-chat-app.preview.emergentagent.com/api"
    
    # Create conversation
    print("Creating conversation...")
    response = requests.post(f"{base_url}/conversations", json={"title": "Image Test"})
    if response.status_code != 200:
        print(f"Failed to create conversation: {response.status_code}")
        return
    
    conv_id = response.json()['id']
    print(f"Created conversation: {conv_id}")
    
    # Test different file types
    file_types = [
        ('txt', 'text/plain'),
        ('pdf', 'application/pdf'),
        ('jpg', 'image/jpeg'),
        ('png', 'image/png'),
        ('gif', 'image/gif'),
        ('webp', 'image/webp'),
        ('bmp', 'image/bmp')
    ]
    
    for ext, mime_type in file_types:
        print(f"\nTesting {ext.upper()} upload...")
        
        # Create test file
        if ext in ['jpg', 'png', 'gif', 'webp', 'bmp']:
            # For images, create a minimal binary file
            temp_file = tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False)
            # Write minimal image header (fake)
            temp_file.write(b'\x89PNG\r\n\x1a\n' if ext == 'png' else b'\xFF\xD8\xFF\xE0')
            temp_file.close()
            file_path = temp_file.name
        else:
            file_path = create_simple_test_file(ext, f"Test {ext} content")
        
        try:
            # Upload file
            with open(file_path, 'rb') as f:
                files = {'file': (f'test.{ext}', f, mime_type)}
                upload_response = requests.post(f"{base_url}/conversations/{conv_id}/upload", files=files)
            
            print(f"  Status: {upload_response.status_code}")
            if upload_response.status_code == 200:
                print(f"  ✅ {ext.upper()} upload successful")
                try:
                    data = upload_response.json()
                    if 'system_message' in data:
                        print(f"  System message: {data['system_message'][:100]}...")
                except:
                    pass
            else:
                print(f"  ❌ {ext.upper()} upload failed")
                try:
                    print(f"  Error: {upload_response.json()}")
                except:
                    print(f"  Error: {upload_response.text}")
        
        except Exception as e:
            print(f"  ❌ Exception: {e}")
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

if __name__ == "__main__":
    test_image_upload()