<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const timeChartRef = ref<HTMLCanvasElement | null>(null);
const fftChartRef = ref<HTMLCanvasElement | null>(null);
let timeChart: Chart | null = null;
let fftChart: Chart | null = null;
let audioContext: AudioContext;
let analyser: AnalyserNode;
let dataArray: Uint8Array;
let fftDataArray: Uint8Array;
let animationId: number;

const initializeAudio = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();

    source.connect(analyser);
    analyser.fftSize = 4096;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    fftDataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (err) {
    console.error("マイクの取得に失敗:", err);
  }
};

const createFrequencyLabels = (
  binCount: number,
  sampleRate: number,
  fftSize: number,
): string[] => {
  const frequencies: string[] = [];
  for (let i = 0; i < binCount; i++) {
    const freq = Math.round((i * sampleRate) / (fftSize * 2));
    frequencies.push(freq.toString());
  }
  return frequencies;
};

const createCharts = () => {
  if (!timeChartRef.value || !fftChartRef.value || !analyser) return;

  const labels = Array.from({ length: analyser.frequencyBinCount }, (_, i) =>
    i.toString(),
  );

  // 時間波形のグラフ
  timeChart = new Chart(timeChartRef.value, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "時間波形",
          data: Array(analyser.frequencyBinCount).fill(128),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: {
          min: 0,
          max: 255,
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "時間波形",
        },
      },
    },
  });

  // FFTスペクトラムのグラフ
  fftChart = new Chart(fftChartRef.value, {
    type: "bar",
    data: {
      labels: createFrequencyLabels(
        analyser.frequencyBinCount,
        audioContext.sampleRate,
        analyser.fftSize,
      ),
      datasets: [
        {
          label: "FFTスペクトラム",
          data: Array(analyser.frequencyBinCount).fill(0),
          backgroundColor: "rgb(153, 102, 255)",
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: {
          type: "logarithmic",
          min: 200,
          max: 3000,
          ticks: {
            callback: (value) => {
              const freq = Number(value);
              if (
                [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].includes(freq)
              ) {
                return freq + "Hz";
              }
              return "";
            },
          },
        },
        y: {
          min: 0,
          max: 255,
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "周波数スペクトラム（対数スケール）",
        },
      },
    },
  });
};

const updateCharts = () => {
  if (!timeChart || !fftChart || !analyser) return;

  // 時間波形の更新
  analyser.getByteTimeDomainData(dataArray);
  timeChart.data.datasets[0].data = Array.from(dataArray);
  timeChart.update("none");

  // FFTスペクトラムの更新
  analyser.getByteFrequencyData(fftDataArray);
  fftChart.data.datasets[0].data = Array.from(fftDataArray);
  fftChart.update("none");

  animationId = requestAnimationFrame(updateCharts);
};

onMounted(async () => {
  await initializeAudio();
  createCharts();
  updateCharts();
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  if (audioContext) {
    audioContext.close();
  }
  if (timeChart) {
    timeChart.destroy();
  }
  if (fftChart) {
    fftChart.destroy();
  }
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="flex flex-row gap-6 w-full max-w-3xl items-center justify-center"
    >
      <div class="chart-block">
        <h3 class="text-lg font-semibold text-gray-700 mb-2">時間波形</h3>
        <div
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-[200px]"
        >
          <canvas ref="timeChartRef"></canvas>
        </div>
      </div>

      <div class="chart-block">
        <h3 class="text-lg font-semibold text-gray-700 mb-2">
          周波数スペクトラム
        </h3>
        <div
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-[200px]"
        >
          <canvas ref="fftChartRef"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Chart.jsの responsive オプションを活かすためのスタイル */
.chart-block {
  @apply w-full;
}
</style>
