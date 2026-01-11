import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

import Layout from "./layouts/Layout.vue";
import Dashboard from "./pages/Dashboard.vue";
import Favorites from "./pages/Favorites.vue";
import Home from "./pages/Home.vue";
import Register from "./pages/Register.vue";
import Login from "./pages/Login.vue";
import TabConfig from "./pages/TabConfig.vue";
import Settings from "./pages/Settings.vue";
import TabNew from "./pages/TabNew.vue";
import Artist from "./pages/Artist.vue";
import Artists from "./pages/Artists.vue";

const Tab = () => import("./pages/Tab.vue");

const routes: RouteRecordRaw[] = [
    {
        path: "/empty",
        component: Layout,
        children: [
            {
                path: "",
                component: Dashboard,
                children: [
                    {
                        name: "home",
                        path: "/",
                        component: Favorites,
                    },
                    {
                        name: "tabs",
                        path: "/tabs",
                        component: Home,
                    },
                    {
                        path: "/tab/:id/edit/info",
                        component: TabConfig,
                    },
                    {
                        path: "/tab/:id/edit/audio",
                        component: TabConfig,
                    },
                    {
                        path: "/tab/:id/edit/tab-file",
                        component: TabConfig,
                    },
                    {
                        name: "tabNew",
                        path: "/new-tab",
                        component: TabNew,
                    },
                    {
                        name: "tab",
                        path: "/tab/:id",
                        component: Tab,
                    },
                    {
                        name: "artist",
                        path: "/artist/:name",
                        component: Artist,
                    },
                    {
                        name: "artists",
                        path: "/artists",
                        component: Artists,
                    },
                    {
                        name: "settings",
                        path: "/settings",
                        component: Settings,
                    },
                ],
            },
            {
                name: "register",
                path: "/register",
                component: Register,
            },
            {
                name: "login",
                path: "/login",
                component: Login,
            },
        ],
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});
