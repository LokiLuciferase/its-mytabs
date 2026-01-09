<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { baseURL } from "../app.js";
import { isLoggedIn } from "../auth-client.js";

export default defineComponent({
    data() {
        return {
            tabList: [],
            ready: false,
            isLoggedIn: false,
            searchQuery: "",
            sortKey: "artist",
            sortDir: "asc",
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
        sortedTabList() {
            const list = [...this.filteredTabList];
            const key = this.sortKey;
            const dir = this.sortDir === "asc" ? 1 : -1;
            list.sort((a, b) => {
                const aValue = (a[key] || "").toString();
                const bValue = (b[key] || "").toString();
                return aValue.localeCompare(bValue) * dir;
            });
            return list;
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
        artistLabel(tab) {
            return tab.artist || "Unknown Artist";
        },
        artistRoute(tab) {
            return `/artist/${this.slugify(this.artistLabel(tab))}`;
        },
        setSort(key) {
            if (this.sortKey === key) {
                this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
                return;
            }
            this.sortKey = key;
            this.sortDir = "asc";
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
        </div>

        <div class="mb-4 ms-3" v-if="ready">
            Total Tabs: {{ filteredTabList.length }}
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
                    <th scope="col">
                        <button type="button" class="sort-button" @click="setSort('type')">
                            Type
                            <span v-if="sortKey === 'type'">{{ sortDir === "asc" ? "▲" : "▼" }}</span>
                        </button>
                    </th>
                    <th scope="col" class="text-end">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="tab in sortedTabList" :key="tab.id">
                    <td>
                        <router-link :to="artistRoute(tab)" class="tab-link">
                            {{ artistLabel(tab) }}
                        </router-link>
                    </td>
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
                            @click="deleteTab(tab.id, tab.title, tab.artist)"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>

        <div
            v-if="ready && filteredTabList.length === 0 && searchQuery"
            class="empty-state text-center py-5 mb-4 fs-5"
        >
            <p class="text-muted">No tabs found for "{{ searchQuery }}"</p>

            <button class="btn btn-sm btn-outline-secondary" @click='searchQuery = ""'>
                Clear search
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../styles/vars.scss";

.tab-table {
    width: 100%;
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
</style>
