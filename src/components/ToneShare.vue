<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useUiI18n } from "../composables/useUiI18n";

const message = ref("hello ggwave");
const decodedMessages = ref<string[]>([]);
const isSending = ref(false);
const isReceiving = ref(false);
const { t } = useUiI18n();
const statusText = ref(t("status_loading"));
const errorMessage = ref("");
const inputLevel = ref(0);
const needsGesture = ref(false);
const txVolume = ref(10);
const txProtocolKey = ref<
  | "GGWAVE_PROTOCOL_AUDIBLE_NORMAL"
  | "GGWAVE_PROTOCOL_AUDIBLE_FAST"
  | "GGWAVE_PROTOCOL_AUDIBLE_FASTEST"
  | "GGWAVE_PROTOCOL_ULTRASOUND_NORMAL"
  | "GGWAVE_PROTOCOL_ULTRASOUND_FAST"
  | "GGWAVE_PROTOCOL_ULTRASOUND_FASTEST"
>("GGWAVE_PROTOCOL_AUDIBLE_NORMAL");

let audioContext: AudioContext | null = null;
let ggwaveModule: any = null;
let ggwaveInstance: any = null;
let micStream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;
let silentGain: GainNode | null = null;

const textDecoder = new TextDecoder();

const toInt8Bytes = (src: Float32Array): Int8Array => {
  // ggwave's JS example passes Float32 PCM as raw bytes via Int8Array.
  const copy = new Float32Array(src);
  return new Int8Array(copy.buffer);
};

const toFloat32Samples = (src: Int8Array): Float32Array => {
  // ggwave.encode() returns an Int8Array view over Float32 samples (raw bytes).
  const buf = src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength);
  return new Float32Array(buf);
};

const getAudioContextCtor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  return ((window as any).AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined
    | null;
};

const ensureAudioContext = async () => {
  if (!audioContext) {
    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) throw new Error(t("error_audio_context_unavailable"));
    try {
      audioContext = new AudioCtx({ sampleRate: 48000 } as any);
    } catch {
      audioContext = new AudioCtx();
    }
  }
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
      needsGesture.value = false;
    } catch (e) {
      // Safari/iOS may require a user gesture to resume AudioContext.
      needsGesture.value = true;
      throw e;
    }
  }
  return audioContext;
};

const loadGGWave = async () => {
  if (ggwaveModule && ggwaveInstance) return;
  try {
    // ggwave provides a factory function as the default export.
    const factoryModule: any = await import("ggwave");
    const factory = factoryModule.default || factoryModule;
    ggwaveModule = await factory();

    const ctx = await ensureAudioContext();
    const params = ggwaveModule.getDefaultParameters();
    // Align sample rates with the current AudioContext when possible.
    if (typeof params.sampleRateInp === "number") params.sampleRateInp = ctx.sampleRate;
    if (typeof params.sampleRateOut === "number") params.sampleRateOut = ctx.sampleRate;
    if (typeof params.sampleRate === "number") params.sampleRate = ctx.sampleRate;

    ggwaveInstance = ggwaveModule.init(params);
    statusText.value = t("status_ready");
  } catch (err: any) {
    errorMessage.value = err?.message || t("error_ggwave_load_failed");
    statusText.value = t("error_ggwave_load_failed");
    throw err;
  }
};

const updateInputLevel = (buffer: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sum / buffer.length);
  inputLevel.value = Math.min(1, rms * 6);
};

const playWaveform = async (waveform: Int8Array) => {
  const ctx = await ensureAudioContext();
  const samples = toFloat32Samples(waveform);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);
  await new Promise<void>((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start(0);
  });
};

const sendMessage = async () => {
  if (isSending.value) return;
  const payload = message.value.trim();
  if (!payload) return;
  errorMessage.value = "";
  needsGesture.value = false;
  try {
    isSending.value = true;
    await loadGGWave();
    const wasReceiving = isReceiving.value;
    if (wasReceiving) await stopReceiving();
    const protocolId = ggwaveModule.ProtocolId[txProtocolKey.value];
    const waveform: Int8Array = ggwaveModule.encode(
      ggwaveInstance,
      payload,
      protocolId,
      txVolume.value,
    );
    await playWaveform(waveform);
    if (wasReceiving) {
      await startReceiving();
    }
    statusText.value =
      t("status_send_done_prefix") + payload + t("status_send_done_suffix");
  } catch (err: any) {
    errorMessage.value = err?.message || t("error_send_failed");
  } finally {
    isSending.value = false;
  }
};

