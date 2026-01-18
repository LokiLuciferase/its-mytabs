<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { baseURL } from "../app.js";
import { isLoggedIn } from "../auth-client.js";
import { slugify } from "../utils/slugify.ts";

export default defineComponent({
    data() {
        return {
            tabList: [],
            ready: false,
            isLoggedIn: false,
        };
    },
    computed: {
        artistList() {
            const artistMap = new Map();
            this.tabList.forEach((tab) => {
                const name = tab?.artist || "Unknown Artist";
                const key = slugify(name);
                if (!artistMap.has(key)) {
                    artistMap.set(key, { name, key });
                }
            });
            return Array.from(artistMap.values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
        },
    },
    async mounted() {
        this.isLoggedIn = await isLoggedIn();
        if (!this.isLoggedIn) {
            this.$router.push("/login");
            return;
        }

        try {
            const res = await fetch(baseURL + "/api/tabs", { credentials: "include" });
            const data = await res.json();
            this.tabList = data.tabs;
            this.ready = true;
        } catch (error) {
            notify({
                text: error.message,
                type: "error",
            });
        }
    },
});
</script>

<template>
    <div class="container my-container">
        <h1 class="mt-4 mb-4">Artists</h1>
        <div v-if="ready && artistList.length" class="artist-grid">
            <router-link
                v-for="artist in artistList"
                :key="artist.key"
                :to="`/artist/${artist.key}`"
                class="artist-card"
            >
                {{ artist.name }}
            </router-link>
        </div>
        <div v-else-if="ready" class="empty-state text-center py-5 mb-4 fs-5">
            <p class="text-muted">No artists found.</p>
        </div>
    </div>
</template>

<style scoped lang="scss">
.artist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
}

.artist-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 90px;
    padding: 14px 18px;
    border-radius: 12px;
    background: #1d1d1f;
    border: 1px solid #2c2c30;
    color: #d6d6d6;
    text-align: center;
    transition: transform 0.15s ease, border-color 0.15s ease;
}

.artist-card:hover {
    transform: translateY(-2px);
    border-color: #3c3b40;
}

[data-bs-theme="light"] .artist-card {
    background: #ffffff;
    border-color: #d6d6d6;
    color: #1f1f1f;
}
</style>
