import "dotenv/config";
import "./modules/checkEnv.js";

import { Client, Collection, GatewayIntentBits, REST, Routes } from "discord.js";
import { Player } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";

import { loadEvents } from "./handlers/event.js";

import fs from "fs";
import path from "path";

// ================= LOAD COMMANDS =================

async function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(process.cwd(), "commands");

  if (!fs.existsSync(commandsPath)) {
    console.warn("⚠️ No commands folder found");
    return commands;
  }

  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(`file://${filePath}`)).default;

    if (!command?.data || !command?.execute) continue;

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  return commands;
}

// ================= CLIENT =================

class ExtendedClient extends Client {
  commands = new Collection();
  components = new Collection();
  cooldowns = new Collection();

  constructor(options) {
    super(options);
  }
}

const client = new ExtendedClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// ================= PLAYER =================

const player = new Player(client);

await player.extractors.register(YoutubeiExtractor, {
  authentication: process.env.YT_CREDENTIAL,
  streamOptions: {
    useClient: "ANDROID",
  },
});

await player.extractors.loadDefault(
  (ext) => !["YouTubeExtractor"].includes(ext)
);

// ================= LOAD EVENTS =================

await loadEvents(client);

// ================= LOAD + REGISTER COMMANDS =================

const commands = await loadCommands(client);

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

try {
  if (process.env.DEV_GUILD) {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.DEV_GUILD
      ),
      { body: commands }
    );
    console.log("✅ Registered guild commands");
  } else {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Registered global commands");
  }
} catch (err) {
  console.error("❌ Failed to register commands:", err);
}

// ================= LOGIN =================

await client.login(process.env.DISCORD_TOKEN);

// ================= ERROR HANDLING =================

process.on("unhandledRejection", (reason) => console.error(reason));
process.on("uncaughtException", (error) => console.error(error));
process.on("warning", (warning) => console.error(warning));
