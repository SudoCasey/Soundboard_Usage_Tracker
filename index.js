require('dotenv').config();
const { Client, GatewayIntentBits, Events, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus } = require('@discordjs/voice');
const db = require('./database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildIntegrations
    ]
});

// Debug: Log all raw events
client.on('raw', event => {
    console.log('Raw event received:', {
        type: event.t,
        data: event.d
    });
});

// Debug: Log when message events are received
client.on('messageCreate', (message) => {
    console.log('Direct messageCreate event:', {
        content: message.content,
        author: message.author.tag,
        guild: message.guild?.name,
        channel: message.channel.name
    });
});

// Store soundboard usage statistics
const soundboardStats = new Map();
// Store voice connections
const voiceConnections = new Map();
// Store guild sound information
const guildSounds = new Map();

// Function to fetch and store available sounds for a guild
async function updateGuildSounds(guild) {
    try {
        console.log(`Attempting to fetch sounds for guild ${guild.name}...`);

        // Try to fetch sounds using REST API
        try {
            const response = await client.rest.get(`/guilds/${guild.id}/soundboard-sounds`);
            console.log('REST API response:', response);
            
            // Create a map of sound_id to sound info
            const soundMap = new Map();
            response.items.forEach(sound => {
                console.log('Processing sound:', {
                    name: sound.name,
                    guild_id: sound.guild_id,
                    current_guild_id: guild.id,
                    is_custom: sound.guild_id === guild.id
                });
                
                soundMap.set(sound.sound_id, {
                    name: sound.name,
                    emoji: sound.emoji_name ? { name: sound.emoji_name } : null,
                    emoji_id: sound.emoji_id,
                    volume: sound.volume,
                    isCustom: sound.guild_id === guild.id
                });
            });
            
            // Store the sound map for this guild
            guildSounds.set(guild.id, soundMap);
            console.log('Successfully stored sounds:', Array.from(soundMap.entries()));
            return soundMap;
        } catch (restError) {
            console.log('REST API fetch failed:', restError.message);
            return new Map();
        }
    } catch (error) {
        console.error('Error in updateGuildSounds:', error);
        return new Map();
    }
}

client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    console.log(`Bot is in ${c.guilds.cache.size} servers`);
    
    // Initialize database
    try {
        await db.initializeDatabase();
        console.log('Database initialized');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
    
    // Check permissions and fetch sounds for all guilds
    c.guilds.cache.forEach(async guild => {
        const permissions = guild.members.me.permissions;
        const requiredPermissions = [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.UseExternalSounds,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak
        ];

        const missingPermissions = requiredPermissions.filter(perm => !permissions.has(perm));
        
        if (missingPermissions.length > 0) {
            console.warn(`Missing permissions in guild ${guild.name}:`, 
                missingPermissions.map(perm => PermissionsBitField.Flags[perm]).join(', '));
        } else {
            console.log(`All required permissions present in guild: ${guild.name}`);
            // Fetch available sounds for the guild
            await updateGuildSounds(guild);
        }
    });
});

// Listen for raw gateway events to catch soundboard usage
client.on('raw', async packet => {
    if (packet.t === 'VOICE_CHANNEL_EFFECT_SEND') {
        const data = packet.d;
        const guildId = data.guild_id;
        const userId = data.user_id;
        const soundId = data.sound_id;
        const emoji = data.emoji;
        const timestamp = new Date().toISOString();

        // Get the guild's sounds
        const guild = client.guilds.cache.get(guildId);
        let guildSoundMap = guildSounds.get(guildId);
        if (!guildSoundMap || guildSoundMap.size === 0) {
            guildSoundMap = await updateGuildSounds(guild);
        }

        // Get sound information from our cached sounds
        const soundInfo = guildSoundMap.get(soundId);
        
        console.log('Soundboard effect detected:', {
            guild_id: guildId,
            user_id: userId,
            sound_id: soundId,
            sound_name: soundInfo?.name || 'Unknown',
            emoji: emoji?.name
        });

        try {
            // Update database with sound usage
            const dbResult = await db.upsertSoundStats(
                guildId,
                soundId,
                soundInfo?.name || `Unknown Sound (${soundId})`,
                soundInfo?.emoji?.name || emoji?.name || null,
                soundInfo?.isCustom || false
            );

            console.log('Updated database:', dbResult);
        } catch (error) {
            console.error('Error updating database:', error);
        }

        // Update in-memory stats as well (for redundancy)
        if (!soundboardStats.has(guildId)) {
            soundboardStats.set(guildId, new Map());
        }
        const guildStats = soundboardStats.get(guildId);

        const soundName = soundInfo?.name || `Unknown Sound (${soundId})`;
        if (!guildStats.has(soundName)) {
            guildStats.set(soundName, {
                name: soundName,
                soundId: soundId,
                emoji: soundInfo?.emoji || emoji,
                isCustom: soundInfo?.isCustom || false,
                usageCount: 0,
                usageHistory: []
            });
        }

        const soundStats = guildStats.get(soundName);
        soundStats.usageCount++;
        soundStats.usageHistory.push({
            userId,
            timestamp
        });

        console.log('Updated statistics:', {
            guildId,
            soundName: soundStats.name,
            soundId,
            emoji: emoji?.name,
            isCustom: soundStats.isCustom ? 'Custom' : 'Default',
            totalUses: soundStats.usageCount,
            lastUsed: timestamp
        });
    }
});

