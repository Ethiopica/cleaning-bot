const { google } = require("googleapis");
const path = require("path");

function getAuth() {
    if (process.env.GOOGLE_API_KEY) {
        return process.env.GOOGLE_API_KEY;
    }

    const keyFile =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        path.join(__dirname, "credentials.json");

    return new google.auth.GoogleAuth({
        keyFile,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
}

const sheets = google.sheets({
    version: "v4",
    auth: getAuth(),
});

async function getSchedule() {
    const sheetName = process.env.SHEET_NAME || "tsidattera1";

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: `'${sheetName}'`,
    });

    return response.data.values || [];
}

/** Parse DD/MM/YYYY → Date at local midnight, or null */
function parseSheetDate(value) {
    if (!value || typeof value !== "string") return null;
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function formatSheetDate(date) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatPrettyDate(date) {
    return date.toLocaleDateString("am-ET", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

const TASK_META = {
    adarash: { emoji: "🏠", label: "አዳራሽ" },
    "bete mekdes": { emoji: "⛪", label: "ቤተ መቅደስ" },
    alchilim: { emoji: "✨", label: "አልጭልም" },
};

function getTaskMeta(task) {
    const key = task.trim().toLowerCase();
    return TASK_META[key] || { emoji: "🧹", label: task.trim() };
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Next Sunday on or after today */
function getComingSunday(from = new Date()) {
    const date = startOfDay(from);
    const day = date.getDay(); // 0 = Sunday
    const daysUntilSunday = (7 - day) % 7;
    date.setDate(date.getDate() + daysUntilSunday);
    return date;
}

function getComingSundays(count, from = new Date()) {
    const first = getComingSunday(from);
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(first);
        d.setDate(first.getDate() + i * 7);
        return d;
    });
}

/**
 * Build a map of dateKey → [{ name, task }, ...]
 * from the sheet rows (header + people).
 */
function parseAssignments(rows) {
    if (!rows.length) return new Map();

    const header = rows[0];
    const byDate = new Map();

    for (let col = 1; col < header.length; col++) {
        const date = parseSheetDate(header[col]);
        if (!date) continue;
        const key = formatSheetDate(date);
        const assignments = [];

        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const name = (row[0] || "").trim();
            const task = (row[col] || "").trim();
            if (name && task) {
                assignments.push({ name, task });
            }
        }

        byDate.set(key, assignments);
    }

    return byDate;
}

function groupByTask(assignments) {
    const groups = new Map();
    for (const { name, task } of assignments) {
        const meta = getTaskMeta(task);
        const key = meta.label.toLowerCase();
        if (!groups.has(key)) {
            groups.set(key, { meta, names: [] });
        }
        groups.get(key).names.push(name);
    }
    return [...groups.values()];
}

function formatAssignmentsBlock(assignments) {
    if (!assignments) {
        return "<i>ለዚህ ቀን መርሃ ግብር አልተገኘም።</i>";
    }
    if (!assignments.length) {
        return "<i>ማንም አልተመደበም።</i>";
    }

    return groupByTask(assignments)
        .map(({ meta, names }) => {
            const people = names
                .map((n) => `   · <b>${escapeHtml(n)}</b>`)
                .join("\n");
            return `${meta.emoji} <b>${escapeHtml(meta.label)}</b>\n${people}`;
        })
        .join("\n\n");
}

function formatDayCard(date, assignments, { showWeekHint = false } = {}) {
    const pretty = escapeHtml(formatPrettyDate(date));
    const short = formatSheetDate(date);
    let hint = "";

    if (showWeekHint) {
        const today = startOfDay(new Date());
        const diffDays = Math.round((startOfDay(date) - today) / 86400000);
        if (diffDays === 0) hint = " · <b>ዛሬ</b>";
        else if (diffDays === 7) hint = " · በ1 ሳምንት ውስጥ";
        else if (diffDays > 0) hint = ` · በ${diffDays} ቀናት ውስጥ`;
    }

    return (
        `🗓 <b>${pretty}</b>${hint}\n` +
        `<code>${short}</code>\n` +
        `──────────────\n` +
        formatAssignmentsBlock(assignments)
    );
}

async function getWeeklySchedule() {
    const rows = await getSchedule();
    const byDate = parseAssignments(rows);
    const sunday = getComingSunday();
    const key = formatSheetDate(sunday);
    const assignments = byDate.get(key) || null;

    const message =
        `✨ <b>የሚቀጥለው እሁድ</b>\n` +
        `የጽዳት ተረኞች\n\n` +
        formatDayCard(sunday, assignments, { showWeekHint: true });

    return { date: sunday, assignments, message };
}

async function getMonthlySchedule() {
    const rows = await getSchedule();
    const byDate = parseAssignments(rows);
    const sundays = getComingSundays(4);

    const cards = sundays.map((sunday, index) => {
        const key = formatSheetDate(sunday);
        const header = `<b>${index + 1}.</b> `;
        return (
            header +
            formatDayCard(sunday, byDate.get(key), { showWeekHint: true })
        );
    });

    const message =
        `🗓 <b>የሚቀጥሉት 4 እሁዶች</b>\n` +
        `የወሩ የጽዳት መርሃ ግብር\n\n` +
        cards.join("\n\n");

    return { sundays, message };
}

module.exports = {
    getSchedule,
    getWeeklySchedule,
    getMonthlySchedule,
};
