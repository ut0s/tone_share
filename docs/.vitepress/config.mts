import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "Tone Share",
  description: "Share URL/File by Tone in LAN(Local Audio Network)",
  cleanUrls: true,
  assetsDir: "assets",

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      link: "/",
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      link: "/ja/",
      title: "Tone Share",
      description: "LAN(Local Audio Network)で音を使ってURL/ファイルを共有",
      themeConfig: {
        logo: "/logo.png",
        nav: [
          { text: "使い方", link: "/ja/readme" },
          { text: "更新履歴", link: "/ja/changelog" },
        ],
        sidebar: [
          {
            text: "例",
            items: [
              { text: "Webアプリ版", link: "/ja/app" },
              {
                text: "Chrome拡張版",
                link: "https://chromewebstore.google.com",
              },
              { text: "参考", link: "/ja/reference" },
            ],
          },
        ],
        socialLinks: [
          { icon: "github", link: "https://github.com/vuejs/vitepress" },
        ],
      },
    },
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/logo.png",
    nav: [
      { text: "How to use", link: "/readme" },
      { text: "Changelog", link: "/changelog" },
    ],

    sidebar: [
      {
        text: "Examples",
        items: [
          { text: "Web app ver.", link: "/app" },
          {
            text: "Chrome Extension ver.",
            link: "https://chromewebstore.google.com",
          },
          { text: "Reference", link: "/reference" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/vuejs/vitepress" },
    ],
  },
});