// Function to join a voice channel
async function joinVoiceChannelAndFetch(voiceChannel) {
    try {
        console.log(`Attempting to join voice channel: ${voiceChannel.name}`);
        
        // Fetch sounds before joining
        console.log('Fetching sounds before joining...');
        await updateGuildSounds(voiceChannel.guild);
        
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
        });

        // Set up connection status handling
        connection.on(VoiceConnectionStatus.Ready, async () => {
            console.log('Voice connection is ready!');
            // Fetch sounds again after connection is ready
            await updateGuildSounds(voiceChannel.guild);
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            console.log('Voice connection disconnected');
            connection.destroy();
            voiceConnections.delete(voiceChannel.guild.id);
        });

        // Create an audio player and subscribe the connection to it
        const player = createAudioPlayer();
        connection.subscribe(player);

        // Store the connection
        voiceConnections.set(voiceChannel.guild.id, connection);
        console.log(`Successfully joined voice channel: ${voiceChannel.name}`);
        
        return connection;
    } catch (error) {
        console.error('Error joining voice channel:', error);
        throw error;
    }
}

// Function to check if a channel only has the bot
function isChannelEmptyExceptBot(channel, botId) {
    return channel.members.every(member => member.user.bot) || 
           channel.members.size === 0;
}

// Add voice state update handler
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        // Ignore bot's own voice state updates
        if (oldState.member.user.bot || newState.member.user.bot) return;

        const guild = newState.guild;
        const botId = client.user.id;
        
        // User joined a voice channel
        if (newState.channel && (!oldState.channel || oldState.channel.id !== newState.channel.id)) {
            console.log(`User ${newState.member.user.tag} joined channel ${newState.channel.name}`);
            
            // Check if we're not already in a voice channel in this guild
            if (!voiceConnections.has(guild.id)) {
                await joinVoiceChannelAndFetch(newState.channel);
            }
        }
        
        // User left a voice channel
        if (oldState.channel) {
            // Wait a short moment to ensure all voice states are updated
            setTimeout(async () => {
                // Check if the old channel is empty except for bots
                if (isChannelEmptyExceptBot(oldState.channel, botId)) {
                    console.log(`Channel ${oldState.channel.name} is empty except for bots, leaving...`);
                    const connection = voiceConnections.get(guild.id);
                    if (connection) {
                        connection.destroy();
                        voiceConnections.delete(guild.id);
                        console.log(`Left empty voice channel: ${oldState.channel.name}`);
                    }
                }
            }, 1000); // 1 second delay to ensure all voice states are updated
        }
    } catch (error) {
        console.error('Error in voice state update handler:', error);
    }
});

