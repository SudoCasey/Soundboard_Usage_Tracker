# Discord Soundboard Usage Tracker

This Discord bot tracks the usage of soundboard reactions in your server and provides statistics about which sounds are used most frequently.

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a Discord application and bot at https://discord.com/developers/applications
4. Copy your bot token
5. Edit the `.env` file and replace `your_bot_token_here` with your actual bot token
6. Invite the bot to your server with the following permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Use Voice Activity

## Usage

1. Start the bot:
   ```bash
   npm start
   ```

2. The bot will automatically track all soundboard usage in your server.

3. Use the following command to view statistics:
   - `!soundstats` - Shows a list of all sounds and how many times they've been used

## Features

- Tracks all soundboard usage across servers
- Maintains count of how often each sound is used
- Stores usage history with timestamps and user IDs
- Provides sorted statistics showing most popular sounds
- Works across multiple servers simultaneously

## Note

Make sure to keep your bot token private and never share it with others. 