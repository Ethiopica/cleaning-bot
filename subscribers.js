const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "subscribers.json");

function load() {
    try {
        if (!fs.existsSync(FILE)) return [];
        const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
        return Array.isArray(data) ? data.map(String) : [];
    } catch {
        return [];
    }
}

function save(ids) {
    fs.writeFileSync(FILE, JSON.stringify([...new Set(ids.map(String))], null, 2));
}

function getSubscribers() {
    return load();
}

function subscribe(chatId) {
    if (chatId == null) return;
    const ids = load();
    const id = String(chatId);
    if (!ids.includes(id)) {
        ids.push(id);
        save(ids);
        console.log("📌 Subscribed chat:", id);
    }
}

function unsubscribe(chatId) {
    if (chatId == null) return;
    const id = String(chatId);
    const next = load().filter((x) => x !== id);
    save(next);
    console.log("📌 Unsubscribed chat:", id);
}

module.exports = { getSubscribers, subscribe, unsubscribe };
