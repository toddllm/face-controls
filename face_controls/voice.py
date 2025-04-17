import pyaudio
import numpy as np
import pyttsx3

class VoiceController:
    def __init__(self, rate=16000, chunk=1024, threshold=500):
        self.rate = rate
        self.chunk = chunk
        self.threshold = threshold
        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.chunk
        )
        # Initialize TTS engine
        self.tts_engine = pyttsx3.init()

    def read(self):
        data = self.stream.read(self.chunk, exception_on_overflow=False)
        try:
            audio_data = np.frombuffer(data, dtype=np.int16).astype(np.float32)
            rms = float(np.sqrt(np.mean(audio_data ** 2)))
        except Exception:
            rms = 0.0
        return rms

    def close(self):
        self.stream.stop_stream()
        self.stream.close()
        self.p.terminate()
    
    def speak(self, text: str):
        """Speak the given text using the TTS engine."""
        self.tts_engine.say(text)
        self.tts_engine.runAndWait()