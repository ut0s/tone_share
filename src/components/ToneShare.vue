<script setup lang="ts">
import * as Tone from "tone";
import { onMounted, ref } from "vue";
import ShowWave from "./ShowWave.vue";

const playTone = async () => {
  const synth1 = new Tone.Synth({
    oscillator: {
      type: "sine", // サイン波を使用
    },
    envelope: {
      attack: 0.005, // 立ち上がり時間を短く
      decay: 0,
      sustain: 1, // 音量を維持
      release: 0.1, // リリース時間も短めに
    },
  }).toDestination();
  const synth2 = new Tone.Synth({
    oscillator: {
      type: "sine", // サイン波を使用
    },
    envelope: {
      attack: 0.005, // 立ち上がり時間を短く
      decay: 0,
      sustain: 1, // 音量を維持
      release: 0.1, // リリース時間も短めに
    },
  }).toDestination();

  await Tone.start();
  synth1.triggerAttackRelease(697, 0.2);
  synth2.triggerAttackRelease(1209, 0.2);
};
</script>

<template>
  <button
    @click="playTone"
    class="w-16 h-16 flex items-center justify-center text-xl font-medium text-gray-700 bg-white border border-gray-200 rounded-lg transition-colors duration-200 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    Play
  </button>
  <ShowWave />
</template>
