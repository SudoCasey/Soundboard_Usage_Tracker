# Discord Soundboard Usage Tracker

This Discord bot tracks the usage of soundboard reactions in your server and provides statistics about which sounds are used most frequently. It features automatic voice channel management and persistent storage using PostgreSQL.

## Installation Guide

### Prerequisites
1. **Node.js and npm**
   - Download and install Node.js (version 16.x or higher) from https://nodejs.org/
   - This will also install npm (Node Package Manager)
   - Verify installation by running:
     ```bash
     node --version
     npm --version
     ```

2. **PostgreSQL**
   - Download PostgreSQL (version 13 or higher) from https://www.postgresql.org/download/
   - During installation:
     - Remember the password you set for the 'postgres' user
     - Keep the default port (5432)
     - Complete the installation with all default options

3. **Git** (for cloning the repository)
   - Download and install Git from https://git-scm.com/downloads
   - Verify installation:
     ```bash
     git --version
     ```

### Installation Steps

1. **Create Discord Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application" and give it a name
   - Go to the "Bot" section
   - Click "Add Bot"
   - Under "Privileged Gateway Intents", enable:
     - PRESENCE INTENT
     - SERVER MEMBERS INTENT
     - MESSAGE CONTENT INTENT
   - Save changes
   - Copy the bot token (you'll need this later)

2. **Clone and Setup Repository**
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/Soundboard_Usage_Tracker.git
   cd Soundboard_Usage_Tracker

   # Install dependencies
   npm install
   ```

3. **Database Setup**
   ```bash
   # For Windows, open Command Prompt as Administrator and run:
   "C:\Program Files\PostgreSQL\{version}\bin\psql.exe" -U postgres
   
   # For Linux/Mac:
   psql -U postgres

   # Once in the PostgreSQL prompt, create the database:
   CREATE DATABASE soundboard_stats;
   # Type \q to exit
   ```

4. **Configuration**
   - Create a file named `.env` in the project root
   - Add the following content:
     ```
     DISCORD_TOKEN=your_bot_token_here
     DB_USER=postgres
     DB_PASSWORD=your_postgres_password
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=soundboard_stats
     ```
   - Replace `your_bot_token_here` with the bot token you copied earlier
   - Replace `your_postgres_password` with your PostgreSQL password

5. **Invite Bot to Server**
   - Go back to Discord Developer Portal
   - Select your application
   - Go to OAuth2 → URL Generator
   - Select the following scopes:
     - bot
     - applications.commands
   - Select the following bot permissions:
     - Read Messages/View Channels
     - Send Messages
     - Read Message History
     - Use Voice Activity
     - Connect to Voice Channels
     - Speak in Voice Channels
   - Copy the generated URL
   - Open the URL in a browser to invite the bot to your server

6. **Start the Bot**
   ```bash
   npm start
   ```

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a Discord application and bot at https://discord.com/developers/applications
4. Copy your bot token
5. Install PostgreSQL from https://www.postgresql.org/download/
6. Create a database named `soundboard_stats`
7. Configure the `.env` file with:
   ```
   DISCORD_TOKEN=your_bot_token_here
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=soundboard_stats
   ```
8. Invite the bot to your server with the following permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Use Voice Activity
   - Connect to Voice Channels
   - Speak in Voice Channels

## Usage

1. Start the bot:
   ```bash
   npm start
   ```

2. The bot will automatically:
   - Track all soundboard usage in your server
   - Join voice channels when users enter
   - Leave voice channels when only bots remain
   - Store statistics in PostgreSQL database

3. Available Commands:
   - `!soundstats` - Shows a list of all sounds and how many times they've been used
   - `!join` - Manually makes the bot join your current voice channel
   - `!leave` - Manually makes the bot leave the voice channel

## Features

- Soundboard Tracking:
  - Tracks all soundboard usage across servers
  - Displays human-readable sound names instead of IDs
  - Maintains count of how often each sound is used
  - Records emoji and custom/default status for each sound
  - Stores usage history with timestamps

- Automatic Voice Channel Management:
  - Auto-joins voice channels when users enter
  - Auto-leaves when channel is empty (except for bots)
  - Can be manually controlled with commands

- Persistent Storage:
  - PostgreSQL database integration
  - Maintains statistics across bot restarts
  - Efficient querying with database indexing
  - Real-time statistics updates

- Multi-Server Support:
  - Works across multiple servers simultaneously
  - Maintains separate statistics per server
  - Handles concurrent sound usage

## Note

Make sure to:
- Keep your bot token private and never share it with others
- Secure your PostgreSQL credentials
- Ensure the bot has proper permissions in your server 