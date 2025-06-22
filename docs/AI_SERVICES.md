# AI Services Integration Guide

This guide explains how to use the OpenAI and ElevenLabs APIs in the Face Controls project.

## API Keys Management

### GitHub Secrets (for CI/CD)
The following secrets are configured in GitHub Actions:
- `OPENAI_API_KEY` - OpenAI API key for GPT models
- `ELEVENLABS_API_KEY` - ElevenLabs API key for voice synthesis

### AWS Secrets Manager (for backend services)
Secrets are stored in AWS Secrets Manager:
- `face-controls/openai` - OpenAI API credentials
- `face-controls/elevenlabs` - ElevenLabs API credentials

### Local Development
For local development, create a `.env` file based on `.env.example` and add:
```bash
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

## OpenAI Integration

### Installation
```bash
pip install openai
```

### Basic Usage Example
```python
import os
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Example: Generate game dialogue
def generate_boss_dialogue(boss_name, player_action):
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": f"You are {boss_name}, a boss in a face-controlled game. Respond dramatically to player actions."},
            {"role": "user", "content": f"The player just {player_action}"}
        ],
        max_tokens=100
    )
    return response.choices[0].message.content

# Example usage
dialogue = generate_boss_dialogue("Gary", "fired lasers from their eyes")
print(dialogue)
```

### Advanced Features
- **Vision API**: Analyze game screenshots or player webcam feed
- **Function Calling**: Let AI control game mechanics
- **Embeddings**: Create semantic search for game content

## ElevenLabs Integration

### Installation
```bash
pip install elevenlabs
```

### Basic Usage Example
```python
import os
from dotenv import load_dotenv
from elevenlabs import generate, play, set_api_key

# Load environment variables
load_dotenv()

# Set API key
set_api_key(os.getenv('ELEVENLABS_API_KEY'))

# Example: Generate boss voice
def speak_boss_dialogue(text, voice_id="gary"):
    """
    Generate and play boss dialogue
    Available voices can be found at https://elevenlabs.io/voice-library
    """
    audio = generate(
        text=text,
        voice=voice_id,
        model="eleven_monolingual_v1"
    )
    
    # Play the audio
    play(audio)
    
    # Or save to file
    with open("boss_dialogue.mp3", "wb") as f:
        f.write(audio)

# Example usage
speak_boss_dialogue("You dare challenge me? Prepare to face the wrath of Gary!")
```

### Voice Customization
```python
# Advanced voice settings
audio = generate(
    text="Welcome to the Elder Dimension!",
    voice="gary",
    model="eleven_monolingual_v1",
    voice_settings={
        "stability": 0.75,
        "similarity_boost": 0.75,
        "style": 0.5,
        "use_speaker_boost": True
    }
)
```

## Integration with Face Controls Game

### Example: AI-Powered Boss Behavior
```python
class AIBoss:
    def __init__(self, name, personality):
        self.name = name
        self.personality = personality
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        set_api_key(os.getenv('ELEVENLABS_API_KEY'))
    
    def react_to_player(self, player_state):
        # Generate contextual response
        prompt = f"Player health: {player_state['health']}, Player action: {player_state['last_action']}"
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"You are {self.name}, {self.personality}. Respond with a short taunt or reaction."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50
        )
        
        dialogue = response.choices[0].message.content
        
        # Convert to speech
        audio = generate(text=dialogue, voice=self.name.lower())
        play(audio)
        
        return dialogue

# Usage in game
gary_boss = AIBoss("Gary", "a mischievous pink entity who hates being looked at")
gary_boss.react_to_player({"health": 50, "last_action": "maintained eye contact"})
```

### Example: Dynamic Game Narration
```python
class GameNarrator:
    def __init__(self):
        self.voice = "narrator"  # Use a different ElevenLabs voice
        
    def narrate_event(self, event_type, context):
        prompts = {
            "boss_spawn": f"Describe the dramatic entrance of {context['boss_name']}",
            "player_victory": f"Narrate the player's triumph over {context['enemy']}",
            "elder_portal": "Describe the opening of a portal to the Elder Dimension"
        }
        
        # Generate narration text
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a dramatic game narrator. Keep responses under 50 words."},
                {"role": "user", "content": prompts.get(event_type, "Describe what happens next")}
            ]
        )
        
        narration = response.choices[0].message.content
        
        # Convert to speech with dramatic voice settings
        audio = generate(
            text=narration,
            voice=self.voice,
            voice_settings={
                "stability": 0.65,
                "similarity_boost": 0.8,
                "style": 0.8  # More dramatic
            }
        )
        
        return audio, narration
```

## Best Practices

### API Key Security
1. Never commit API keys to version control
2. Use environment variables for local development
3. Use AWS Secrets Manager for production
4. Rotate keys regularly

### Rate Limiting
```python
import time
from functools import wraps

def rate_limit(calls_per_minute=60):
    min_interval = 60.0 / calls_per_minute
    last_called = [0.0]
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_called[0]
            left_to_wait = min_interval - elapsed
            if left_to_wait > 0:
                time.sleep(left_to_wait)
            ret = func(*args, **kwargs)
            last_called[0] = time.time()
            return ret
        return wrapper
    return decorator

# Usage
@rate_limit(calls_per_minute=20)
def generate_dialogue(prompt):
    # API call here
    pass
```

### Error Handling
```python
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def safe_ai_call(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except openai.APIError as e:
        logging.error(f"OpenAI API error: {e}")
        raise
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        raise
```

## Testing

### Mock Services for Development
```python
class MockAIServices:
    """Use this for testing without consuming API credits"""
    
    @staticmethod
    def generate_dialogue(prompt):
        return "Mock boss dialogue for testing"
    
    @staticmethod
    def generate_audio(text):
        # Return path to a pre-recorded audio file
        return "assets/mock_audio.mp3"

# In your code
if os.getenv('ENVIRONMENT') == 'development':
    ai_service = MockAIServices()
else:
    ai_service = RealAIServices()
```

## Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [ElevenLabs Documentation](https://docs.elevenlabs.io/welcome/introduction)
- [OpenAI Python Library](https://github.com/openai/openai-python)
- [ElevenLabs Python Library](https://github.com/elevenlabs/elevenlabs-python)

## Audio Assets

The `gary.mp3` file is included in the repository as a sample audio file for Gary's voice. You can use this for testing or as a fallback when the ElevenLabs API is unavailable.

```python
# Fallback to local audio
try:
    audio = generate(text="Gary's dialogue", voice="gary")
except Exception as e:
    logging.warning(f"ElevenLabs API failed, using local audio: {e}")
    with open("gary.mp3", "rb") as f:
        audio = f.read()
```