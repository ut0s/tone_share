import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "Tone Share",
  description: "Share URL/File by Tone in LAN(Local Audio Network)",
  cleanUrls: true,
  assetsDir: "assets",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/logo.png",
    nav: [
      { text: "Home", link: "/" },
      { text: "How to use", link: "/readme" },
      { text: "Changelog", link: "/changelog" },
      // { text: "Examples", link: "/markdown-examples" },
      { text: "Resources", link: "/resource" },
    ],

    sidebar: [
      {
        text: "Examples",
        items: [
          { text: "Markdown Examples", link: "/markdown-examples" },
          { text: "Runtime API Examples", link: "/api-examples" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/vuejs/vitepress" },
    ],
  },
});
