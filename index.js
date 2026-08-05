require("dotenv").config();
const http = require("http");
const cron = require("node-cron");
const { getWeeklySchedule, getMonthlySchedule } = require("./googleSheets");
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
const TIMEZONE = process.env.TZ || "Africa/Addis_Ababa";

bot.start((ctx) => {
    ctx.reply(
        "✨ <b>የጽዳት መርሃ ግብር ቦት</b>\n\n" +
            "🧹 /weekly — የሚቀጥለው እሁድ የጽዳት ተረኞች\n" +
            "🗓 /monthly — የሚቀጥሉት 4 እሁዶች መርሃ ግብር\n" +
            "🆔 /chatid — የዚህ ቻት መለያ (ለአውቶ ማሳወቂያ)",
        { parse_mode: "HTML" }
    );
});

bot.command("weekly", async (ctx) => {
    try {
        const { message } = await getWeeklySchedule();
        await ctx.reply(message, { parse_mode: "HTML" });
    } catch (error) {
        console.log(error);
        await ctx.reply("❌ መርሃ ግብሩን ማንበብ አልተቻለም።");
    }
});

bot.command("monthly", async (ctx) => {
    try {
        const { message } = await getMonthlySchedule();
        await ctx.reply(message, { parse_mode: "HTML" });
    } catch (error) {
        console.log(error);
        await ctx.reply("❌ መርሃ ግብሩን ማንበብ አልተቻለም።");
    }
});

bot.command("chatid", async (ctx) => {
    await ctx.reply(
        `የዚህ ቻት መለያ:\n<code>${ctx.chat.id}</code>\n\n` +
            "ይህን በ Railway ላይ እንደ <code>CHAT_ID</code> አስቀምጡ።",
        { parse_mode: "HTML" }
    );
});

async function sendFridayReminder() {
    const chatId = process.env.CHAT_ID;
    if (!chatId) {
        console.log("⚠️ CHAT_ID is not set — skipping Friday reminder");
        return;
    }

    try {
        const { message } = await getWeeklySchedule();
        const reminder = `🔔 <b>አስታዋሽ</b>\n\n${message}`;

        await bot.telegram.sendMessage(chatId, reminder, {
            parse_mode: "HTML",
        });
        console.log("✅ Friday reminder sent to", chatId);
    } catch (error) {
        console.log("❌ Friday reminder failed:", error);
    }
}

// Every Friday at 12:00 (Africa/Addis_Ababa / UTC+3)
cron.schedule(
    "0 12 * * 5",
    () => {
        console.log("⏰ Friday 12:00 — sending weekly reminder...");
        sendFridayReminder();
    },
    { timezone: TIMEZONE }
);

console.log(`📅 Friday 12:00 reminder scheduled (${TIMEZONE})`);

// Railway health check (required for web services)
const port = process.env.PORT || 3000;
http
    .createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
    })
    .listen(port, () => {
        console.log(`Health check on :${port}`);
    });

bot.launch();

console.log("✅ Bot is running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
