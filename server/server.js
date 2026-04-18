// ============================================================
// 智学 API 代理服务器
// ============================================================
// 架构说明：
//   前端 → 本代理服务器 → DeepSeek API
//
// 安全设计：
//   1. API Key 仅存储在服务端 .env 文件中，前端永远无法获取
//   2. 仅转发 /api/chat 请求到 DeepSeek，拒绝其他路径
//   3. CORS 白名单限制，只允许指定来源访问
//   4. 请求频率限制（简易版），防止滥用
//   5. 流式响应透传，支持 SSE
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// ============ 安全检查 ============
if (!API_KEY || API_KEY === 'sk-your-api-key-here') {
    console.error('❌ 错误：请在 server/.env 文件中设置 DEEPSEEK_API_KEY');
    process.exit(1);
}

// ============ CORS 配置（白名单模式）============
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // 允许无 origin 的请求（如 Postman、服务端请求）
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            console.warn(`🚫 CORS 拒绝来源: ${origin}`);
            callback(new Error('CORS policy: 此来源不被允许'));
        }
    },
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// ============ 简易频率限制 ============
const rateLimitMap = new Map(); // ip → { count, resetTime }
const RATE_LIMIT = 30;       // 每个窗口期内最大请求数
const RATE_WINDOW = 60 * 1000; // 窗口期 60 秒

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
        return next();
    }

    if (entry.count >= RATE_LIMIT) {
        return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }

    entry.count++;
    next();
}

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ============ 核心：聊天代理接口 ============
app.post('/api/chat', rateLimiter, async (req, res) => {
    const { messages, model = 'deepseek-chat', stream = true, max_tokens = 2048, temperature = 0.7 } = req.body;

    // 参数校验
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages 参数必填且为非空数组' });
    }

    console.log(`📥 代理请求: model=${model}, messages=${messages.length}条, stream=${stream}`);

    try {
        // 构建转发到 DeepSeek 的请求
        const upstreamHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`   // 密钥仅在此处注入
        };

        const upstreamBody = { model, messages, stream, max_tokens, temperature };

        const upstreamResp = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: upstreamHeaders,
            body: JSON.stringify(upstreamBody)
        });

        if (!upstreamResp.ok) {
            const errData = await upstreamResp.json().catch(() => ({}));
            const errMsg = errData.error?.message || `上游 API 错误 (${upstreamResp.status})`;
            console.error(`❌ 上游错误: ${errMsg}`);
            return res.status(upstreamResp.status).json({ error: errMsg });
        }

        // ---------- 流式响应：SSE 透传 ----------
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Nginx 兼容

            const reader = upstreamResp.body.getReader();
            const decoder = new TextDecoder();

            // 客户端断开时取消上游请求
            req.on('close', () => {
                reader.cancel().catch(() => {});
            });

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    res.write(chunk);
                }
            } catch (readErr) {
                console.error('流式读取错误:', readErr.message);
            }

            res.end();
            console.log('📤 流式响应完成');
        }
        // ---------- 非流式响应 ----------
        else {
            const data = await upstreamResp.json();
            res.json(data);
            console.log('📤 非流式响应完成');
        }

    } catch (err) {
        console.error('❌ 代理异常:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: '代理服务器内部错误' });
        } else {
            res.end();
        }
    }
});

// ============ 启动服务器 ============
app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     🚀 智学 API 代理服务器已启动         ║');
    console.log(`║     地址: http://localhost:${PORT}            ║`);
    console.log('║     接口: POST /api/chat                 ║');
    console.log('╚══════════════════════════════════════════╝');
});
