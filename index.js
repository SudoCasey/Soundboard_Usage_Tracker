require('dotenv').config();
const { Client, GatewayIntentBits, Events, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus } = require('@discordjs/voice');

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

// Store soundboard usage statistics
const soundboardStats = new Map();
// Store voice connections
const voiceConnections = new Map();

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
    console.log(`Bot is in ${c.guilds.cache.size} servers`);
    
    // Check permissions in all guilds
    c.guilds.cache.forEach(guild => {
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
        }
    });
});

// Track voice states to detect soundboard usage
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const member = newState.member;
    const guildId = newState.guild.id;
    const userId = member.user.id;
    
    console.log('Voice state change detected:', {
        user: member.user.tag,
        guildId: guildId,
        oldChannel: oldState.channel?.name,
        newChannel: newState.channel?.name,
        oldSuppressed: oldState.suppress,
        newSuppressed: newState.suppress,
        oldStreaming: oldState.streaming,
        newStreaming: newState.streaming,
        timestamp: new Date().toISOString()
    });

    // Detect potential soundboard usage through voice state changes
    if (!oldState.suppress && newState.suppress) {
        console.log('Potential soundboard usage detected');
        const timestamp = new Date().toISOString();
        const soundName = `Sound at ${timestamp}`;

        // Create guild entry if it doesn't exist
        if (!soundboardStats.has(guildId)) {
            soundboardStats.set(guildId, new Map());
        }
        const guildStats = soundboardStats.get(guildId);

        // Create or update sound entry
        if (!guildStats.has(soundName)) {
            guildStats.set(soundName, {
                name: soundName,
                usageCount: 0,
                usageHistory: []
            });
        }

        // Update statistics
        const soundStats = guildStats.get(soundName);
        soundStats.usageCount++;
        soundStats.usageHistory.push({
            userId,
            timestamp
        });

        console.log('Updated soundboard statistics:', {
            guildId,
            soundName,
            newCount: soundStats.usageCount
        });
    }
});

// Listen for raw gateway events as backup
client.on('raw', async packet => {
    if (packet.t) {
        console.log('Raw event:', packet.t);
        
        // Look for any sound-related events
        if (packet.t.includes('SOUND') || 
            packet.t.includes('VOICE') || 
            packet.t.includes('AUDIO')) {
            console.log('Potential sound-related event:', packet);
        }
    }
});

// Command handler
client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Handle !join command
    if (message.content.toLowerCase() === '!join') {
        // Check if the user is in a voice channel
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            await message.reply('You need to be in a voice channel first!');
            return;
        }

        try {
            console.log('Attempting to join voice channel:', voiceChannel.name);
            
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            // Set up connection status handling
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('Voice connection is ready!');
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

            await message.reply(`Joined ${voiceChannel.name}!`);
            console.log(`Successfully joined voice channel: ${voiceChannel.name}`);
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
        const guildStats = soundboardStats.get(message.guildId);
        
        if (!guildStats || guildStats.size === 0) {
            await message.reply('No soundboard statistics available yet!');
            return;
        }

        // Convert stats to array and sort by usage count
        const statsArray = Array.from(guildStats.entries())
            .map(([soundName, stats]) => ({
                name: stats.name,
                count: stats.usageCount
            }))
            .sort((a, b) => b.count - a.count);

        // Create a formatted message
        const statsMessage = ['**Soundboard Usage Statistics:**']
            .concat(statsArray.map((stat, index) => 
                `${index + 1}. "${stat.name}" - Used ${stat.count} times`
            ))
            .join('\n');

        await message.reply(statsMessage);
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord with error handling
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('Successfully logged in and established connection');
    })
    .catch((error) => {
        console.error('Failed to log in:', error);
    }); 