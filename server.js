require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// --- RENDER & VERCEL INTEGRATION: CORS ---
app.use(cors({
    // Replace '*' with your actual Vercel URL for maximum security
    origin: ['https://questarchivetest.vercel.app', 'http://localhost:3000'], 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
    credentials: true
}));

app.use(express.json());

// --- DATABASE CONNECTION ---
const SB_URL = process.env.SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_SERVICE_KEY) {
    console.error("❌ ERROR: Missing Supabase Environment Variables on Render!");
    process.exit(1);
}

const supabase = createClient(SB_URL, SB_SERVICE_KEY);

// --- ROUTES ---

// 1. Health Check (Required for Render to stay "Live")
app.get('/', (req, res) => {
    res.status(200).send("Gateway Operational: System Online");
});

// 2. The Verification Logic
app.post('/verify', async (req, res) => {
    try {
        const { hardware_id, details } = req.body;
        
        // Render/Cloudflare IP Detection
        let detected_ip = req.headers['cf-connecting-ip'] || 
                          req.headers['x-forwarded-for'] || 
                          req.socket.remoteAddress;

        if (detected_ip && detected_ip.includes(',')) {
            detected_ip = detected_ip.split(',')[0].trim();
        }
        detected_ip = detected_ip.replace('::ffff:', '');

        console.log(`[AUTH ATTEMPT] IP: ${detected_ip} | HWID: ${hardware_id.slice(0,8)}`);

        // Supabase RPC Call
        const { data, error } = await supabase.rpc('handle_download_attempt', {
            u_cpu: parseInt(details.cpu) || 0,
            u_fingerprint: hardware_id,
            u_gpu: details.gpu || "Unknown",
            u_ip: detected_ip,
            u_lang: details.lang || "en",
            u_res: details.res || "0x0",
            u_ua: details.ua || "Unknown"
        });

        if (error) {
            console.error("Supabase Error:", error.message);
            throw error;
        }

        if (data.status === 'allowed') {
            res.json({ 
                status: 'allowed', 
                remaining: data.remaining, 
                download_url: process.env.FILE_DOWNLOAD_URL || 'https://link.testfile.org/500MB' 
            });
        } else {
            res.status(429).json(data);
        }
    } catch (err) {
        console.error("Server Error:", err.message);
        res.status(500).json({ status: 'error', message: "Internal Verification Error" });
    }
});

// --- RENDER PORT BINDING ---
// Render assigns a random port; process.env.PORT catches it automatically.
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gateway deployed successfully on port ${PORT}`);
});
