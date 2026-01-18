<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { baseURL, checkFetch } from "../app.js";
import { isLoggedIn } from "../auth-client.js";
import { tabTypeList } from "../../../backend/common.js";

export default defineComponent({
    data() {
        return {
            tabList: [],
            ready: false,
            isLoggedIn: false,
            searchQuery: "",
            sortKey: "createdAt",
            sortDir: "desc",
            pageSize: 50,
            displayLimit: 50,
            observer: null,
            actionsTabId: null,
            selectedType: "",
            selectedFormat: "",
            tabTypeList,
            showScrollTop: false,
        };
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

            await this.$nextTick();
            this.$refs.searchInput?.focus();
            this.setupObserver();
            this.onScroll();
            window.addEventListener("scroll", this.onScroll, { passive: true });
        } catch (error) {
            notify({
                text: error.message,
                type: "error",
            });
        }
    },

    computed: {
        filteredTabList() {
            if (!this.searchQuery.trim()) return this.tabList;

            const query = this.searchQuery.trim().toLowerCase();

            return this.tabList.filter((tab) => {
                const title = (tab.title || "").toLowerCase();
                const artist = (tab.artist || "").toLowerCase();
                const type = (tab.type || "").toLowerCase();
                return title.includes(query) || artist.includes(query) || type.includes(query);
            });
        },
        filteredAndTypedList() {
            return this.filteredTabList.filter((tab) => {
                if (this.selectedType && tab.type !== this.selectedType) {
                    return false;
                }
                if (this.selectedFormat && this.formatFilterKey(tab) !== this.selectedFormat) {
                    return false;
                }
                return true;
            });
        },
        sortedTabList() {
            const list = [...this.filteredAndTypedList];
            const key = this.sortKey;
            const dir = this.sortDir === "asc" ? 1 : -1;
            list.sort((a, b) => {
                if (key === "createdAt") {
                    const aValue = new Date(a?.createdAt || 0).getTime();
                    const bValue = new Date(b?.createdAt || 0).getTime();
                    return (aValue - bValue) * dir;
                }
                if (key === "favorite") {
                    const aValue = a?.favorite ? 1 : 0;
                    const bValue = b?.favorite ? 1 : 0;
                    return (aValue - bValue) * dir;
                }
                const aValue = (a?.[key] || "").toString();
                const bValue = (b?.[key] || "").toString();
                return aValue.localeCompare(bValue) * dir;
            });
            return list;
        },
        visibleTabList() {
            return this.sortedTabList.slice(0, this.displayLimit);
        },
    },

    methods: {
        getTabById(id) {
            return this.sortedTabList.find((tab) => tab.id === id) || null;
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
        artistLabel(tab) {
            return tab.artist || "Unknown Artist";
        },
        artistRoute(tab) {
            return `/artist/${this.slugify(this.artistLabel(tab))}`;
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
                        this.sortedTabList.length,
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
            this.sortDir = key === "createdAt" || key === "favorite" ? "desc" : "asc";
        },
        async deleteTab(id, title, artist) {
            if (!confirm(`Are you sure you want to delete ${artist} - ${title}?`)) return;

            try {
                const res = await fetch(baseURL + `/api/tab/${id}`, {
                    method: "DELETE",
                    credentials: "include",
                });

                if (res.status === 200) {
                    this.tabList = this.tabList.filter((tab) => tab.id !== id);

                    notify({
                        text: "Tab deleted successfully",
                        type: "success",
                    });
                } else {
                    const data = await res.json();
                    throw new Error(data.message || "Failed to delete tab");
                }
            } catch (error) {
                notify({
                    text: error.message,
                    type: "error",
                });
            }
        },
        async toggleFavorite(tab) {
            const nextFavorite = !tab.favorite;
            try {
                const res = await fetch(baseURL + `/api/tab/${tab.id}/favorite`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ favorite: nextFavorite }),
                });
                await checkFetch(res);
                tab.favorite = nextFavorite;
            } catch (error) {
                notify({
                    text: error.message,
                    type: "error",
                });
            }
        },
    },
    watch: {
        searchQuery() {
            this.displayLimit = this.pageSize;
            this.$nextTick(() => this.setupObserver());
        },
        selectedType() {
            this.displayLimit = this.pageSize;
            this.$nextTick(() => this.setupObserver());
        },
        selectedFormat() {
            this.displayLimit = this.pageSize;
            this.$nextTick(() => this.setupObserver());
        },
        sortKey() {
            this.displayLimit = this.pageSize;
            this.$nextTick(() => this.setupObserver());
        },
        sortDir() {
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
    <div class="container my-container">
        <div class="search-section mb-4 mt-5 pe-3 ps-3" v-if="ready">
            <div class="input-group">
                <span class="input-group-text">
                    <font-awesome-icon icon="magnifying-glass" />
                </span>

                <input
                    type="text"
                    class="form-control search-input"
                    v-model="searchQuery"
                    placeholder="Search by title or artist..."
                    ref="searchInput"
                    aria-label="Search tabs"
                />

                <button
                    class="input-group-text bg-transparent border-0 cursor-pointer"
                    type="button"
                    @click='searchQuery = ""'
                    v-if="searchQuery"
                    aria-label="Clear search"
                >
                    ✕
                </button>
            </div>

            <div class="filters mt-3">
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
        </div>

        <div class="mb-4 ms-3" v-if="ready">
            Total Tabs: {{ filteredAndTypedList.length }}
            <span v-if="searchQuery" class="text-muted">
                (of {{ tabList.length }})
            </span>
        </div>

        <table v-if="ready && sortedTabList.length" class="table tab-table">
            <thead>
                <tr>
                    <th scope="col">
                        <button type="button" class="sort-button" @click="setSort('artist')">
                            Artist
                            <span v-if="sortKey === 'artist'">{{ sortDir === "asc" ? "▲" : "▼" }}</span>
                        </button>
                    </th>
                    <th scope="col">
                        <button type="button" class="sort-button" @click="setSort('title')">
                            Title
                            <span v-if="sortKey === 'title'">{{ sortDir === "asc" ? "▲" : "▼" }}</span>
                        </button>
                    </th>
                    <th scope="col" class="favorite-header">
                        <button type="button" class="sort-button" @click="setSort('favorite')">
                            ★
                            <span v-if="sortKey === 'favorite'">{{ sortDir === "asc" ? "▲" : "▼" }}</span>
                        </button>
                    </th>
                    <th scope="col">
                        <button type="button" class="sort-button" @click="setSort('type')">
                            Type
                            <span v-if="sortKey === 'type'">{{ sortDir === "asc" ? "▲" : "▼" }}</span>
                        </button>
                    </th>
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
                <tr v-for="tab in visibleTabList" :key="tab.id" :class='{ "unknown-artist": artistLabel(tab) === "Unknown Artist" }'>
                    <td>
                        <router-link :to="artistRoute(tab)" class="tab-link">
                            {{ artistLabel(tab) }}
                        </router-link>
                    </td>
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
                    <td class="favorite-cell">
                        <button
                            class="btn btn-outline-secondary btn-sm favorite-button"
                            :class="tab.favorite ? 'is-favorite' : ''"
                            @click="toggleFavorite(tab)"
                            :aria-pressed="tab.favorite ? 'true' : 'false'"
                            :aria-label="tab.favorite ? 'Remove from favorites' : 'Add to favorites'"
                            title="Favorite"
                        >
                            {{ tab.favorite ? "★" : "☆" }}
                        </button>
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
            v-if="ready && sortedTabList.length"
        ></div>

        <div
            v-if="ready && filteredAndTypedList.length === 0"
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
                <div class="modal-footer">
                    <div v-if="getTabById(actionsTabId)" class="modal-actions">
                        <button
                            class="btn btn-secondary"
                            @click="$router.push(`/tab/${actionsTabId}/edit/info`)"
                        >
                            Edit
                        </button>
                        <button
                            class="btn btn-danger"
                            @click="deleteTab(actionsTabId, getTabById(actionsTabId)?.title, getTabById(actionsTabId)?.artist); actionsTabId = null"
                        >
                            Delete
                        </button>
                    </div>
                    <button class="btn btn-outline-secondary" @click="actionsTabId = null">
                        Close
                    </button>
                </div>
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
@import "../styles/vars.scss";

.tab-table {
    width: 100%;
}

.tab-table tbody tr:nth-child(odd) > * {
    background-color: rgba(255, 255, 255, 0.03) !important;
}

:global(.main.light) .tab-table tbody tr:nth-child(odd) > * {
    background-color: rgba(0, 0, 0, 0.03) !important;
}

.tab-table tbody tr.unknown-artist > * {
    background-color: rgba(255, 173, 86, 0.18) !important;
}

:global(.main.light) .tab-table tbody tr.unknown-artist > * {
    background-color: rgba(255, 173, 86, 0.28) !important;
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

.favorite-button {
    font-size: 16px;
    line-height: 1;
    padding: 2px 6px;
    color: #c2c2c2;
}

.favorite-button.is-favorite {
    color: #f5c518;
}

.favorite-button:hover {
    color: #f0b90b;
}

.favorite-header,
.favorite-cell {
    text-align: center;
    width: 1%;
    white-space: nowrap;
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
    background: #1d1d1f;
    color: #d6d6d6;
    border-radius: 12px;
    padding: 20px;
    min-width: 280px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
}

[data-bs-theme="light"] .modal-card {
    background: #fff;
    color: #1f1f1f;
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
