export function slugify(value: string): string {
    return (value || "")
        .toString()
        .normalize("NFKD")
        .replace(/&/g, " and ")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
