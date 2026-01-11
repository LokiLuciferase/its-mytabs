<script>
import { defineComponent } from "vue";
import Vue3Dropzone from "@jaxtheprime/vue3-dropzone";
import "@jaxtheprime/vue3-dropzone/dist/style.css";
import { notify } from "@kyvg/vue3-notification";
import { baseURL } from "../app.js";
import { supportedFormatCommaString, tabTypeList } from "../../../backend/common.js";

const alphaTab = await import("@coderline/alphatab");

export default defineComponent({
    components: { Vue3Dropzone },
    data() {
        return {
            files: [],
            supportedFormatCommaString,
            isUploading: false,
            pathPattern: "",
            replaceUnderscores: true,
            titleCaseNames: true,
            mappings: [],
            folderModeEnabled: false,
            tabTypeList,
        };
    },
    watch: {
        files: {
            handler(newFiles) {
                const hasPlainText = newFiles.some((fileItem) => {
                    const file = fileItem?.file || fileItem;
                    return file?.name && this.isPlainTextFileName(file.name);
                });
                this.folderModeEnabled = hasPlainText;
            },
            deep: true,
        },
    },
    methods: {
        onPatternSummaryClick(event) {
            if (!this.folderModeEnabled) {
                event.preventDefault();
            }
        },
        resolveTypeLabel(rawType) {
            if (!rawType) {
                return "";
            }
            const normalized = rawType.trim().toLowerCase();
            if (this.tabTypeList.includes(rawType)) {
                return rawType;
            }
            if (normalized === "guitar tabs" || normalized === "guitartabs" || normalized === "guitar" || normalized === "tabs") {
                return "Guitar Tabs";
            }
            if (normalized === "bass tabs" || normalized === "basstabs" || normalized === "bass") {
                return "Bass Tabs";
            }
            if (normalized === "drum tabs" || normalized === "drumtabs" || normalized === "drum" || normalized === "drums") {
                return "Drum Tabs";
            }
            if (normalized === "guitar chords" || normalized === "guitarchords" || normalized === "chords") {
                return "Guitar Chords";
            }
            return "";
        },
        parseMappingType(rawReplacement, allowType) {
            let type = "";
            const tokenRegex = /{{\s*Type\s*:\s*([^}]+)\s*}}/gi;
            let cleaned = rawReplacement;
            let match;
            while ((match = tokenRegex.exec(rawReplacement)) !== null) {
                if (allowType) {
                    type = this.resolveTypeLabel(match[1]) || type;
                }
            }
            cleaned = cleaned.replace(tokenRegex, "");
            return { cleaned, type };
        },
        addMapping() {
            this.mappings.push({ from: "", to: "", useRegex: false });
        },
        removeMapping(index) {
            this.mappings.splice(index, 1);
        },
        applyMappings(value, { allowType = false } = {}) {
            if (!value || this.mappings.length === 0) {
                return { value, type: "" };
            }

            let mapped = value;
            let mappedType = "";
            for (const mapping of this.mappings) {
                if (!mapping.from) {
                    continue;
                }
                if (mapping.useRegex) {
                    try {
                        const matchRegex = new RegExp(mapping.from);
                        const isMatch = matchRegex.test(mapped);
                        const { cleaned, type } = this.parseMappingType(mapping.to || "", allowType);
                        const regex = new RegExp(mapping.from, "g");
                        const replacement = cleaned.replace(/\\(\d+)/g, "$$$1");
                        mapped = mapped.replace(regex, replacement);
                        if (isMatch && type) {
                            if (mappedType && mappedType !== type) {
                                throw new Error(`Multiple tab types detected (${mappedType}, ${type})`);
                            }
                            mappedType = type;
                        }
                    } catch (err) {
                        if (err instanceof Error && err.message.includes("Multiple tab types detected")) {
                            throw err;
                        }
                        console.warn("Invalid mapping regex", mapping.from, err);
                    }
                } else {
                    const isMatch = mapped.includes(mapping.from);
                    const { cleaned, type } = this.parseMappingType(mapping.to || "", allowType);
                    mapped = mapped.split(mapping.from).join(cleaned);
                    if (isMatch && type) {
                        if (mappedType && mappedType !== type) {
                            throw new Error(`Multiple tab types detected (${mappedType}, ${type})`);
                        }
                        mappedType = type;
                    }
                }
            }

            return { value: mapped, type: mappedType };
        },
        normalizeName(value, { allowType = false } = {}) {
            if (!value) {
                return { value, type: "" };
            }

            let normalized = value;
            const mappingResult = this.applyMappings(normalized, { allowType });
            normalized = mappingResult.value;
            if (this.replaceUnderscores) {
                normalized = normalized.replace(/_/g, " ");
            }
            normalized = normalized.replace(/\s+/g, " ").trim();

            if (this.titleCaseNames) {
                normalized = normalized
                    .toLowerCase()
                    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
            }

            return { value: normalized, type: mappingResult.type };
        },
        isPlainTextFileName(fileName) {
            const lower = fileName.toLowerCase();
            return lower.endsWith(".txt") || lower.endsWith(".txt.gz") || lower.endsWith(".pdf");
        },
        getTextUploadBaseName(fileName) {
            const lower = fileName.toLowerCase();
            if (lower.endsWith(".txt.gz")) {
                return fileName.slice(0, -7);
            }
            return fileName.replace(/\.[^/.]+$/, "");
        },
        getFilePath(fileItem) {
            const file = fileItem?.file || fileItem;
            return (
                fileItem?.relativePath ||
                file?.webkitRelativePath ||
                file?.relativePath ||
                file?.name ||
                ""
            );
        },
        parsePattern(pathPattern, filePath) {
            const pattern = pathPattern.trim();
            if (!pattern) {
                return null;
            }

            const tokenRegex = /{{\s*(Artist|Title|Type)\s*}}/g;
            let regexString = "";
            let lastIndex = 0;
            const tokens = [];
            let match;

            while ((match = tokenRegex.exec(pattern)) !== null) {
                const tokenName = match[1].toLowerCase();

                regexString += pattern
                    .slice(lastIndex, match.index)
                    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                regexString += "([^/]+)";
                tokens.push(tokenName);
                lastIndex = match.index + match[0].length;
            }

            if (tokens.length === 0) {
                return null;
            }

            regexString += pattern
                .slice(lastIndex)
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(regexString, "g");
            const normalizedPath = filePath.replace(/\\/g, "/");
            const matches = [...normalizedPath.matchAll(regex)];
            if (matches.length === 0) {
                return null;
            }

            const result = matches[matches.length - 1];
            const parsed = {};
            tokens.forEach((token, idx) => {
                parsed[token] = result[idx + 1]?.trim();
            });
            return parsed;
        },
        addFolderFiles(fileList, { fromFolder = false } = {}) {
            const existing = new Set(this.files.map((fileItem) => this.getFilePath(fileItem)));
            const toAdd = [];
            let skipped = 0;

            fileList.forEach((file) => {
                if (!this.isPlainTextFileName(file.name)) {
                    skipped += 1;
                    return;
                }

                const relativePath =
                    file.webkitRelativePath || file.relativePath || file.name;
                if (existing.has(relativePath)) {
                    return;
                }

                existing.add(relativePath);
                toAdd.push({ file, name: file.name, relativePath });
            });

            if (toAdd.length > 0) {
                this.files = this.files.concat(toAdd);
                if (fromFolder) {
                    this.folderModeEnabled = true;
                }
            }

            if (skipped > 0) {
                notify({
                    text: `Skipped ${skipped} non-text file${skipped > 1 ? "s" : ""} from folder`,
                    type: "warn",
                });
            }
        },
        handleFolderSelect(event) {
            const files = Array.from(event.target.files || []);
            if (files.length === 0) {
                return;
            }
            this.addFolderFiles(files, { fromFolder: true });
            event.target.value = "";
        },
        collectEntryFiles(entry, pathPrefix, files) {
            return new Promise((resolve) => {
                if (entry.isFile) {
                    entry.file((file) => {
                        file.relativePath = `${pathPrefix}${entry.name}`;
                        files.push(file);
                        resolve();
                    });
                    return;
                }

                if (entry.isDirectory) {
                    const reader = entry.createReader();
                    const readEntries = () => {
                        reader.readEntries(async (entries) => {
                            if (!entries.length) {
                                resolve();
                                return;
                            }
                            await Promise.all(
                                entries.map((child) =>
                                    this.collectEntryFiles(
                                        child,
                                        `${pathPrefix}${entry.name}/`,
                                        files,
                                    ),
                                ),
                            );
                            readEntries();
                        });
                    };
                    readEntries();
                    return;
                }

                resolve();
            });
        },
        async handleFolderDrop(event) {
            const items = Array.from(event.dataTransfer?.items || []);
            const entries = items
                .map((item) => item.webkitGetAsEntry?.())
                .filter(Boolean);
            if (entries.length === 0) {
                const files = Array.from(event.dataTransfer?.files || []);
                this.addFolderFiles(files);
                return;
            }

            const files = [];
            await Promise.all(entries.map((entry) => this.collectEntryFiles(entry, "", files)));
            this.addFolderFiles(files, { fromFolder: true });
        },
        async upload() {
            if (this.files.length === 0) {
                notify({ text: "Please select at least one file to upload", type: "error" });
                return;
            }

            this.isUploading = true;
            const pattern = this.pathPattern.trim();

            const uploadPromises = this.files.map(async (f) => {
                const fileName = f?.file?.name || f?.name || "file";
                try {
                    const file = f.file;
                    let title = this.getTextUploadBaseName(file.name);
                    let artist = "";
                    const filePath = this.getFilePath(f);
                    const parsed = this.parsePattern(pattern, filePath);

                    if (parsed?.title) {
                        title = parsed.title;
                    }
                    if (parsed?.artist) {
                        artist = parsed.artist;
                    }
                    let parsedType = "";
                    if (parsed?.type) {
                        parsedType = this.resolveTypeLabel(parsed.type) || "";
                    }

                    if (!this.isPlainTextFileName(file.name) && !parsed) {
                        // Try to parse the file with AlphaTab to ensure it's valid
                        const data = await file.arrayBuffer();
                        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
                            new Uint8Array(data),
                            new alphaTab.Settings(),
                        );
                        title = score.title;
                        artist = score.artist;
                    }

                    const titleResult = this.normalizeName(title, { allowType: true });
                    const artistResult = this.normalizeName(artist);
                    title = titleResult.value;
                    artist = artistResult.value;
                    const mappedType = titleResult.type || "";
                    const finalType = parsedType || mappedType;

                    // Upload to /api/new-tab
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("title", title);
                    formData.append("artist", artist);
                    if (finalType) {
                        formData.append("type", finalType);
                    }

                    const res = await fetch(baseURL + "/api/new-tab", {
                        method: "POST",
                        credentials: "include",
                        body: formData,
                    });

                    if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.msg || "Upload failed");
                    }

                    const respData = await res.json();
                    const displayName = artist ? `${artist} - ${title}` : title;
                    notify({ text: `Uploaded: ${displayName}`, type: "success" });
                    return respData.id;
                } catch (err) {
                    notify({ text: `Error with ${fileName}: ${err.message}`, type: "error" });
                    return null;
                }
            });

            const results = await Promise.all(uploadPromises);

            const firstId = results.find((id) => id !== null);
            if (firstId) {
                this.$router.push(`/tab/${firstId}`);
            }

            // Reset Dropzone
            this.isUploading = false;
        },
        dropzoneError(err) {
            console.log(err);
            notify({ text: err.type || "Dropzone error", type: "error" });
        },
    },
});
</script>

