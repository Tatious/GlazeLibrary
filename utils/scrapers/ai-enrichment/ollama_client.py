#!/usr/bin/env python3
"""
Ollama API Client

Handles communication with Ollama for both text and vision models.
"""

import base64
import json
import requests
from pathlib import Path
from typing import Optional
from config import OLLAMA_HOST, VISION_MODEL, TEXT_MODEL


class OllamaClient:
    def __init__(self, host: str = OLLAMA_HOST):
        self.host = host.rstrip('/')
        self.session = requests.Session()
    
    def is_available(self) -> bool:
        """Check if Ollama is running and accessible"""
        try:
            response = self.session.get(f"{self.host}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def list_models(self) -> list[str]:
        """List available models"""
        try:
            response = self.session.get(f"{self.host}/api/tags")
            data = response.json()
            return [m["name"] for m in data.get("models", [])]
        except:
            return []
    
    def has_model(self, model: str) -> bool:
        """Check if a specific model is available"""
        models = self.list_models()
        # Check both exact match and base name (llava:13b matches llava:13b-v1.6)
        base_name = model.split(":")[0]
        return any(model in m or m.startswith(base_name) for m in models)
    
    def generate_text(
        self, 
        prompt: str, 
        model: str = TEXT_MODEL,
        temperature: float = 0.3
    ) -> str:
        """Generate text completion"""
        response = self.session.post(
            f"{self.host}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "temperature": temperature,
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
        return response.json()["response"]
    
    def analyze_image(
        self,
        image_path: Path,
        prompt: str,
        model: str = VISION_MODEL,
        temperature: float = 0.3
    ) -> str:
        """Analyze an image with a vision model"""
        # Read and encode image
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        
        response = self.session.post(
            f"{self.host}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "images": [image_data],
                "temperature": temperature,
                "stream": False
            },
            timeout=180  # Vision can be slower
        )
        response.raise_for_status()
        return response.json()["response"]
    
    def parse_json_response(self, response: str) -> dict:
        """Extract JSON from model response, handling common quirks"""
        import re
        text = response.strip()
        
        # Try to extract JSON from markdown code block
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        # Find JSON object in text
        start = text.find("{")
        end = text.rfind("}") + 1
        
        if start >= 0 and end > start:
            json_str = text[start:end]
            
            # Fix common issues with model-generated JSON
            # Remove trailing commas before } or ]
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)
            
            # Fix unescaped quotes in strings (common with descriptions)
            # This is tricky - try to parse first, then fix if needed
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                # Try fixing common quote issues in description field
                # Replace smart quotes with regular quotes
                json_str = json_str.replace('"', '"').replace('"', '"')
                json_str = json_str.replace(''', "'").replace(''', "'")
                
                return json.loads(json_str)
        
        raise ValueError(f"No valid JSON found in response: {text[:200]}")


def test_connection():
    """Test Ollama connection and show available models"""
    client = OllamaClient()
    
    print(f"Testing connection to {OLLAMA_HOST}...")
    
    if not client.is_available():
        print("✗ Ollama is not running or not accessible")
        print(f"  Make sure Ollama is running: ollama serve")
        print(f"  If on another machine, set OLLAMA_HOST in config.py")
        return False
    
    print("✓ Ollama is running")
    
    models = client.list_models()
    print(f"\nAvailable models ({len(models)}):")
    for m in models:
        print(f"  - {m}")
    
    print(f"\nRequired models:")
    print(f"  Vision: {VISION_MODEL} - {'✓' if client.has_model(VISION_MODEL) else '✗ NOT FOUND'}")
    print(f"  Text:   {TEXT_MODEL} - {'✓' if client.has_model(TEXT_MODEL) else '✗ NOT FOUND'}")
    
    if not client.has_model(VISION_MODEL):
        print(f"\n  To install: ollama pull {VISION_MODEL}")
    if not client.has_model(TEXT_MODEL):
        print(f"\n  To install: ollama pull {TEXT_MODEL}")
    
    return True


if __name__ == "__main__":
    test_connection()
