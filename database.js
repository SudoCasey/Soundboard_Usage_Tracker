const { Pool } = require('pg');

// Create a new pool using environment variables
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create the soundboard_stats table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS soundboard_stats (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                sound_id TEXT NOT NULL,
                sound_name TEXT NOT NULL,
                emoji TEXT,
                is_custom BOOLEAN DEFAULT false,
                usage_count INTEGER DEFAULT 0,
                last_used TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(guild_id, sound_id)
            );

            CREATE INDEX IF NOT EXISTS idx_guild_sound ON soundboard_stats(guild_id, sound_id);
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Update or insert sound statistics
async function upsertSoundStats(guildId, soundId, soundName, emoji, isCustom) {
    try {
        const result = await pool.query(`
            INSERT INTO soundboard_stats (guild_id, sound_id, sound_name, emoji, is_custom, usage_count, last_used)
            VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (guild_id, sound_id)
            DO UPDATE SET
                sound_name = $3,
                emoji = $4,
                is_custom = $5,
                usage_count = soundboard_stats.usage_count + 1,
                last_used = CURRENT_TIMESTAMP
            RETURNING *;
        `, [guildId, soundId, soundName, emoji, isCustom]);

        return result.rows[0];
    } catch (error) {
        console.error('Error upserting sound stats:', error);
        throw error;
    }
}

// Get all sound statistics for a guild
async function getGuildSoundStats(guildId) {
    try {
        const result = await pool.query(`
            SELECT * FROM soundboard_stats
            WHERE guild_id = $1
            ORDER BY usage_count DESC;
        `, [guildId]);

        return result.rows;
    } catch (error) {
        console.error('Error getting guild sound stats:', error);
        throw error;
    }
}

// Get total usage count for a specific sound in a guild
async function getSoundUsageCount(guildId, soundId) {
    try {
        const result = await pool.query(`
            SELECT usage_count
            FROM soundboard_stats
            WHERE guild_id = $1 AND sound_id = $2;
        `, [guildId, soundId]);

        return result.rows[0]?.usage_count || 0;
    } catch (error) {
        console.error('Error getting sound usage count:', error);
        throw error;
    }
}

module.exports = {
    initializeDatabase,
    upsertSoundStats,
    getGuildSoundStats,
    getSoundUsageCount,
    pool
}; 