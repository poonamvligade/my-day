# My Journal

A voice-first journaling app built with Next.js. Record a quick audio note, get an automatic transcription, receive one reflective prompt (plus optional TTS playback), and save a polished daily journal entry. Entries are stored locally as text files under `transcripts/`.

## What It Does

- Records audio in the browser using the MediaRecorder API.
- Uploads the recording and transcribes it with OpenAI Whisper (`/v1/audio/transcriptions`).
- Logs raw transcripts and a running daily log.
- Requests a single reflective question from Groq and optionally plays it back via OpenAI TTS.
- Generates a final, cleaned daily entry from the log (also via Groq).
- Shows a history view of daily entries (final + raw).

## How It Works

### UI flow

- `AudioRecorder` handles mic capture, upload, transcription, reflection, and finalization.
- `JournalEntries` lists available days and shows the raw + final text for a selected date.

### Server routes

- `POST /api/transcribe`
  - Accepts an audio file (`.webm`), transcribes with Whisper, appends the result to the daily raw/log files, and returns the transcript.
  - Auto-finalizes the previous day if the date changes and a Groq key is present.
  - Enforces a 25 MB upload limit.

- `POST /api/reflect`
  - Sends the latest context to Groq and returns one reflective question.
  - Appends the question into the daily log.

- `POST /api/journal/finalize`
  - Cleans the daily log into a coherent final entry (first-person, no assistant text).
  - Saves the final entry to disk.

- `GET /api/journal/list`
  - Lists available dates with raw/log/final flags.

- `GET /api/journal/day?date=YYYY-MM-DD`
  - Returns the raw, log, and final text for the requested date.

- `POST /api/tts`
  - Uses OpenAI TTS to generate audio for the reflective question.

### Storage

Daily files live in `transcripts/` and are named by date:

- `YYYY-MM-DD.raw.txt` — raw transcripts
- `YYYY-MM-DD.log.txt` — running log (user + reflection prompts)
- `YYYY-MM-DD.final.txt` — cleaned daily entry

A `transcripts/last-active.json` file tracks the last active date to enable auto-finalization when a new day starts.

## Setup

### Requirements

- Node.js 18+ (recommended for Next.js 15)
- API keys for OpenAI and Groq

### Environment variables

Create a `.env.local` file in the project root:

```
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
```

### Install + run

```
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- The client records in WebM. There is a TODO to add server-side FFmpeg for MP3 export.
- All journal data is stored locally on disk (no external database used by default).
- If the reflective prompt fails, transcription still succeeds and is saved.

## Key Files

- `src/components/AudioRecorder.tsx`
- `src/components/JournalEntries.tsx`
- `src/app/api/transcribe/route.ts`
- `src/app/api/reflect/route.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/journal/finalize/route.ts`
- `src/lib/journal.ts`
