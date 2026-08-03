require("dotenv").config();
const http = require("http");
const { getWeeklySchedule, getMonthlySchedule } = require("./googleSheets");
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply(
        "✨ <b>የጽዳት መርሃ ግብር ቦት</b>\n\n" +
            "🧹 /weekly — የሚቀጥለው እሁድ የጽዳት ተረኞች\n" +
            "🗓 /monthly — የሚቀጥሉት 4 እሁዶች መርሃ ግብር",
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