<template>
    <div class="container my-container">
        <div class="display-6 mb-4 mt-5">Upload tab files</div>

        <details
            class="mb-4 pattern-input"
            :class="{ 'pattern-disabled': !folderModeEnabled }"
            :open="folderModeEnabled ? undefined : false"
            :aria-disabled="!folderModeEnabled"
        >
            <summary class="pattern-summary" @click="onPatternSummaryClick">
                Path parsing (for .txt and .pdf files)
            </summary>
            <div class="mt-3">
                <label class="form-label" for="pathPattern">Path pattern (optional)</label>
                <input
                    id="pathPattern"
                    v-model="pathPattern"
                    class="form-control"
                    type="text"
                    placeholder="e.g. Tabs/{{Artist}}/{{Title}}.txt"
                    autocomplete="off"
                    :disabled="!folderModeEnabled"
                />
                <div class="form-text" v-pre>
                    Use {{Artist}}, {{Title}} and {{Type}} to parse metadata from file paths before upload. If both
                    path and mappings set a type, the path value wins.
                </div>
                <div class="form-check mt-3">
                    <input
                        id="replaceUnderscores"
                        v-model="replaceUnderscores"
                        class="form-check-input"
                        type="checkbox"
                        :disabled="!folderModeEnabled"
                    />
                    <label class="form-check-label" for="replaceUnderscores">
                        Replace underscores with spaces
                    </label>
                </div>
                <div class="form-check mt-2">
                    <input
                        id="titleCaseNames"
                        v-model="titleCaseNames"
                        class="form-check-input"
                        type="checkbox"
                        :disabled="!folderModeEnabled"
                    />
                    <label class="form-check-label" for="titleCaseNames">
                        Title case Artist and Title
                    </label>
                </div>
                <div class="mapping-section mt-4">
                    <div class="mapping-header">
                        <div class="form-label mb-1">Mappings</div>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            @click="addMapping"
                            :disabled="!folderModeEnabled"
                        >
                            Add mapping
                        </button>
                    </div>
                    <div v-if="mappings.length === 0" class="form-text" v-pre>
                        Perform replacements in the Title like <code>_chd</code> -> <code>(Chords)</code> or
                        regex <code>_v(\\d+)</code> -> <code>Version $1</code>. Capture the type with
                        <code>{{Type:Chords}}</code>, <code>{{Type:Tabs}}</code> or <code>{{Type:Bass}}</code>.
                    </div>
                    <div v-for="(mapping, index) in mappings" :key="index" class="mapping-row">
                        <input
                            v-model="mapping.from"
                            class="form-control"
                            type="text"
                            placeholder="Match (regex or text)"
                            :disabled="!folderModeEnabled"
                        />
                        <input
                            v-model="mapping.to"
                            class="form-control"
                            type="text"
                            placeholder="Replace or Metadata Capture"
                            :disabled="!folderModeEnabled"
                        />
                        <div class="form-check form-switch">
                            <input
                                :id="`mappingRegex-${index}`"
                                v-model="mapping.useRegex"
                                class="form-check-input"
                                type="checkbox"
                                :disabled="!folderModeEnabled"
                            />
                            <label class="form-check-label" :for="`mappingRegex-${index}`">
                                Regex
                            </label>
                        </div>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            @click="removeMapping(index)"
                            :disabled="!folderModeEnabled"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        </details>

        <div class="dropzone-wrapper" @dragover.prevent @drop.prevent="handleFolderDrop">
            <Vue3Dropzone
                v-model="files"
                :maxFileSize="500"
                :multiple="true"
                @error="dropzoneError"
            >
                <template #title>Drop your tabs here</template>
                <template #description>
                    <div>Supports {{ supportedFormatCommaString }}</div>
                </template>
            </Vue3Dropzone>
            <input
                ref="folderInput"
                type="file"
                class="folder-input"
                webkitdirectory
                directory
                multiple
                @change="handleFolderSelect"
            />
        </div>

        <button
            @click="upload"
            class="btn btn-primary w-100 mt-4"
            :disabled="isUploading"
        >
            {{ isUploading ? "Uploading..." : "Upload" }}
        </button>

        <h4 class="mt-5">Free Resources</h4>

        <ul class="free-resources">
            <li><a href="https://www.ultimate-guitar.com/" target="_blank" rel="noopener">Ultimate Guitar</a><br />Some free tabs in *.gp format</li>
            <li><a href="https://www.911tabs.com/" target="_blank" rel="noopener">911Tabs</a><br />Search engine for tabs</li>
            <li>
                <a href="https://musescore.com/sheetmusic?instrument=72%2C73&recording_type=free-download" target="_blank" rel="noopener">MuseScore (Free Download filtered)</a><br />Some free tabs in
                MusicXML format
            </li>
            <li><a href="https://gprotab.net/" target="_blank" rel="noopener">GProTab</a><br />Free Guitar Pro tabs in *.gp format</li>
        </ul>
    </div>
</template>

<style lang="scss">
.img-details {
    opacity: 1 !important;
    visibility: visible !important;
}

.free-resources li {
    margin-bottom: 15px;
}

.pattern-input .form-text {
    color: #6c757d;
}

.pattern-summary {
    font-weight: 600;
    cursor: pointer;
}

.pattern-disabled {
    opacity: 0.5;
    pointer-events: none;
}

.mapping-section code {
    background: #eef1f4;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    color: #495057;
    padding: 0 6px;
}

.mapping-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.mapping-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    margin-top: 12px;
}

@media (max-width: 768px) {
    .mapping-row {
        grid-template-columns: minmax(0, 1fr);
    }
}

.folder-drop-description {
    color: #6c757d;
    text-align: center;
}

.folder-input {
    display: none;
}
</style>
