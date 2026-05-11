from pathlib import Path
import sys

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
sys.path.insert(0, str(API_ROOT))

from backend.transcription.asr_transcriber import ASRTranscriber

audio_path = REPO_ROOT / "references" / "whisper.cpp" / "samples" / "jfk.wav"

transcript = ASRTranscriber().transcribe(audio_path)

print(transcript)
