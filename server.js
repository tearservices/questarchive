require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// --- CORS: MUST MATCH YOUR VERCEL URL EXACTLY ---
app.use(cors({
    origin: 'https://questarchivetest.vercel.app',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use(express.json());

// --- DATABASE ---
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// This prevents the "Status 1" crash by logging the error instead of dying silently
if (!SB_URL || !SB_KEY) {
    console.error("❌ KEY ERROR: Check Render Environment Variables!");
}

const supabase = createClient(SB_URL || "https://placeholder.co", SB_KEY || "placeholder");

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => res.send("Server is Live"));

// Verification Route
app.post('/verify', async (req, res) => {
    console.log("Request received from Vercel");
    try {
        const { hardware_id, details } = req.body;
        
        const { data, error } = await supabase.rpc('handle_download_attempt', {
            u_cpu: parseInt(details.cpu) || 0,
            u_fingerprint: hardware_id,
            u_gpu: details.gpu || "Unknown",
            u_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            u_lang: details.lang || "en",
            u_res: details.res || "0x0",
            u_ua: details.ua || "Unknown"
        });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Listening on port ${PORT}`);
});
