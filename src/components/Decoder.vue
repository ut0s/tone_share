<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from "vue";
import Goertzel from "goertzeljs";

const decodedText = ref("");
const isRecording = ref(false);
const errorMessage = ref("");
const inputLevel = ref(0);
const needsGesture = ref(false);

const AudioCtx =
  (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
let rafId: number | null = null;
let lastDetectedChar = "";
let lastDetectedAt = 0;
let retryTimer: number | null = null;
let gestureStarter: (() => void) | null = null;
const RETRY_MS = 5000;

const ROW_FREQS = [697, 770, 852, 941];
const COL_FREQS = [1209, 1336, 1477, 1633];
const DTMF_CHARS = [
  ["1", "2", "3", "A"],
  ["4", "5", "6", "B"],
  ["7", "8", "9", "C"],
  ["*", "0", "#", "D"],
];

const DETECTION_THRESHOLD = 0.12; // magnitude threshold
const MIN_REDETECT_GAP = 0.22; // seconds between same digit

const detectFrequency = (goertzel: any, freqs: number[]): number => {
  let maxVal = -Infinity;
  let maxIndex = -1;
  freqs.forEach((freq, index) => {
    const val = goertzel.getMagnitude(freq);
    if (val > maxVal) {
      maxVal = val;
      maxIndex = index;
    }
  });
  return maxIndex;
};

const updateInputLevel = (buffer: Float32Array) => {
  // Quick RMS for UI feedback
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sum += v * v;
  }
  const rms = Math.sqrt(sum / buffer.length);
  inputLevel.value = Math.min(1, rms * 4);
};

const stopLoop = () => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

const stopRecording = async () => {
  isRecording.value = false;
  stopLoop();
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }
  analyser = null;
  lastDetectedChar = "";
};

const startRecording = async () => {
  if (isRecording.value) return;
  errorMessage.value = "";
  needsGesture.value = false;
  decodedText.value = "";
  lastDetectedChar = "";
  lastDetectedAt = 0;

  try {
    audioContext = new AudioCtx();
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (e) {
        needsGesture.value = true;
        throw e;
      }
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0; // better temporal resolution
    source.connect(analyser);

    // drive the graph so analyser receives data without feedback to speakers
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    analyser.connect(silentGain);
    silentGain.connect(audioContext.destination);

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const goertzel = new Goertzel({
      frequencies: [...ROW_FREQS, ...COL_FREQS],
      sampleRate: audioContext.sampleRate,
    });

    isRecording.value = true;

    const loop = () => {
      if (!isRecording.value || !analyser) return;
      analyser.getFloatTimeDomainData(dataArray);
      updateInputLevel(dataArray);
      goertzel.process(dataArray);

      const rowIdx = detectFrequency(goertzel, ROW_FREQS);
      const colIdx = detectFrequency(goertzel, COL_FREQS);
      const now = audioContext!.currentTime;

      if (rowIdx !== -1 && colIdx !== -1) {
        const rowMag = goertzel.getMagnitude(ROW_FREQS[rowIdx]);
        const colMag = goertzel.getMagnitude(COL_FREQS[colIdx]);
        if (rowMag > DETECTION_THRESHOLD && colMag > DETECTION_THRESHOLD) {
          const char = DTMF_CHARS[rowIdx][colIdx];
          const enoughGap = now - lastDetectedAt > MIN_REDETECT_GAP;
          const isNewChar = char !== lastDetectedChar || enoughGap;
          if (isNewChar) {
            decodedText.value += char;
            lastDetectedChar = char;
            lastDetectedAt = now;
          }
        }
      } else {
        lastDetectedChar = ""; // reset latch when tone disappears
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
  } catch (err: any) {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      needsGesture.value = true;
      errorMessage.value = "マイクの権限が必要です。画面をタップして許可してください。";
    } else {
      errorMessage.value = err?.message || "マイクへのアクセスに失敗しました";
    }
    await stopRecording();
  }
};

const triggerWithGesture = async () => {
  errorMessage.value = "";
  needsGesture.value = false;
  await startRecording();
};

onMounted(() => {
  // Auto-start decoding without requiring a button gesture
  startRecording();
  // Retry periodically in case permission is granted later
  retryTimer = window.setInterval(() => {
    if (!isRecording.value) {
      startRecording();
    }
  }, RETRY_MS);

  // Attach a one-time gesture listener to satisfy Safari/iOS policies
  gestureStarter = () => {
    triggerWithGesture();
  };
  window.addEventListener("touchstart", gestureStarter, { once: true });
  window.addEventListener("mousedown", gestureStarter, { once: true });
});

onBeforeUnmount(stopRecording);
onBeforeUnmount(() => {
  if (retryTimer) {
    window.clearInterval(retryTimer);
    retryTimer = null;
  }
  if (gestureStarter) {
    window.removeEventListener("touchstart", gestureStarter);
    window.removeEventListener("mousedown", gestureStarter);
    gestureStarter = null;
  }
});
</script>

<template>
  <div class="flex flex-col gap-2 max-w-md">
    <h2 class="text-lg font-semibold">DTMF Decoder</h2>
    <div class="flex gap-2 text-sm items-center">
      <span class="badge" :class="isRecording ? 'badge-success' : 'badge-warning'">
        {{ isRecording ? '録音中' : '準備中' }}
      </span>
      <span v-if="!isRecording">マイクアクセスを許可してください</span>
    </div>
    <div class="flex gap-2" v-if="!isRecording">
      <button class="btn btn-sm btn-primary" @click="triggerWithGesture">再試行</button>
      <button
        class="btn btn-sm btn-secondary"
        v-if="needsGesture && !isRecording"
        @click="triggerWithGesture"
      >
        タップしてマイクを有効化
      </button>
    </div>
    <button
      class="btn btn-sm btn-primary w-fit"
      v-if="needsGesture && !isRecording"
      @click="triggerWithGesture"
    >
      タップしてマイクを有効化
    </button>
    <div class="flex items-center gap-2 text-sm">
      <span>Input Level</span>
      <div class="flex-1 h-2 bg-base-200 rounded">
        <div
          class="h-2 bg-success rounded"
          :style="{ width: `${Math.round(inputLevel * 100)}%` }"
        ></div>
      </div>
      <span>{{ Math.round(inputLevel * 100) }}%</span>
    </div>
    <div class="text-sm">Decoded: {{ decodedText }}</div>
    <div class="text-sm text-error" v-if="errorMessage">{{ errorMessage }}</div>
  </div>
</template>
