---
layout: home

hero:
  name: "Tone Share"
  text: "トーンで共有する"
  tagline: "LAN(Local Audio Network)で音を使ってテキスト/URL/ファイルを共有"
  actions:
    - theme: brand
      text: Markdownの例
      link: /ja/markdown-examples
    - theme: alt
      text: APIの例
      link: /ja/api-examples

features:
  - title: "送信"
    details: "テキストを音に変換して再生します"
  - title: "受信"
    details: "マイクから音を解析してテキストを復元します"
  - title: "ローカルネットワーク感"
    details: "同じ場所にいる相手に“音”で渡せます"
---

<script setup>
import ToneShare from '../../src/components/ToneShare.vue'
</script>

# デモ

<ToneShare />
