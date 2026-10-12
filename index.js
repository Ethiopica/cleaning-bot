require("dotenv").config();
const http = require("http");
const cron = require("node-cron");
const { getWeeklySchedule, getMonthlySchedule } = require("./googleSheets");
const { getSubscribers, subscribe, unsubscribe } = require("./subscribers");
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
const TIMEZONE = process.env.TZ || "Africa/Addis_Ababa";

function rememberChat(ctx, next) {
    if (ctx.chat?.id != null) subscribe(ctx.chat.id);
    return next();
}

bot.use(rememberChat);

bot.start((ctx) => {
    ctx.reply(
        "✨ <b>የጽዳት መርሃ ግብር ቦት</b>\n\n" +
            "🧹 /weekly — የሚቀጥለው እሁድ የጽዳት ተረኞች\n" +
            "🗓 /monthly — የሚቀጥሉት 4 እሁዶች መርሃ ግብር\n\n" +
            "⏰ በየአርብ ሰዓት 12:00 የሚቀጥለው እሁድ መርሃ ግብር በራስ-ሰር ይላካል።",
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

// Remember groups when the bot is added; forget when removed
bot.on("my_chat_member", (ctx) => {
    const status = ctx.myChatMember?.new_chat_member?.status;
    const chatId = ctx.chat?.id;
    if (status === "member" || status === "administrator") {
        subscribe(chatId);
    } else if (status === "left" || status === "kicked") {
        unsubscribe(chatId);
    }
});

async function sendFridayReminder() {
    const chats = getSubscribers();
    if (!chats.length) {
        console.log(
            "⚠️ No subscribed chats yet. Open the bot or group and send /start once."
        );
        return;
    }

    try {
        const { message } = await getWeeklySchedule();
        const reminder = `🔔 <b>አስታዋሽ</b>\n\n${message}`;

        for (const chatId of chats) {
            try {
                await bot.telegram.sendMessage(chatId, reminder, {
                    parse_mode: "HTML",
                });
                console.log("✅ Friday reminder sent to", chatId);
            } catch (error) {
                console.log("❌ Failed for", chatId, error.message);
                // Chat deleted / bot removed
                if (
                    /blocked|chat not found|bot was kicked|forbidden/i.test(
                        error.message || ""
                    )
                ) {
                    unsubscribe(chatId);
                }
            }
        }
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
