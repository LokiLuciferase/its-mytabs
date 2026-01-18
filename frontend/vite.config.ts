import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { alphaTab } from "@coderline/alphatab/vite";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;

// https://vite.dev/config/
export default defineConfig({
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
    plugins: [
        vue(),
        alphaTab({
            alphaTabSourceDir: "node_modules/@coderline/alphatab/dist",
        }),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: "auto",
            includeAssets: ["favicon.ico"],
            manifest: {
                name: "It's MyTabs",
                short_name: "MyTabs",
                description: "Browse and play tabs in It's MyTabs.",
                start_url: "/",
                scope: "/",
                display: "standalone",
                background_color: "#121823",
                theme_color: "#121823",
                icons: [
                    {
                        src: "/icons/pwa-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/icons/pwa-512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/icons/pwa-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            workbox: {
                navigateFallback: "/index.html",
            },
        }),
        viteCompression({
            algorithm: "gzip",
            filter: viteCompressionFilter,
        }),
        // https://github.com/denoland/deno/issues/30430
        // Deno 2.4.4 issue, temporarily disable brotli
        /* viteCompression({
            algorithm: "brotliCompress",
            filter: viteCompressionFilter,
        }),*/
        visualizer({
            filename: "../data/stats.html",
        }),
    ],

    server: {
        host: "0.0.0.0",
    },
});
