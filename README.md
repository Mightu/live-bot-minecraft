# Minecraft Survival AI Bot

An upgraded Mineflayer project that behaves like an autonomous survival player instead of a stationary AFK bot.

## What it does
- Continuously evaluates survival priorities
- Searches for and consumes food
- Collects wood and mines basic resources
- Attempts starter-tool progression
- Detects nearby hostile mobs and fights when needed
- Searches for animals when food is required
- Establishes a simple starter shelter
- Explores when no urgent task is available
- Exposes `/health` and `/inventory` monitoring endpoints
- Automatically reconnects after disconnects

## Install
```bash
npm install
npm start
```

Configure the server and bot account in `settings.json` or use `MC_HOST`, `MC_PORT`, `MC_USERNAME`, and `MC_PASSWORD` environment variables.

## Important
This is an autonomous foundation rather than a guarantee that every server configuration will work identically. Minecraft versions, server plugins, protections, permissions, custom recipes, and anti-bot systems can prevent actions such as mining, combat, placement, or crafting.
