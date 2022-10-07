import { ActivityType, bold, Client } from "discord.js";
import config from "./config.json";
import Enmap from "enmap";

const client = new Client({
  intents: [
    "Guilds",
    "GuildMembers",
    "GuildMessages",
    "GuildMessageReactions",
    "MessageContent",
  ],

  presence: {
    status: "dnd",
    activities: [
      {
        type: ActivityType.Watching,
        name: "ваши заявки...",
      },
    ],
  },
});

const database: Enmap<string, UserData> = new Enmap({
  name: "users",
  dataDir: "./",
  wal: false,
});

client.on("ready", () => {
  console.log("[#] Client is ready!");
});

client.on("messageCreate", async (message) => {
  //? Проверка на сообщение на сервере и от бота ли оно.
  if (!message.inGuild() || message.author.bot) return;

  //? Проверка сервера и нанала по ID.
  if (message.guild.id !== config.guild_id) return;
  if (message.channel.id !== config.channel_id) return;

  const regex = /https:\/\/csland\.fun\/profile[(?id=[0-9]*]?|\/\p{L}+/gi;
  if (!regex.test(message.content)) await message.delete();
  else {
    const data = database.ensure(message.author.id, {
      link: message.content,
      given: false,
      request_pending: false,
    });

    if (data.request_pending !== false) {
      const msg = await message.reply({
        content: bold("❌ | Вы уже подавали заявку на роль администратора!"),
      });

      setTimeout(async () => {
        await message.delete();
        await msg.delete();
      }, 2000);

      return;
    }

    await message.react("✅");
    await message.react("❌");

    const msg = await message.reply(bold("👀 | Заявка подана, ожидайте!"));

    data.request_pending = true;
    database.set(message.author.id, data);

    const collector = message.createReactionCollector({
      time: 86400000,
      filter: (m, u) =>
        ["✅", "❌"].includes(m.emoji.name) && config.users.includes(u.id),
    });

    collector.on("collect", async (m, u) => {
      if (!["✅", "❌"].includes(m.emoji.name)) return;

      const member = m.message.guild.members.cache.get(u.id);
      if (!member) return;

      switch (m.emoji.name) {
        case "✅": {
          await m.message.reactions.removeAll();
          await msg.edit(bold("✅ | Заявка принята, поздравляем!"));

          const data = database.get(m.message.author.id);
          data.given = true;
          data.request_pending = false;
          database.set(m.message.author.id, data);

          break;
        }

        case "❌": {
          await m.message.delete();
          await msg.delete();

          const data = database.get(m.message.author.id);
          data.request_pending = false;
          database.set(m.message.author.id, data);

          break;
        }
      }

      return;
    });

    collector.on("end", async () => {
      await collector.resetTimer();
    });
  }
});

client.login(config.token);

interface UserData {
  request_pending: boolean;
  given: boolean;
  link: string;
}
