require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// --- SECURE CORS CONFIG ---
app.use(cors({
    origin: 'https://questarchivetest.vercel.app', // Your Vercel Domain
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'], // Removed ngrok headers
    credentials: true
}));

app.use(express.json());

// --- DATABASE CONNECTION ---
const SB_URL = process.env.SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fail-safe: Render will log this if variables are missing
if (!SB_URL || !SB_SERVICE_KEY) {
    console.error("❌ CRITICAL: Environment Variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing!");
    process.exit(1); 
}

const supabase = createClient(SB_URL, SB_SERVICE_KEY);

// --- ROUTES ---

// Health Check for Render
app.get('/', (req, res) => {
    res.status(200).send("Gateway Operational");
});

// Main Verification Route
app.post('/verify', async (req, res) => {
    try {
        const { hardware_id, details } = req.body;
        
        // Detect Global Public IP
        let detected_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (detected_ip.includes(',')) {
            detected_ip = detected_ip.split(',')[0].trim();
        }
        detected_ip = detected_ip.replace('::ffff:', '');

        console.log(`[VERIFY] HWID: ${hardware_id.slice(0,8)} | IP: ${detected_ip}`);

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

        if (error) throw error;

        if (data.status === 'allowed') {
            res.json({ 
                status: 'allowed', 
                remaining: data.remaining, 
                download_url: process.env.FILE_DOWNLOAD_URL || 'https://link.testfile.org/500MB' 
            });
        } else {
            res.status(429).json({
                status: 'denied',
                reason: data.reason,
                remaining: 0
            });
        }

    } catch (err) {
        console.error("Internal Error:", err.message);
        res.status(500).json({ status: 'error', message: "Internal Gateway Error" });
    }
});

// Start Server on Render's Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gateway Live on Port ${PORT}`);
});
