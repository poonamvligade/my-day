import { AudioRecorder } from '../components/AudioRecorder'
import { JournalEntries } from '../components/JournalEntries'

export default function Home() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="app-kicker">My Journal</p>
        <h1>Capture thoughts in your own voice</h1>
        <p className="app-subtitle">
          Record quick audio notes now, with MP3 export coming via server-side
          FFmpeg.
        </p>
      </header>
      <main className="app-main">
        <AudioRecorder />
        <JournalEntries />
      </main>
    </div>
  )
}
