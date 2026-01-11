<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { baseURL, checkFetch, generalError } from "../app.js";
import { isLoggedIn } from "../auth-client.js";
import { tabTypeList } from "../../../backend/common.js";

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
            actionsTabId: null,
            sortKey: "createdAt",
            sortDir: "desc",
            selectedType: "",
            selectedFormat: "",
            tabTypeList,
            showScrollTop: false,
        };
    },
    computed: {
        baseTabs() {
            const artistKey = this.artistSlug;
            return this.tabList.filter((tab) => {
                const tabArtist = this.slugify(tab.artist || "Unknown Artist");
                return tabArtist === artistKey;
            });
        },
        filteredTabs() {
            return this.baseTabs.filter((tab) => {
                if (this.selectedType && tab.type !== this.selectedType) {
                    return false;
                }
                if (this.selectedFormat && this.formatFilterKey(tab) !== this.selectedFormat) {
                    return false;
                }
                return true;
            });
        },
        sortedTabs() {
            const list = [...this.filteredTabs];
            const key = this.sortKey;
            const dir = this.sortDir === "asc" ? 1 : -1;
            list.sort((a, b) => {
                if (key === "createdAt") {
                    const aValue = new Date(a?.createdAt || 0).getTime();
                    const bValue = new Date(b?.createdAt || 0).getTime();
                    return (aValue - bValue) * dir;
                }
                const aValue = (a?.[key] || "").toString();
                const bValue = (b?.[key] || "").toString();
                return aValue.localeCompare(bValue) * dir;
            });
            return list;
        },
        visibleTabs() {
            return this.sortedTabs.slice(0, this.displayLimit);
        },
    },
    async mounted() {
        await this.ensureLogin();
        await this.load();
        this.onScroll();
        window.addEventListener("scroll", this.onScroll, { passive: true });
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
        formatLabel(tab) {
            const ext = this.formatKey(tab);
            const map = {
                txt: "Plain Text",
                pdf: "PDF",
                gp: "GuitarPro",
                gpx: "GuitarPro",
                gp3: "GuitarPro",
                gp4: "GuitarPro",
                gp5: "GuitarPro",
                musicxml: "MusicXML",
                capx: "Capella",
            };
            return map[ext] || ext.toUpperCase() || "Unknown";
        },
        formatKey(tab) {
            const name = tab?.filename || "";
            return name.split(".").pop()?.toLowerCase() || "";
        },
        formatFilterKey(tab) {
            const ext = this.formatKey(tab);
            if (["gp", "gpx", "gp3", "gp4", "gp5"].includes(ext)) {
                return "guitarpro";
            }
            return ext;
        },
        formatDate(value) {
            if (!value) {
                return "Unknown";
            }
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return "Unknown";
            }
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "2-digit",
            });
        },
        resetFilters() {
            this.selectedType = "";
            this.selectedFormat = "";
        },
        getTabById(id) {
            return this.filteredTabs.find((tab) => tab.id === id) || null;
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
                this.onScroll();
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
        onScroll() {
            this.showScrollTop = window.scrollY > 200;
        },
        scrollToTop() {
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        setSort(key) {
            if (this.sortKey === key) {
                this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
                return;
            }
            this.sortKey = key;
            this.sortDir = key === "createdAt" ? "desc" : "asc";
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
    watch: {
        selectedType() {
            this.displayLimit = this.pageSize;
            this.$nextTick(() => this.setupObserver());
        },
        selectedFormat() {
            this.displayLimit = this.pageSize;
            this.$nextTick(() => this.setupObserver());
        },
    },
    beforeUnmount() {
        if (this.observer) {
            this.observer.disconnect();
        }
        window.removeEventListener("scroll", this.onScroll);
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

        <div class="filters mb-3">
            <select class="form-select" v-model="selectedType" aria-label="Filter by type">
                <option value="">All types</option>
                <option v-for="type in tabTypeList" :key="type" :value="type">
                    {{ type }}
                </option>
            </select>
            <select class="form-select" v-model="selectedFormat" aria-label="Filter by format">
                <option value="">All formats</option>
                <option value="txt">Plain Text</option>
                <option value="pdf">PDF</option>
                <option value="guitarpro">GuitarPro</option>
                <option value="musicxml">MusicXML</option>
                <option value="capx">Capella</option>
            </select>
            <button class="btn btn-outline-secondary" type="button" @click="resetFilters">
                Reset
            </button>
        </div>

        <table v-if="filteredTabs.length" class="table tab-table">
            <thead>
                <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Type</th>
                    <th scope="col">
                        <button type="button" class="sort-button" @click="setSort('createdAt')">
                            Date Added
                            <span v-if="sortKey === 'createdAt'">{{ sortDir === "asc" ? "▲" : "▼" }}</span>
                        </button>
                    </th>
                    <th scope="col">Format</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="tab in visibleTabs" :key="tab.id">
                    <td>
                        <div class="title-cell">
                            <router-link :to="`/tab/${tab.id}`" class="tab-link">
                                {{ tab.title }}
                            </router-link>
                            <button
                                class="btn btn-outline-secondary btn-sm action-gear"
                                @click="actionsTabId = tab.id"
                                aria-label="Open actions"
                            >
                                ⚙
                            </button>
                        </div>
                    </td>
                    <td>{{ tab.type }}</td>
                    <td>{{ formatDate(tab.createdAt) }}</td>
                    <td>{{ formatLabel(tab) }}</td>
                </tr>
            </tbody>
        </table>
        <div
            ref="scrollSentinel"
            class="scroll-sentinel"
            v-if="filteredTabs.length"
        ></div>

        <div
            v-if="ready && filteredTabs.length === 0"
            class="empty-state text-center py-5 mb-4 fs-5"
        >
            <p class="text-muted">No tabs match the current filters.</p>
            <button class="btn btn-sm btn-outline-secondary" @click="resetFilters">
                Reset filters
            </button>
        </div>

        <div v-if="actionsTabId !== null" class="modal-backdrop" @click="actionsTabId = null">
            <div class="modal-card" @click.stop>
                <h5 class="mb-3">Row actions</h5>
                <div v-if="getTabById(actionsTabId)" class="modal-actions">
                    <button
                        class="btn btn-secondary"
                        @click="$router.push(`/tab/${actionsTabId}/edit/info`)"
                    >
                        Edit
                    </button>
                    <button
                        class="btn btn-danger"
                        @click="deleteTab(actionsTabId, getTabById(actionsTabId)?.title); actionsTabId = null"
                    >
                        Delete
                    </button>
                </div>
                <button class="btn btn-outline-secondary mt-3" @click="actionsTabId = null">
                    Close
                </button>
            </div>
        </div>

        <button
            v-if="showScrollTop"
            class="scroll-top-btn btn btn-primary"
            type="button"
            @click="scrollToTop"
            aria-label="Scroll to top"
        >
            ↑
        </button>
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

.tab-table tbody tr:hover {
    background: rgba(0, 0, 0, 0.05);
}

.title-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.action-gear {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
}

.tab-table tbody tr:hover .action-gear {
    opacity: 1;
    pointer-events: auto;
}

.sort-button {
    background: none;
    border: none;
    font-weight: 600;
    padding: 0;
    color: inherit;
    cursor: pointer;
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

.filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    min-width: 280px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-actions {
    display: flex;
    gap: 10px;
}

.scroll-top-btn {
    position: fixed;
    right: 24px;
    bottom: 24px;
    border-radius: 999px;
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
    z-index: 900;
}
</style>
