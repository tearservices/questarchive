const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// --- SECURITY: CORS CONFIG ---
// When you deploy to Vercel, replace '*' with your actual Vercel URL
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// --- SECURE CONFIGURATION ---
// These pull from your System Environment Variables (Secrets)
const SB_URL = process.env.SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Safety check to ensure the server doesn't start without keys
if (!SB_URL || !SB_SERVICE_KEY) {
    console.error("❌ CRITICAL ERROR: Supabase Environment Variables are missing!");
    process.exit(1);
}

const supabase = createClient(SB_URL, SB_SERVICE_KEY);

app.post('/verify', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Inbound Verification Request`);
    
    try {
        const { hardware_id, details } = req.body;
        
        // IP Detection (Cloudflare/Proxy compatible)
        let detected_ip = req.headers['cf-connecting-ip'] || 
                          req.headers['x-forwarded-for'] || 
                          req.socket.remoteAddress;

        if (detected_ip && detected_ip.includes(',')) {
            detected_ip = detected_ip.split(',')[0].trim();
        }
        detected_ip = detected_ip.replace('::ffff:', '');

        // Supabase RPC Handshake
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
            res.status(429).json(data);
        }
    } catch (err) {
        console.error("Gateway Error:", err.message);
        res.status(500).json({ status: 'error', message: "Internal Security Error" });
    }
});

// Root check for health monitoring
app.get('/', (req, res) => res.send("Gateway Operational"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Secure Gateway online on port ${PORT}`);
});