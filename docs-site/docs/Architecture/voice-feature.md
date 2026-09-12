# Voice Recording Feature

## Overview

The Voice Recording feature lets users create log entries by speaking instead of
typing. When activated from the Dashboard's Quick Add bar, a full-screen voice
recorder modal opens, automatically begins capturing audio, and provides visual
feedback while recording. Once the user finishes speaking, the audio is
transcribed, and the resulting text is sent through the existing natural
language quick-add pipeline to create an entry — all hands-free.

## User Flow

```
User taps 🎤 mic button in Quick Add bar
    │
    ▼
VoiceFeature modal opens
    │
    ├── askAI() generates a spoken prompt:
    │   "Say a log entry or describe a new project"
    │
    ├── Recording starts automatically
    │   ├── Animated concentric circles pulse outward
    │   └── Timer shows elapsed recording time
    │
    ▼
User taps Stop (or auto-stop on silence)
    │
    ▼
getTranscript() sends audio blob to transcription endpoint
    │
    ▼
Transcribed text passed to quickAdd()
    │
    ▼
quickAdd() calls addNaturalLanguageEntry(text)
    │
    ▼
Backend AI parses text → matches/creates project → inserts entry
    │
    ▼
Toast notification confirms entry creation (15 s)
```

## Component Architecture

### VoiceFeature.tsx

The main component lives at `frontend/src/pages/VoiceFeature.tsx` and is
rendered as a modal overlay on the Dashboard.

| Responsibility                       | Implementation                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Auto-start recording on mount        | `useEffect` calls `startRecording()` from `useReactMediaRecorder`                                             |
| Recording animation                  | CSS keyframe `pulse-ring` — concentric circles expanding outward from a central mic icon                      |
| Stop / Retry / Retake / Send buttons | `react-icons` (`FiMic`, `FiRefreshCw`, `FiSkipBack`, `FiSend`)                                                |
| AI prompt display                    | Calls `askAI()` on mount to generate a spoken prompt for the user                                             |
| Transcription                        | `getTranscript()` converts the recorded `Blob` to text via the project-service `/service/transcribe` endpoint |
| Submit to quick add                  | Calls `quickAdd(transcript)` which delegates to `addNaturalLanguageEntry()`                                   |

### State Machine

```
┌──────────┐    auto-start    ┌───────────┐
│  IDLE    │ ───────────────► │ RECORDING │
└──────────┘                  └─────┬─────┘
                                    │ user taps Stop
                                    ▼
                              ┌───────────┐
                              │RECORDED   │
                              └─────┬─────┘
                       ┌────────────┼────────────┐
                       ▼            ▼            ▼
                 ┌──────────┐ ┌──────────┐ ┌──────────┐
                 │TRANSCRIBE│ │  RETRY   │ │  RETAKE  │
                 └────┬─────┘ └────┬─────┘ └────┬─────┘
                      │            │             │
                      ▼            │             │
                ┌──────────┐       │             │
                │  SEND    │       │             │
                └────┬─────┘       │             │
                     │             │             │
                     ▼             ▼             ▼
              quickAdd()     back to IDLE   back to IDLE
```

## Key Functions

### `voicefeature.js` — Backend Helpers

Located at `frontend/src/functions/voicefeature.js`.

#### `getTranscript(audioBlob)`

Sends the recorded audio blob to the project-service transcription endpoint
and returns the transcribed text.

```javascript
export async function getTranscript(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${PROJECT_URL}/service/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await response.json();
  return data.transcript || '';
}
```

#### `quickAdd(text)`

Wraps `addNaturalLanguageEntry()` so the VoiceFeature component does not need
to know about the natural-language API directly.

```javascript
export async function quickAdd(text) {
  return await addNaturalLanguageEntry(text);
}
```

### `askAI()` — Spoken Prompt Generator

Imported from `frontend/src/functions/ai.js`. Called when the VoiceFeature
modal opens to give the user a contextual cue about what to say.

```javascript
import { askAI } from '@/functions/ai.js';

const prompt = await askAI(
  'Generate a short, friendly instruction telling the user to speak a log entry or describe a new project.'
);
```

## Dashboard Integration

### Quick Entry Bar — Voice Button

A microphone button (🎤) is added to the `QuickEntryBar` component, next to
the existing send button. Tapping it:

1. Sets `voiceOpen = true` in Dashboard state
2. Renders the `<VoiceFeature>` modal
3. The modal auto-starts recording and shows the AI prompt

```tsx
// Inside QuickEntryBar.tsx
<button
  type="button"
  className="quick-entry-voice"
  onClick={() => setVoiceOpen(true)}
  aria-label="Voice entry"
>
  <FiMic />
</button>
```

### Toast Duration

The quick-add toast is extended to **15 seconds** (from the default 8 s) when
the entry originates from voice input, giving the user more time to read the
AI-generated confirmation comment.

```typescript
// In QuickEntryBar, when voice-sourced:
setTimeout(() => setToast(''), 15000); // 15 seconds
```

## Recording Animation

While recording, three concentric circles pulse outward from the central
microphone icon using CSS keyframes:

```css
@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.2;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.8;
  }
}

.voice-recording-ring:nth-child(1) {
  animation: pulse-ring 2s ease-in-out infinite;
}
.voice-recording-ring:nth-child(2) {
  animation: pulse-ring 2s ease-in-out infinite 0.4s;
}
.voice-recording-ring:nth-child(3) {
  animation: pulse-ring 2s ease-in-out infinite 0.8s;
}
```

The rings use the `--accent` CSS variable so they match the active theme.

## Dependencies

| Package                | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `react-media-recorder` | Cross-browser audio capture with `Blob` output               |
| `react-icons`          | Consistent icon set for Retry, Retake, Send, and Mic buttons |

## API Endpoints

| Endpoint                          | Method | Purpose                                             |
| --------------------------------- | ------ | --------------------------------------------------- |
| `/service/ai`                     | POST   | Generate spoken prompt via `askAI()`                |
| `/service/transcribe`             | POST   | Convert audio blob to text via `getTranscript()`    |
| `/service/natural-language-entry` | POST   | Create entry from transcribed text via `quickAdd()` |

## Error Handling

| Scenario                       | Behaviour                                                           |
| ------------------------------ | ------------------------------------------------------------------- |
| Microphone permission denied   | Show inline error with a "Retry" button that re-requests permission |
| Transcription fails            | Display "Could not transcribe — try again" and allow retake         |
| Network error during quick add | Toast with error message; recording is preserved so user can retry  |
| Empty transcript               | Disable Send button; prompt user to retake the recording            |

## Future Enhancements

- **Auto-stop on silence**: Detect when the user stops speaking and halt
  recording automatically after a configurable silence threshold.
- **Live waveform**: Replace the static pulse rings with a real-time audio
  waveform visualiser using the Web Audio API `AnalyserNode`.
- **Multi-language transcription**: Support languages beyond English via
  provider selection in Settings.
- **Voice commands**: Recognise commands like "new project" to trigger
  project creation instead of entry creation.
