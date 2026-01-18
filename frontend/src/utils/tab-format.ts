const formatLabelMap = {
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

export function formatKey(tab) {
    const name = tab?.filename || "";
    return name.split(".").pop()?.toLowerCase() || "";
}

export function formatFilterKey(tab) {
    const ext = formatKey(tab);
    if (["gp", "gpx", "gp3", "gp4", "gp5"].includes(ext)) {
        return "guitarpro";
    }
    return ext;
}

export function formatLabel(tab) {
    const ext = formatKey(tab);
    return formatLabelMap[ext] || ext.toUpperCase() || "Unknown";
}

export function formatDate(value) {
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
}
