// In-memory store for rate limiting (Resets when Vercel spins down the instance)
const rateLimits = new Map();

// Helper to get today's date string (e.g., "2026-07-25")
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

export default async function handler(req, res) {
    // Enable CORS for local development (Vercel automatically handles this in prod usually, but good practice)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        console.error("Missing GROQ_API_KEY environment variable.");
        res.status(500).json({ error: "Server configuration error. API key is missing." });
        return;
    }

    // Rate Limiting Logic
    const MAX_USERS_PER_DAY = 100;
    const MAX_REQUESTS_PER_USER = 50;

    // Get client IP address
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1';
    const today = getTodayDateString();

    // Clear old data if the date changed (in case the instance stays warm across midnight)
    for (const [key, data] of rateLimits.entries()) {
        if (data.date !== today) {
            rateLimits.delete(key);
        }
    }

    if (!rateLimits.has(ip)) {
        if (rateLimits.size >= MAX_USERS_PER_DAY) {
            res.status(429).json({ error: "Global daily user limit reached. Please try again tomorrow." });
            return;
        }
        rateLimits.set(ip, { count: 0, date: today });
    }

    const userData = rateLimits.get(ip);

    if (userData.count >= MAX_REQUESTS_PER_USER) {
        res.status(429).json({ error: `You have reached your daily limit of ${MAX_REQUESTS_PER_USER} requests. Please try again tomorrow.` });
        return;
    }

    const body = req.body;

    if (!body || !body.messages) {
        res.status(400).json({ error: "Invalid request. 'messages' array is required." });
        return;
    }

    // Increment request count
    userData.count++;

    try {
        // Forward request to Groq API
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: body.model || 'llama3-8b-8192',
                messages: body.messages,
                temperature: body.temperature || 0.7,
                max_tokens: body.max_tokens || 400
            })
        });

        const data = await groqResponse.json();

        if (!groqResponse.ok) {
            res.status(groqResponse.status).json({ error: data.error?.message || "Failed to communicate with AI API" });
            return;
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Groq API Fetch Error:", error);
        res.status(500).json({ error: "Internal Server Error during AI request." });
    }
}
