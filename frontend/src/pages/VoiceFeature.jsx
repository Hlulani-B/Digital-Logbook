import { useState, useEffect, useRef } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { FiMic, FiStopCircle, FiRefreshCw, FiSkipBack, FiSend, FiX } from "react-icons/fi";
import { askAI } from "@/functions/ai.js";
import { getTranscript, quickAdd } from "@/functions/voicefeature.js";

/**
 * VoiceFeature — full-screen voice recorder modal.
 * Auto-starts recording on mount. Shows animated pulse rings while recording.
 * On stop, transcribes audio and lets user send to quick-add.
 *
 * @param {{ onClose: () => void, onEntryCreated?: () => void }} props
 */
export default function VoiceFeature({ onClose, onEntryCreated }) {
  const [status, setStatus] = useState("idle"); // idle | recording | recorded | transcribing | sending | done | error
  const [aiPrompt, setAiPrompt] = useState("Say a log entry or describe a new project...");
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const {
    status: recorderStatus,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    clearBlobUrl,
  } = useReactMediaRecorder({
    audio: true,
    blobType: "webm",
  });

  // Auto-start recording on mount
  useEffect(() => {
    const start = async () => {
      try {
        await startRecording();
        setStatus("recording");
      } catch (err) {
        console.error("Mic error:", err);
        setStatus("error");
        setErrorMsg("Microphone access denied. Please allow mic permissions.");
      }
    };
    // Small delay to let the media stream initialise
    const t = setTimeout(start, 300);
    return () => clearTimeout(t);
  }, []);

  // Ask AI for a spoken prompt on mount
  useEffect(() => {
    (async () => {
      const result = await askAI(
        "Generate a short, friendly one-line instruction telling the user to speak a log entry or describe a new project. Keep it under 20 words."
      );
      if (result.success && result.response) {
        setAiPrompt(result.response);
      }
    })();
  }, []);

  // Elapsed timer while recording
  useEffect(() => {
    if (status === "recording") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const handleStop = () => {
    stopRecording();
    setStatus("recorded");
  };

  const handleRetry = async () => {
    clearBlobUrl();
    setTranscript("");
    setErrorMsg("");
    try {
      await startRecording();
      setStatus("recording");
    } catch {
      setStatus("error");
      setErrorMsg("Could not restart recording.");
    }
  };

  const handleRetake = () => {
    clearBlobUrl();
    setTranscript("");
    setErrorMsg("");
    handleRetry();
  };

  const handleSend = async () => {
    if (!transcript.trim()) return;
    setStatus("sending");
    const result = await quickAdd(transcript.trim());
    if (result.success) {
      setStatus("done");
      if (onEntryCreated) onEntryCreated();
      setTimeout(onClose, 1500);
    } else {
      setStatus("error");
      setErrorMsg(result.message || "Failed to create entry. Please try again.");
    }
  };

  // Transcribe when recording stops and we have a blob
  useEffect(() => {
    if (status === "recorded" && mediaBlobUrl) {
      (async () => {
        setStatus("transcribing");
        try {
          const res = await fetch(mediaBlobUrl);
          const blob = await res.blob();
          const text = await getTranscript(blob);
          if (text) {
            setTranscript(text);
            setStatus("recorded");
          } else {
            setStatus("error");
            setErrorMsg("Could not transcribe audio. Please retake.");
          }
        } catch (err) {
          console.error("Transcription error:", err);
          setStatus("error");
          setErrorMsg("Transcription failed. Please try again.");
        }
      })();
    }
  }, [mediaBlobUrl]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="voice-modal-overlay" onClick={onClose}>
      <div className="voice-modal-card glass" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="voice-modal-close" onClick={onClose} aria-label="Close">
          <FiX size={20} />
        </button>

        {/* AI prompt at top */}
        <div className="voice-ai-prompt">
          <FiMic size={18} />
          <p>{aiPrompt}</p>
        </div>

        {/* Recording animation area */}
        <div className="voice-visual">
          {status === "recording" && (
            <div className="voice-rings">
              <div className="voice-ring voice-ring-1" />
              <div className="voice-ring voice-ring-2" />
              <div className="voice-ring voice-ring-3" />
              <div className="voice-center-mic">
                <FiMic size={28} />
              </div>
            </div>
          )}

          {status !== "recording" && (
            <div className="voice-static-icon">
              <FiMic size={40} />
            </div>
          )}

          {/* Timer */}
          <div className="voice-timer">{formatTime(elapsed)}</div>
        </div>

        {/* Status text */}
        <div className="voice-status-text">
          {status === "recording" && "Listening..."}
          {status === "recorded" && !transcript && "Processing..."}
          {status === "transcribing" && "Transcribing your voice..."}
          {status === "sending" && "Creating entry..."}
          {status === "done" && "Entry created!"}
          {status === "error" && errorMsg}
        </div>

        {/* Transcript preview */}
        {transcript && status !== "sending" && status !== "done" && (
          <div className="voice-transcript-box">
            <p className="voice-transcript-label">Transcript:</p>
            <p className="voice-transcript-text">{transcript}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="voice-actions">
          {status === "recording" && (
            <button className="voice-btn voice-btn-stop" onClick={handleStop} aria-label="Stop recording">
              <FiStopCircle size={22} />
              <span>Stop</span>
            </button>
          )}

          {status === "recorded" && transcript && (
            <>
              <button className="voice-btn voice-btn-secondary" onClick={handleRetake} aria-label="Retake recording">
                <FiSkipBack size={18} />
                <span>Retake</span>
              </button>
              <button className="voice-btn voice-btn-primary" onClick={handleSend} aria-label="Send entry">
                <FiSend size={18} />
                <span>Send</span>
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <button className="voice-btn voice-btn-secondary" onClick={handleRetry} aria-label="Retry recording">
                <FiRefreshCw size={18} />
                <span>Retry</span>
              </button>
              <button className="voice-btn voice-btn-secondary" onClick={handleRetake} aria-label="Retake recording">
                <FiSkipBack size={18} />
                <span>Retake</span>
              </button>
            </>
          )}

          {status === "transcribing" && (
            <div className="voice-spinner">
              <div className="voice-spinner-ring" />
            </div>
          )}

          {status === "sending" && (
            <div className="voice-spinner">
              <div className="voice-spinner-ring" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