// Command handler
client.on(Events.MessageCreate, async (message) => {
    try {
        // Log all incoming messages for debugging
        console.log('MessageCreate event handler:', {
            content: message.content,
            author: message.author.tag,
            guild: message.guild?.name,
            channel: message.channel.name,
            isBot: message.author.bot,
            timestamp: new Date().toISOString()
        });

        // Ignore messages from bots
        if (message.author.bot) {
            console.log('Ignoring message from bot');
            return;
        }

        // Debug: Log command processing
        console.log('Processing command:', message.content);

        // Handle !join command
        if (message.content.toLowerCase() === '!join') {
            const voiceChannel = message.member?.voice.channel;
            if (!voiceChannel) {
                await message.reply('You need to be in a voice channel first!');
                return;
            }

            try {
                await joinVoiceChannelAndFetch(voiceChannel);
                await message.reply(`Joined ${voiceChannel.name}!`);
            } catch (error) {
                console.error('Error joining voice channel:', error);
                await message.reply('Failed to join the voice channel.');
            }
        }

        // Handle !leave command
        else if (message.content.toLowerCase() === '!leave') {
            const connection = voiceConnections.get(message.guild.id);
            if (connection) {
                connection.destroy();
                voiceConnections.delete(message.guild.id);
                await message.reply('Left the voice channel!');
                console.log('Left voice channel');
            } else {
                await message.reply('I\'m not in a voice channel!');
            }
        }

        // Handle !soundstats command
        else if (message.content.toLowerCase() === '!soundstats') {
            console.log('Processing !soundstats command');
            
            try {
                // Get stats from database
                const stats = await db.getGuildSoundStats(message.guildId);
                
                if (!stats || stats.length === 0) {
                    await message.reply('No soundboard statistics available yet!');
                    return;
                }

                // Create a formatted message
                const statsMessage = ['**Soundboard Usage Statistics:**']
                    .concat(stats.map((stat, index) => 
                        `${index + 1}. ${stat.emoji || ''} "${stat.sound_name}" - ${stat.usage_count} Uses`
                    ))
                    .join('\n');

                await message.reply(statsMessage);
            } catch (error) {
                console.error('Error fetching sound stats:', error);
                await message.reply('Error fetching sound statistics.');
            }
        }

        // Handle !refreshsounds command
        else if (message.content.toLowerCase() === '!refreshsounds') {
            try {
                await message.reply('Refreshing sound list...');
                await updateGuildSounds(message.guild);
                const sounds = guildSounds.get(message.guild.id);
                if (sounds && sounds.size > 0) {
                    const soundList = Array.from(sounds.values())
                        .map(s => `${s.emoji?.name || ''} ${s.name}`)
                        .join('\n');
                    await message.reply(`Found ${sounds.size} sounds:\n${soundList}`);
                } else {
                    await message.reply('No sounds found in this server.');
                }
            } catch (error) {
                console.error('Error refreshing sounds:', error);
                await message.reply('Failed to refresh sound list.');
            }
        }

        // Handle !soundboardinfo command
        else if (message.content.toLowerCase() === '!soundboardinfo') {
            console.log('!soundboardinfo command detected');
            try {
                const guild = message.guild;
                if (!guild) {
                    console.log('No guild found for message');
                    await message.reply('This command must be used in a server.');
                    return;
                }

                console.log('Fetching soundboard info for guild:', guild.name);
                
                // Fetch fresh guild data
                console.log('Fetching fresh guild data...');
                const freshGuild = await client.guilds.fetch(guild.id);
                console.log('Fresh guild data fetched:', {
                    id: freshGuild.id,
                    name: freshGuild.name,
                    available: freshGuild.available
                });

                // Log raw soundboard data for debugging
                console.log('Raw soundboard data:', {
                    soundboard: freshGuild.soundboard,
                    sounds: freshGuild.soundboard?.sounds,
                    cache: freshGuild.soundboard?.sounds?.cache
                });

                const debugInfo = {
                    guildId: freshGuild.id,
                    guildName: freshGuild.name,
                    botPermissions: freshGuild.members.me.permissions.toArray(),
                    hasSoundboard: !!freshGuild.soundboard,
                    soundboardFeatures: {
                        hasCache: !!freshGuild.soundboard?.sounds?.cache,
                        cacheSize: freshGuild.soundboard?.sounds?.cache?.size || 0,
                        hasFetch: !!freshGuild.soundboard?.sounds?.fetch,
                        hasCreate: !!freshGuild.soundboard?.sounds?.create
                    },
                    storedSounds: guildSounds.get(freshGuild.id)?.size || 0,
                    trackedStats: soundboardStats.get(freshGuild.id)?.size || 0
                };

                console.log('Debug info compiled:', debugInfo);
                
                const infoMessage = [
                    '**Soundboard Debug Information:**',
                    `Guild ID: ${debugInfo.guildId}`,
                    `Guild Name: ${debugInfo.guildName}`,
                    `Bot Permissions: ${debugInfo.botPermissions.join(', ')}`,
                    `Has Soundboard: ${debugInfo.hasSoundboard}`,
                    `Soundboard Features:`,
                    `- Has Cache: ${debugInfo.soundboardFeatures.hasCache}`,
                    `- Cache Size: ${debugInfo.soundboardFeatures.cacheSize}`,
                    `- Can Fetch: ${debugInfo.soundboardFeatures.hasFetch}`,
                    `- Can Create: ${debugInfo.soundboardFeatures.hasCreate}`,
                    `Stored Sounds: ${debugInfo.storedSounds}`,
                    `Tracked Statistics: ${debugInfo.trackedStats}`
                ].join('\n');

                console.log('Sending info message to channel');
                await message.reply(infoMessage);
                console.log('Info message sent successfully');

                // Try to fetch fresh sounds
                console.log('Attempting to fetch fresh sounds...');
                await updateGuildSounds(freshGuild);
                console.log('Fresh sounds fetch attempt completed');
                
            } catch (error) {
                console.error('Error in !soundboardinfo command:', error);
                await message.reply('Error getting debug information: ' + error.message);
            }
        }
    } catch (error) {
        console.error('Error in message event handler:', error);
    }
});

// Add error event handlers
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Debug: Log database connection
db.pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

db.pool.on('connect', () => {
    console.log('Successfully connected to PostgreSQL database');
});

// Login to Discord with error handling
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('Successfully logged in and established connection');
    })
    .catch((error) => {
        console.error('Failed to log in:', error);
    });

// Add this right after client initialization
client.on('messageCreate', message => {
    console.log('Ping command check:', {
        content: message.content,
        author: message.author.tag
    });
    
    if (message.content.toLowerCase() === '!ping') {
        console.log('Ping command received');
        message.reply('Pong!').then(() => {
            console.log('Pong response sent');
        }).catch(error => {
            console.error('Error sending pong:', error);
        });
    }
}); 