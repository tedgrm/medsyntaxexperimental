// Minimal static file server for local development and Playwright tests.
// Serves the site/ folder so /workspace/ can resolve its ../scripts and
// ../index.html references. No dependencies beyond Node itself.
//
// Usage: node server.js            (PORT defaults to 8080)
//        PORT=3000 node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'site');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
    res.end(body);
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'Method Not Allowed');
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
        return send(res, 400, 'Bad Request');
    }

    // Resolve inside ROOT only; block path traversal.
    let filePath = path.join(ROOT, pathname);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        return send(res, 403, 'Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
        if (!err && stat.isDirectory()) {
            // Redirect /workspace -> /workspace/ so relative URLs resolve correctly.
            if (!pathname.endsWith('/')) {
                res.writeHead(301, {Location: pathname + '/'});
                return res.end();
            }
            filePath = path.join(filePath, 'index.html');
        }

        fs.readFile(filePath, (readErr, data) => {
            if (readErr) return send(res, 404, 'Not Found');
            const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
            res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'});
            res.end(req.method === 'HEAD' ? undefined : data);
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Serving ${ROOT} at http://${HOST}:${PORT}/ (workspace: http://${HOST}:${PORT}/workspace/)`);
});
