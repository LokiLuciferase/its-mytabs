<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { baseURL, checkFetch, generalError } from "../app.js";
import { isLoggedIn } from "../auth-client.js";

export default defineComponent({
    data() {
        return {
            tabList: [],
            ready: false,
            artistName: "",
            newArtistName: "",
            isLoggedIn: false,
            isSaving: false,
            isEditing: false,
            artistSlug: "",
            pageSize: 50,
            displayLimit: 50,
            observer: null,
        };
    },
    computed: {
        filteredTabs() {
            const artistKey = this.artistSlug;
            return this.tabList.filter((tab) => {
                const tabArtist = this.slugify(tab.artist || "Unknown Artist");
                return tabArtist === artistKey;
            });
        },
        visibleTabs() {
            return this.filteredTabs.slice(0, this.displayLimit);
        },
    },
    async mounted() {
        await this.ensureLogin();
        await this.load();
    },
    watch: {
        "$route.params.name": {
            async handler() {
                await this.load();
            },
        },
    },
    methods: {
        slugify(value) {
            return (value || "")
                .toString()
                .normalize("NFKD")
                .replace(/&/g, " and ")
                .replace(/[^\w\s-]/g, "")
                .trim()
                .toLowerCase()
                .replace(/[\s_-]+/g, "-")
                .replace(/^-+|-+$/g, "");
        },
        async ensureLogin() {
            this.isLoggedIn = await isLoggedIn();
            if (!this.isLoggedIn) {
                this.$router.push("/login");
            }
        },
        decodeArtistName() {
            const raw = this.$route.params.name;
            if (typeof raw !== "string") {
                return "";
            }
            try {
                return decodeURIComponent(raw);
            } catch {
                return raw;
            }
        },
        async load() {
            this.artistSlug = this.decodeArtistName();
            try {
                const res = await fetch(baseURL + "/api/tabs", { credentials: "include" });
                await checkFetch(res);
                const data = await res.json();
                this.tabList = data.tabs;
                const match = this.filteredTabs[0];
                this.artistName = match?.artist || this.artistSlug;
                this.newArtistName = this.artistName;
                this.isEditing = false;
                this.ready = true;
                this.displayLimit = this.pageSize;
                await this.$nextTick();
                this.setupObserver();
            } catch (error) {
                notify({
                    text: error.message,
                    type: "error",
                });
            }
        },
        setupObserver() {
            if (this.observer) {
                this.observer.disconnect();
            }
            const target = this.$refs.scrollSentinel;
            if (!target || typeof IntersectionObserver === "undefined") {
                return;
            }
            this.observer = new IntersectionObserver((entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    this.displayLimit = Math.min(
                        this.displayLimit + this.pageSize,
                        this.filteredTabs.length,
                    );
                }
            }, {
                rootMargin: "200px",
            });
            this.observer.observe(target);
        },
        async updateArtistName() {
            const updatedName = this.newArtistName.trim();
            if (!updatedName) {
                notify({ text: "Artist name cannot be empty", type: "error" });
                return;
            }
            if (updatedName === this.artistName) {
                this.isEditing = false;
                return;
            }
            if (this.filteredTabs.length === 0) {
                notify({ text: "No tabs found for this artist", type: "error" });
                return;
            }

            this.isSaving = true;
            try {
                await Promise.all(
                    this.filteredTabs.map(async (tab) => {
                        const res = await fetch(baseURL + `/api/tab/${tab.id}`, {
                            method: "POST",
                            credentials: "include",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                title: tab.title,
                                artist: updatedName,
                                type: tab.type,
                                public: tab.public,
                            }),
                        });
                        await checkFetch(res);
                    }),
                );

                notify({
                    text: "Artist name updated successfully",
                    type: "success",
                });

                this.artistName = updatedName;
                this.newArtistName = updatedName;
                this.artistSlug = this.slugify(updatedName);
                await this.load();
                this.$router.replace(`/artist/${this.artistSlug}`);
            } catch (error) {
                generalError(error);
            } finally {
                this.isSaving = false;
                this.isEditing = false;
            }
        },
        cancelEdit() {
            this.newArtistName = this.artistName;
            this.isEditing = false;
        },
        startEdit() {
            this.isEditing = true;
            this.$nextTick(() => {
                this.$refs.artistNameInput?.focus();
                this.$refs.artistNameInput?.select();
            });
        },
        async deleteTab(id, title) {
            if (!confirm(`Are you sure you want to delete ${title}?`)) return;
            try {
                const res = await fetch(baseURL + `/api/tab/${id}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                await checkFetch(res);
                this.tabList = this.tabList.filter((tab) => tab.id !== id);
                notify({ text: "Tab deleted successfully", type: "success" });
            } catch (error) {
                generalError(error);
            }
        },
    },
    async beforeUnmount() {
        if (this.observer) {
            this.observer.disconnect();
        }
    },
});
</script>

<template>
    <div class="container my-container" v-if="ready">
        <div class="mt-4 mb-4">
            <router-link to="/" class="btn btn-secondary">Back to Tabs</router-link>
        </div>

        <div class="artist-header mb-3">
            <div class="artist-title">
                <input
                    v-if="isEditing"
                    id="artistName"
                    ref="artistNameInput"
                    type="text"
                    class="form-control artist-input"
                    v-model="newArtistName"
                    :disabled="isSaving"
                    @keyup.enter="updateArtistName"
                    @keyup.esc="cancelEdit"
                />
                <h2 v-else>{{ artistName }}</h2>
            </div>
            <div class="artist-actions">
                <button
                    v-if="!isEditing"
                    class="btn btn-sm btn-outline-secondary"
                    type="button"
                    @click="startEdit"
                    aria-label="Edit artist name"
                >
                    ✎
                </button>
                <template v-else>
                    <button
                        class="btn btn-sm btn-primary"
                        :disabled="isSaving"
                        @click="updateArtistName"
                    >
                        {{ isSaving ? "Saving..." : "Save" }}
                    </button>
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        :disabled="isSaving"
                        @click="cancelEdit"
                    >
                        Cancel
                    </button>
                </template>
            </div>
        </div>

        <div class="mb-3">
            Tabs for this artist: {{ filteredTabs.length }}
        </div>

        <table v-if="filteredTabs.length" class="table tab-table">
            <thead>
                <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Type</th>
                    <th scope="col" class="text-end">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="tab in visibleTabs" :key="tab.id">
                    <td>
                        <router-link :to="`/tab/${tab.id}`" class="tab-link">
                            {{ tab.title }}
                        </router-link>
                    </td>
                    <td>{{ tab.type }}</td>
                    <td class="text-end">
                        <button
                            class="btn btn-secondary me-2"
                            @click="$router.push(`/tab/${tab.id}/edit/info`)"
                        >
                            Edit
                        </button>
                        <button
                            class="btn btn-danger"
                            @click="deleteTab(tab.id, tab.title)"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
        <div
            ref="scrollSentinel"
            class="scroll-sentinel"
            v-if="filteredTabs.length"
        ></div>
    </div>
</template>

<style scoped lang="scss">
.artist-header {
    display: flex;
    align-items: center;
    gap: 10px;
}

.artist-title {
    display: flex;
    align-items: center;
}

.artist-input {
    max-width: 420px;
}

.tab-table {
    width: 100%;
}

.tab-link {
    color: inherit;
    text-decoration: none;
}

.tab-link:hover {
    text-decoration: underline;
}

.scroll-sentinel {
    height: 1px;
}
</style>
