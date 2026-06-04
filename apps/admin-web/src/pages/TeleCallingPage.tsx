import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleGuard";
import { getCentres, getEmployees } from "../lib/store";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface CallRecord {
  id: string;
  customer_name: string;
  phone: string;
  agent_name: string;
  sector: string;
  centre_id: string;
  centre_name: string;
  started_at?: string;
  date?: string;
  duration_secs?: number;
  duration?: string;
  status: "completed" | "missed" | "no-answer";
  notes: string;
  recordingBlob?: string;
  call_direction: "outbound" | "inbound";
  recording_source?: "mic" | "system" | "mixed" | "uploaded";
}

const LOCAL_KEY = "kv_call_records_v3";
const AIRTEL_NO = "8220927361";

function getLocal(): CallRecord[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; }
}
function saveLocal(r: CallRecord[]) { localStorage.setItem(LOCAL_KEY, JSON.stringify(r)); }

const DEFAULT_SECTORS = [
  "Head Office", "Chennai North", "Chennai South", "Coimbatore", "Madurai",
  "Trichy", "Salem", "Tirunelveli", "Franchise – Zone A", "Franchise – Zone B",
];

function fmtDur(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ─── Audio device picker ────────────────────────────────────────────────────── */
interface AudioDevice { deviceId: string; label: string; }

async function listAudioDevices(): Promise<AudioDevice[]> {
  try {
    // Request permission first so labels are visible
    await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audioinput")
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone (${d.deviceId.slice(0, 8)})` }));
  } catch { return []; }
}

/* ─── Mix two streams into one ──────────────────────────────────────────────── */
function mixStreams(streams: MediaStream[]): { mixed: MediaStream; ctx: AudioContext } {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  streams.forEach((s) => {
    try { ctx.createMediaStreamSource(s).connect(dest); } catch {}
  });
  return { mixed: dest.stream, ctx };
}

export default function TeleCallingPage() {
  const { user } = useAuth();
  const { isSuperAdmin, isEmployee } = useRole();
  const canDelete         = isSuperAdmin;
  const canHearRecordings = isSuperAdmin || isEmployee;

  const centres   = getCentres();
  const employees = getEmployees().filter((e) => e.status === "active");
  const sectors   = [...new Set([...centres.map((c) => c.name), ...DEFAULT_SECTORS])];

  /* ── UI state ── */
  const [records, setRecords]   = useState<CallRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [activeCall, setActiveCall] = useState<{
    customer: string; phone: string; agent: string; notes: string;
    sector: string; centre_id: string; centre_name: string;
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording]   = useState(false);
  const [recordingSource, setRecordingSource] = useState<"mic" | "system" | "mixed">("mixed");
  const [playingId, setPlayingId]       = useState<string | null>(null);
  const [audioError, setAudioError]     = useState("");
  const [audioWarning, setAudioWarning] = useState("");
  const [filter, setFilter]             = useState<"all" | "completed" | "missed">("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [agentFilter, setAgentFilter]   = useState("all");
  const [search, setSearch]             = useState("");
  const [uploadingId, setUploadingId]   = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selMicId, setSelMicId]         = useState("default");
  const [showDeviceSetup, setShowDeviceSetup] = useState(false);
  const [systemCaptureSupported, setSystemCaptureSupported] = useState(false);

  /* ── Form ── */
  const [newForm, setNewForm] = useState({
    customer: "", phone: "", agent: user?.full_name ?? "", notes: "",
    sector: centres[0]?.name ?? sectors[0] ?? "Head Office",
    centre_id: centres[0]?.id ?? "",
    centre_name: centres[0]?.name ?? "Head Office",
  });

  /* ── Refs ── */
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamsRef       = useRef<MediaStream[]>([]);
  const mixCtxRef        = useRef<AudioContext | null>(null);
  const canvasRef        = useRef<HTMLCanvasElement | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const animFrameRef     = useRef<number | null>(null);
  const playbackRef      = useRef<HTMLAudioElement | null>(null);
  const blobMapRef       = useRef<Map<string, string>>(new Map());
  const uploadedRef      = useRef<Map<string, { url: string; name: string }>>(new Map());
  const fileInputRef     = useRef<HTMLInputElement | null>(null);

  /* ── Init ── */
  useEffect(() => {
    // Load records
    api.get<CallRecord[]>("/calls/logs")
      .then((r) => { setRecords(r.data.map((x: any) => ({ ...x, sector: x.sector ?? "Head Office", centre_name: x.centre_name ?? "—", call_direction: x.call_direction ?? "outbound" }))); setLoading(false); })
      .catch(() => { setRecords(getLocal()); setLoading(false); });

    // Check if getDisplayMedia (system audio) is available — Chrome 105+ desktop only
    const hasDisplayMedia = "getDisplayMedia" in navigator.mediaDevices;
    setSystemCaptureSupported(hasDisplayMedia);

    // On mobile, getDisplayMedia is not available — auto-switch to mic-only
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile || !hasDisplayMedia) {
      setRecordingSource("mic");
    }

    // Load audio devices
    listAudioDevices().then(setAudioDevices);
    navigator.mediaDevices.addEventListener("devicechange", () => listAudioDevices().then(setAudioDevices));
  }, []);

  /* ── Waveform ── */
  const drawWave = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(buf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#34d399"; ctx.lineWidth = 2.5; ctx.beginPath();
    const sw = canvas.width / buf.length; let x = 0;
    buf.forEach((v, i) => { const y = (v / 128) * (canvas.height / 2); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); x += sw; });
    ctx.stroke();
    animFrameRef.current = requestAnimationFrame(drawWave);
  };

  /* ════════════════════════════════════════════════════════════════════════════
     START CALL — captures audio from Phone Link (system audio) + mic
     ════════════════════════════════════════════════════════════════════════════ */
  async function startCall() {
    if (!newForm.phone) { alert("Enter phone number."); return; }
    setAudioError(""); setAudioWarning("");

    const streams: MediaStream[] = [];

    /* 1. Always grab the microphone (your voice) */
    try {
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const micConstraints: MediaStreamConstraints = {
        audio: isMobile
          ? true  // use simple constraints on mobile for better compatibility
          : {
            deviceId: selMicId !== "default" ? { exact: selMicId } : undefined,
            echoCancellation: false,  // keep raw audio for recording
            noiseSuppression: false,
            autoGainControl: false,
          }
      };
      const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
      streams.push(micStream);
    } catch {
      setAudioError("Microphone access denied. Please allow microphone access in your browser settings.");
      return;
    }

    /* 2. Try to grab system/tab audio (Phone Link call audio — the other person's voice)
          Uses getDisplayMedia with audio — user must click the correct screen/tab
          and check "Share system audio" checkbox in the browser prompt            */
    if (recordingSource === "system" || recordingSource === "mixed") {
      try {
        const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: false,         // no video needed
          audio: {
            suppressLocalAudioPlayback: false,
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 48000,
          },
          preferCurrentTab: false,
          systemAudio: "include",  // Chrome 105+ key: capture system audio
        });
        streams.push(displayStream);
        setAudioWarning("");
      } catch (err: any) {
        // User cancelled or system audio not available
        if (recordingSource === "system") {
          setAudioError("System audio capture cancelled or not supported. Use 'Mic Only' mode instead.");
          streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
          return;
        }
        // Mixed mode: just fall back to mic only with a warning
        setAudioWarning("System audio not captured (cancelled). Recording microphone only — you'll hear yourself but not the caller.");
      }
    }

    streamsRef.current = streams;

    /* 3. Mix all captured streams together */
    let recordStream: MediaStream;
    if (streams.length > 1) {
      const { mixed, ctx } = mixStreams(streams);
      mixCtxRef.current  = ctx;
      recordStream       = mixed;
      // Attach analyser to mixed stream for waveform
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(mixed).connect(analyser);
    } else {
      recordStream = streams[0];
      const ctx = new AudioContext();
      mixCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(streams[0]).connect(analyser);
    }

    /* 4. Start MediaRecorder */
    audioChunksRef.current = [];
    const mime = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",       // Safari / iOS fallback
      "audio/mpeg",
    ].find((m) => {
      try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    }) ?? "";
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(recordStream, mime ? { mimeType: mime } : {});
    } catch {
      // Some mobile browsers don't accept options — try without
      rec = new MediaRecorder(recordStream);
    }
    mediaRecorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    rec.start(200);

    /* 5. Dial via Phone Link */
    window.open(`tel:${newForm.phone}`, "_self");

    /* 6. Start UI */
    setActiveCall({ ...newForm });
    setCallDuration(0);
    setIsRecording(true);
    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    setShowNew(false);
    setNewForm((f) => ({ ...f, customer: "", phone: "", notes: "" }));
    setTimeout(() => requestAnimationFrame(drawWave), 200);
  }

  /* ── End call — stop recording and save ── */
  function endCall(status: "completed" | "missed" | "no-answer" = "completed") {
    if (!activeCall) return;

    // Stop all recording
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    if (mixCtxRef.current) { mixCtxRef.current.close(); mixCtxRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const dur      = callDuration;
    const callCopy = { ...activeCall };
    const src      = recordingSource;

    setTimeout(async () => {
      const mime = audioChunksRef.current[0]?.type ?? "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mime });
      await saveCallRecord({ callCopy, dur, status, blobToAttach: blob.size > 500 ? blob : null, source: src });
    }, 400);

    setActiveCall(null);
    setIsRecording(false);
    setCallDuration(0);
    setAudioWarning("");
  }

  /* ── Save to store ── */
  async function saveCallRecord({ callCopy, dur, status, blobToAttach, source }: {
    callCopy: NonNullable<typeof activeCall>;
    dur: number; status: CallRecord["status"];
    blobToAttach: Blob | null; source?: string;
  }) {
    const newRec: CallRecord = await api.post<CallRecord>("/calls/logs", {
      customer_name: callCopy.customer, phone: callCopy.phone,
      agent_name: callCopy.agent || user?.full_name,
      sector: callCopy.sector, centre_id: callCopy.centre_id, centre_name: callCopy.centre_name,
      duration_secs: dur, status, notes: callCopy.notes || "",
      call_direction: "outbound", recording_source: source,
    }).then((r) => r.data as CallRecord).catch((): CallRecord => ({
      id: "loc_" + Date.now(),
      customer_name: callCopy.customer, phone: callCopy.phone,
      agent_name: callCopy.agent || user?.full_name || "Agent",
      sector: callCopy.sector, centre_id: callCopy.centre_id, centre_name: callCopy.centre_name,
      status, notes: callCopy.notes, duration_secs: dur,
      started_at: new Date().toISOString(), call_direction: "outbound",
      recording_source: (source ?? "mic") as any,
    }));

    if (blobToAttach) {
      const url = URL.createObjectURL(blobToAttach);
      blobMapRef.current.set(newRec.id, url);
      newRec.recordingBlob = url;
    }
    setRecords((prev) => { const u = [newRec, ...prev]; saveLocal(u); return u; });
  }

  /* ── Log missed ── */
  async function logMissed() {
    if (!newForm.phone) { alert("Enter phone number."); return; }
    await saveCallRecord({ callCopy: newForm, dur: 0, status: "missed", blobToAttach: null });
    setNewForm((f) => ({ ...f, customer: "", phone: "", notes: "" }));
    setShowNew(false);
  }

  /* ── Upload recording file ── */
  function triggerUpload(id: string) { setUploadingId(id); fileInputRef.current?.click(); }
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) { setUploadingId(null); return; }
    const url = URL.createObjectURL(file);
    uploadedRef.current.set(uploadingId, { url, name: file.name });
    setRecords((prev) => { const u = prev.map((r) => r.id === uploadingId ? { ...r, recordingBlob: url, recording_source: "uploaded" as any } : r); saveLocal(u); return u; });
    setUploadingId(null);
    e.target.value = "";
  }

  /* ── Delete ── */
  function deleteRecord(id: string) {
    if (!confirm("Delete this call record permanently?")) return;
    const u = records.filter((r) => r.id !== id);
    setRecords(u); saveLocal(u);
    blobMapRef.current.delete(id);
    api.delete(`/calls/logs/${id}`).catch(() => {});
  }

  /* ── Play ── */
  function playRecording(rec: CallRecord) {
    const url = uploadedRef.current.get(rec.id)?.url ?? blobMapRef.current.get(rec.id) ?? rec.recordingBlob;
    if (!url) return;
    if (playbackRef.current) { playbackRef.current.pause(); playbackRef.current = null; }
    if (playingId === rec.id) { setPlayingId(null); return; }
    const audio = new Audio(url);
    playbackRef.current = audio;
    audio.play().catch(() => setAudioError("Could not play. Make sure it's a valid audio file."));
    setPlayingId(rec.id);
    audio.onended = () => setPlayingId(null);
  }

  /* ── Cleanup ── */
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    mixCtxRef.current?.close();
  }, []);

  /* ── Filters ── */
  const allSectors = [...new Set(records.map((r) => r.sector ?? "").filter(Boolean))].sort();
  const allAgents  = [...new Set(records.map((r) => r.agent_name ?? "").filter(Boolean))].sort();
  const filtered   = records.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (sectorFilter !== "all" && (r.sector ?? "") !== sectorFilter) return false;
    if (agentFilter  !== "all" && (r.agent_name ?? "") !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![r.customer_name, r.phone, r.agent_name, r.sector].some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalCompleted = records.filter((r) => r.status === "completed").length;
  const totalMissed    = records.filter((r) => r.status === "missed").length;
  const totalDuration  = records.reduce((s, r) => s + (r.duration_secs ?? 0), 0);
  const sectorStats    = allSectors.map((sec) => {
    const recs = records.filter((r) => (r.sector ?? "") === sec);
    return { sec, total: recs.length, done: recs.filter((r) => r.status === "completed").length, missed: recs.filter((r) => r.status === "missed").length };
  }).sort((a, b) => b.total - a.total);

  const srcLabel = (src?: string) => src === "mixed" ? "🎤+🔊 Both" : src === "system" ? "🔊 System" : src === "mic" ? "🎤 Mic" : src === "uploaded" ? "⬆ Uploaded" : "—";

  /* ════════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tele Calling</h1>
          <p className="text-sm text-slate-500">
            Airtel: <span className="font-mono font-semibold text-green-700">+91 {AIRTEL_NO}</span> via Phone Link
            {isRecording && <span className="ml-3 inline-flex items-center gap-1 text-red-600 font-semibold"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Recording…</span>}
          </p>
        </div>
        {!activeCall && (
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setShowDeviceSetup(!showDeviceSetup)}
              className="rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              ⚙️ Audio Setup
            </button>
            <button type="button" onClick={() => setShowNew(true)}
              className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90">
              📞 New Call
            </button>
          </div>
        )}
      </div>

      {/* ── Phone Link / Mobile instruction banner ── */}
      {systemCaptureSupported ? (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🔗</span>
            <div className="flex-1">
              <p className="font-bold text-blue-800 text-sm">Phone Link Recording — How it works</p>
              <div className="mt-2 space-y-1 text-xs text-blue-700">
                <p>1. Click <strong>"New Call"</strong> → fill details → click <strong>"📞 Start Recording + Call"</strong></p>
                <p>2. Browser will ask: <strong>"Share screen/window/tab"</strong> — in that dialog, check <strong>"Also share system audio"</strong> checkbox at the bottom, then click Share</p>
                <p>3. Your phone dialer opens via Phone Link and the call starts — the app records <strong>both your mic AND the Phone Link audio</strong></p>
                <p>4. After the call, click <strong>"End Call"</strong> in the app — the recording saves automatically and plays back in the table</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📱</span>
            <div className="flex-1">
              <p className="font-bold text-green-800 text-sm">Mobile Recording — Mic Only Mode</p>
              <div className="mt-2 space-y-1 text-xs text-green-700">
                <p>1. Click <strong>"New Call"</strong> → fill in the customer details</p>
                <p>2. Tap <strong>"📞 Start Recording + Call"</strong> — allow microphone permission when prompted</p>
                <p>3. Your phone dialer opens — the app records <strong>your mic audio</strong> during the call</p>
                <p>4. After the call, tap <strong>"End Call"</strong> to save the recording</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Audio Setup panel ── */}
      {showDeviceSetup && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800">🎛 Audio Recording Setup</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Recording mode */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Recording Mode</label>
              <div className="space-y-2">
                {([
                  { value: "mixed",  icon: "🎤+🔊", label: "Both Mic + System Audio", desc: "Records your voice AND Phone Link call audio. Best quality.", recommended: true },
                  { value: "mic",    icon: "🎤",    label: "Microphone Only", desc: "Records only your voice. Simpler, no screen share prompt." },
                  { value: "system", icon: "🔊",    label: "System Audio Only", desc: "Records only Phone Link audio (other person's voice)." },
                ] as const).map((opt) => (
                  <label key={opt.value}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition ${recordingSource === opt.value ? "border-brand-purple bg-purple-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <input type="radio" name="recmode" value={opt.value} checked={recordingSource === opt.value}
                      onChange={() => setRecordingSource(opt.value)} className="mt-0.5 accent-brand-purple" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{opt.icon} {opt.label} {'recommended' in opt && opt.recommended && <span className="ml-1 rounded-full bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 font-bold">Recommended</span>}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {/* Microphone picker */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Microphone</label>
              <select value={selMicId} onChange={(e) => setSelMicId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                <option value="default">Default Microphone</option>
                {audioDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
              </select>
              <button type="button" onClick={() => listAudioDevices().then(setAudioDevices)}
                className="mt-1.5 text-xs text-brand-purple hover:underline">↺ Refresh devices</button>
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <p className="font-semibold mb-1">⚠️ For Phone Link to record both sides:</p>
                <ol className="space-y-1 list-decimal ml-3">
                  <li>Use <strong>"Both Mic + System Audio"</strong> mode</li>
                  <li>When the browser asks to share screen, choose <strong>any window</strong></li>
                  <li><strong>Check "Share system audio"</strong> at the bottom of that dialog</li>
                  <li>Phone Link audio plays through your PC speakers → gets captured</li>
                </ol>
              </div>
            </div>
          </div>
          {!systemCaptureSupported && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              ⚠️ Your browser may not support system audio capture. Use <strong>Google Chrome</strong> (version 105 or later) for best results.
            </div>
          )}
          <button type="button" onClick={() => setShowDeviceSetup(false)} className="rounded-xl border px-4 py-2 text-xs text-slate-600">Done</button>
        </div>
      )}

      {/* ── Errors / Warnings ── */}
      {audioError && (
        <div className="flex gap-3 rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          <span className="text-xl">🎤</span>
          <div className="flex-1"><p className="font-semibold">Audio Error</p><p className="mt-0.5 text-xs">{audioError}</p></div>
          <button type="button" onClick={() => setAudioError("")} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}
      {audioWarning && (
        <div className="flex gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700">
          <span className="text-xl">⚠️</span>
          <div className="flex-1"><p className="font-semibold">Recording Notice</p><p className="mt-0.5 text-xs">{audioWarning}</p></div>
        </div>
      )}

      {/* ── Active call ── */}
      {activeCall && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 p-5 text-white shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-3xl">
                📞
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-white" />
                </span>
              </div>
              <div>
                <p className="text-xl font-bold">{activeCall.customer || activeCall.phone}</p>
                <p className="text-white/70 text-sm font-mono">{activeCall.phone}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{activeCall.sector}</span>
                  {isRecording && (
                    <span className="flex items-center gap-1 text-xs rounded-full bg-red-500/30 border border-red-400/40 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-300 animate-pulse" />
                      {srcLabel(recordingSource)} recording
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-center">
                <p className="text-3xl font-mono font-bold tabular-nums">{fmtDur(callDuration)}</p>
                <p className="text-xs text-white/50">Duration</p>
              </div>
              <canvas ref={canvasRef} width={100} height={40} className="hidden sm:block rounded-xl bg-black/20" />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => endCall("completed")}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 shadow-lg">
                  ⏹ End Call + Save
                </button>
                <button type="button" onClick={() => endCall("missed")}
                  className="rounded-xl bg-black/20 px-4 py-1.5 text-xs font-medium text-white/70 hover:bg-black/30">
                  Mark as Missed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Call Form ── */}
      {showNew && !activeCall && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">New Call</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer Name</label>
              <input value={newForm.customer} onChange={(e) => setNewForm({ ...newForm, customer: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Phone Number *</label>
              <input type="tel" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                placeholder="9876543210"
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Agent</label>
              <select value={newForm.agent} onChange={(e) => setNewForm({ ...newForm, agent: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                <option value={user?.full_name ?? ""}>{user?.full_name ?? "Me"}</option>
                {employees.map((e) => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sector / Zone *</label>
              <select value={newForm.sector} onChange={(e) => {
                const ctr = centres.find((c) => c.name === e.target.value);
                setNewForm({ ...newForm, sector: e.target.value, centre_id: ctr?.id ?? "", centre_name: e.target.value });
              }} className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none">
                {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
              <input value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none" />
            </div>
          </div>

          {/* Recording mode quick select — only shown on desktop where getDisplayMedia is supported */}
          {systemCaptureSupported && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Record:</span>
            {(["mixed","mic","system"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setRecordingSource(m)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${recordingSource === m ? "bg-brand-purple text-white" : "border text-slate-500 hover:bg-slate-50"}`}>
                {m === "mixed" ? "🎤+🔊 Both" : m === "mic" ? "🎤 Mic only" : "🔊 System only"}
              </button>
            ))}
          </div>
          )}

          {recordingSource !== "mic" && (
            <div className="mt-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-700">
              📋 <strong>Next step:</strong> After clicking "Start Recording + Call", the browser will show a <strong>screen share dialog</strong>. Select any screen/window, then <strong>check "Share system audio"</strong> at the bottom of that dialog. This is what captures the Phone Link call audio.
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={startCall}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow">
              📞 Start Recording + Call (+91 {AIRTEL_NO})
            </button>
            <button type="button" onClick={logMissed}
              className="rounded-xl bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-200">
              Log Missed
            </button>
            <button type="button" onClick={() => setShowNew(false)}
              className="rounded-xl border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Calls",  value: records.length,    color: "bg-white ring-slate-200" },
          { label: "Completed",    value: totalCompleted,    color: "bg-green-50 ring-green-200" },
          { label: "Missed",       value: totalMissed,       color: "bg-red-50 ring-red-200" },
          { label: "Total Time",   value: fmtDur(totalDuration), color: "bg-purple-50 ring-purple-200" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-5 ring-1 shadow-sm ${color}`}>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Sector stats ── */}
      {sectorStats.length > 0 && (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-5 py-3"><p className="font-semibold text-slate-700 text-sm">📍 Sector-wise Summary</p></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
            {sectorStats.map((s) => (
              <div key={s.sec} className="bg-white px-4 py-3">
                <p className="font-semibold text-slate-800 text-sm truncate">{s.sec}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-slate-500">{s.total} calls</span>
                  <span className="text-xs text-green-600 font-medium">{s.done} ✓</span>
                  {s.missed > 0 && <span className="text-xs text-red-500">{s.missed} missed</span>}
                </div>
                {s.total > 0 && <div className="mt-1.5 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-purple" style={{ width: `${(s.done / s.total) * 100}%` }} /></div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-brand-purple focus:outline-none w-44" />
        {(["all","completed","missed"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "bg-brand-purple text-white shadow" : "bg-white border text-slate-500 hover:bg-slate-50"}`}>{f}</button>
        ))}
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
          className="rounded-xl border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple">
          <option value="all">All Sectors</option>
          {allSectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-xl border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple">
          <option value="all">All Agents</option>
          {allAgents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="ml-auto text-xs text-slate-400">{filtered.length} records</span>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <p className="font-semibold text-slate-700">Call Log & Recordings</p>
          <p className="text-xs text-slate-400">⬆ Upload mp3 · ▶ Play · {canDelete ? "🗑 Delete (Super Admin)" : ""}</p>
        </div>
        {loading ? (
          <p className="p-8 text-center text-slate-400 text-sm">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center"><p className="text-3xl mb-2">📞</p><p className="text-slate-400 text-sm">No calls yet.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">Sector</th>
                  <th className="px-4 py-3 text-left">Date & Time</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Recording</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  {canDelete && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const hasAudio = uploadedRef.current.has(r.id) || blobMapRef.current.has(r.id) || !!r.recordingBlob;
                  const dateStr  = r.started_at ? new Date(r.started_at).toLocaleString("en-IN") : (r.date ?? "—");
                  const durStr   = r.duration_secs != null ? fmtDur(r.duration_secs) : (r.duration ?? "—");
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.customer_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.phone}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.agent_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-purple border border-purple-100">
                          📍 {r.sector ?? r.centre_name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{dateStr}</td>
                      <td className="px-4 py-3 font-mono text-xs">{durStr}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === "completed" ? "bg-green-100 text-green-700" : r.status === "missed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[170px]">
                        {canHearRecordings ? (
                          <div className="flex flex-col gap-1">
                            {hasAudio ? (
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => playRecording(r)}
                                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${playingId === r.id ? "bg-red-100 text-red-700 animate-pulse" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                                  {playingId === r.id ? "⏹ Stop" : "▶ Play"}
                                </button>
                                <button type="button" onClick={() => triggerUpload(r.id)}
                                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200" title="Replace recording">↑</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => triggerUpload(r.id)}
                                className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-brand-purple/30 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-brand-purple hover:border-brand-purple/60 hover:bg-purple-100 transition">
                                ⬆ Upload mp3
                              </button>
                            )}
                            <p className="text-[10px] text-slate-400">{srcLabel(r.recording_source)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[140px] truncate">{r.notes || "—"}</td>
                      {canDelete && (
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => deleteRecord(r.id)}
                            className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-100">
                            🗑
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.aac,.opus"
        className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
