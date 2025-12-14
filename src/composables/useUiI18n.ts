import { computed } from "vue";
import { useData } from "vitepress";

const messages = {
  en: {
    status_loading: "Loading ggwave module...",
    status_ready: "ggwave ready",
    status_receiving: "Receiving",
    status_stopped: "Stopped",
    status_send_done_prefix: 'Sent: "',
    status_send_done_suffix: '"',

    badge_receiving: "Receiving",
    badge_stopped: "Stopped",
    badge_sending: "Sending",
    badge_standby: "Standby",

    gesture_warning:
      "Some browsers require a button click to start audio playback/recording.",

    label_send_message: "Message to send",
    placeholder_message: "Type text",
    label_protocol: "Protocol",
    label_volume: "Volume",
    button_play_and_send: "Play & Send",
    button_start_receiving: "Start receiving",
    button_stop_receiving: "Stop receiving",
    label_input_level: "Input level",
    heading_receive_log: "Received",
    text_not_received_yet: "No messages received yet",

    error_ggwave_load_failed: "Failed to load ggwave",
    error_send_failed: "Failed to send",
    error_mic_failed: "Failed to access microphone",
    error_audio_context_unavailable: "AudioContext is not available",

    showwave_title_time: "Waveform",
    showwave_title_fft: "Spectrum",
    showwave_chart_title_time: "Waveform",
    showwave_chart_title_fft: "Spectrum (log scale)",
  },
  ja: {
    status_loading: "ggwaveモジュールを読み込み中...",
    status_ready: "ggwave準備完了",
    status_receiving: "受信中",
    status_stopped: "停止中",
    status_send_done_prefix: '送信完了: "',
    status_send_done_suffix: '"',

    badge_receiving: "受信中",
    badge_stopped: "停止中",
    badge_sending: "送信中",
    badge_standby: "待機",

    gesture_warning: "音声の再生/録音を開始するには、ボタン操作が必要な場合があります。",

    label_send_message: "送信メッセージ",
    placeholder_message: "テキストを入力",
    label_protocol: "プロトコル",
    label_volume: "音量",
    button_play_and_send: "再生して送信",
    button_start_receiving: "受信開始",
    button_stop_receiving: "受信停止",
    label_input_level: "入力レベル",
    heading_receive_log: "受信ログ",
    text_not_received_yet: "まだ受信していません",

    error_ggwave_load_failed: "ggwaveの読み込みに失敗しました",
    error_send_failed: "送信に失敗しました",
    error_mic_failed: "マイクの取得に失敗しました",
    error_audio_context_unavailable: "AudioContext が利用できません",

    showwave_title_time: "時間波形",
    showwave_title_fft: "周波数スペクトラム",
    showwave_chart_title_time: "時間波形",
    showwave_chart_title_fft: "周波数スペクトラム（対数スケール）",
  },
} as const;

type LocaleKey = keyof typeof messages;
type MessageKey = keyof (typeof messages)["en"];

export const useUiI18n = () => {
  const { lang } = useData();
  const locale = computed<LocaleKey>(() => (lang.value.startsWith("ja") ? "ja" : "en"));
  const t = (key: MessageKey): string => messages[locale.value][key];
  return { locale, t };
};

