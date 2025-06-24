#!/usr/bin/env python3
"""
Test script to verify backend setup
"""

import os
import sys
from dotenv import load_dotenv

def test_imports():
    """Test if all required packages can be imported."""
    try:
        import flask
        print("✓ Flask imported successfully")
        
        import openai
        print("✓ OpenAI imported successfully")
        
        from youtube_transcript_api import YouTubeTranscriptApi
        print("✓ YouTube Transcript API imported successfully")
        
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_env_vars():
    """Test if environment variables are set."""
    load_dotenv()
    
    api_key = os.getenv('OPENAI_API_KEY')
    base_url = os.getenv('OPENAI_BASE_URL')
    model = os.getenv('OPENAI_MODEL')
    
    print(f"API Key: {'✓ Set' if api_key else '✗ Not set'}")
    print(f"Base URL: {base_url or 'Using default'}")
    print(f"Model: {model or 'Using default'}")
    
    return bool(api_key)

def test_openai_client():
    """Test OpenAI client initialization for openai<1.0."""
    try:
        import openai
        openai.api_key = os.getenv('OPENAI_API_KEY')
        openai.api_base = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
        # Try a dry run (no actual API call)
        assert openai.api_key is not None
        print("✓ OpenAI client configured successfully")
        return True
    except Exception as e:
        print(f"✗ OpenAI client error: {e}")
        return False

def main():
    """Run all tests."""
    print("Testing backend setup...\n")
    
    tests = [
        ("Package imports", test_imports),
        ("Environment variables", test_env_vars),
        ("OpenAI client", test_openai_client),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Testing {test_name}...")
        if test_func():
            passed += 1
        print()
    
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed! Backend is ready to run.")
        print("\nTo start the server, run:")
        print("python app.py")
    else:
        print("✗ Some tests failed. Please check the setup.")
        sys.exit(1)

if __name__ == "__main__":
    main() 