const stopReceiving = async () => {
  if (processor) {
    processor.disconnect();
    processor.onaudioprocess = null;
    processor = null;
  }
  if (silentGain) {
    silentGain.disconnect();
    silentGain = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  isReceiving.value = false;
  inputLevel.value = 0;
};

const startReceiving = async () => {
  if (isReceiving.value) return;
  errorMessage.value = "";
  needsGesture.value = false;
  await loadGGWave();

  try {
    const ctx = await ensureAudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const source = ctx.createMediaStreamSource(micStream);
    processor = ctx.createScriptProcessor(1024, 1, 1);
    silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (!ggwaveInstance) return;
      const input = event.inputBuffer.getChannelData(0);
      updateInputLevel(input);
      const bytes = toInt8Bytes(input);
      const res: Uint8Array = ggwaveModule.decode(ggwaveInstance, bytes);
      if (res && res.length > 0) {
        const text = textDecoder.decode(res);
        decodedMessages.value.unshift(text);
      }
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);
    isReceiving.value = true;
    statusText.value = t("status_receiving");
  } catch (err: any) {
    errorMessage.value = err?.message || t("error_mic_failed");
    await stopReceiving();
  }
};

onMounted(() => {
  // Best-effort auto start; browsers may still require a user gesture.
  startReceiving().catch(() => undefined);
});

onBeforeUnmount(() => {
  stopReceiving();
  if (ggwaveModule && ggwaveInstance != null) {
    try {
      ggwaveModule.free(ggwaveInstance);
    } catch {
      // ignore
    }
  }
});

const toggleReceiving = async () => {
  if (isReceiving.value) {
    await stopReceiving();
    statusText.value = t("status_stopped");
    return;
  }
  await startReceiving();
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3 max-w-xl">
      <div class="flex items-center gap-2 text-sm">
        <span class="badge" :class="isReceiving ? 'badge-success' : 'badge-ghost'">
          {{ isReceiving ? "受信中" : "停止中" }}
        </span>
        <span class="badge" :class="isSending ? 'badge-info' : 'badge-ghost'">
          {{ isSending ? "送信中" : "待機" }}
        </span>
        <span class="opacity-70">{{ statusText }}</span>
      </div>
      <div v-if="needsGesture" class="alert alert-warning text-sm">
        音声の再生/録音を開始するには、ボタン操作が必要な場合があります。
      </div>
      <div class="text-sm text-error" v-if="errorMessage">{{ errorMessage }}</div>

      <label class="text-sm font-medium" for="message">送信メッセージ</label>
      <input
        id="message"
        class="input input-bordered"
        v-model="message"
        placeholder="テキストを入力"
      />

      <div class="flex items-center gap-3">
        <label for="txProtocol" class="text-sm whitespace-nowrap">プロトコル</label>
        <select id="txProtocol" class="select select-bordered w-full" v-model="txProtocolKey">
          <option value="GGWAVE_PROTOCOL_AUDIBLE_FAST">Audible Fast</option>
          <option value="GGWAVE_PROTOCOL_AUDIBLE_FASTEST">Audible Fastest</option>
          <option value="GGWAVE_PROTOCOL_AUDIBLE_NORMAL">Audible Normal</option>
          <!-- <option value="GGWAVE_PROTOCOL_ULTRASOUND_NORMAL">Ultrasound Normal</option>
          <option value="GGWAVE_PROTOCOL_ULTRASOUND_FAST">Ultrasound Fast</option>
          <option value="GGWAVE_PROTOCOL_ULTRASOUND_FASTEST">Ultrasound Fastest</option> -->
        </select>
      </div>

      <div class="flex items-center gap-3">
        <label for="txVolume" class="text-sm whitespace-nowrap">音量</label>
        <input
          id="txVolume"
          type="range"
          min="5"
          max="100"
          step="5"
          class="range range-primary w-full"
          v-model.number="txVolume"
        />
        <span class="text-sm tabular-nums w-10 text-right">{{ txVolume }}</span>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary" :disabled="isSending" @click="sendMessage">
          再生して送信
        </button>
        <button class="btn" :class="isReceiving ? 'btn-warning' : 'btn-secondary'" @click="toggleReceiving">
          {{ isReceiving ? "受信停止" : "受信開始" }}
        </button>
      </div>

      <div class="flex items-center gap-3 text-sm">
        <span class="whitespace-nowrap">入力レベル</span>
        <progress class="progress progress-accent w-full" :value="inputLevel" max="1"></progress>
        <span class="tabular-nums w-10 text-right">{{ Math.round(inputLevel * 100) }}%</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 max-w-xl">
      <h3 class="text-base font-semibold">受信ログ</h3>
      <div v-if="decodedMessages.length === 0" class="text-sm opacity-70">
        まだ受信していません
      </div>
      <ul v-else class="menu bg-base-100 rounded-box border border-base-300">
        <li v-for="(m, i) in decodedMessages" :key="i">
          <a class="font-mono text-sm break-all">{{ m }}</a>
        </li>
      </ul>
    </div>

    <!-- <ShowWave /> -->
  </div>
</template>
