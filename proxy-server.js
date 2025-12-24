const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;
const EASYDNC_API = 'https://www.easydnc.org/api/check_dnc.php';

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/api/check_dnc' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const requestData = JSON.parse(body);
            const authHeader = req.headers['authorization'];
            
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                }
            };

            const apiReq = https.request(EASYDNC_API, options, (apiRes) => {
                let responseData = '';

                apiRes.on('data', chunk => {
                    responseData += chunk;
                });

                apiRes.on('end', () => {
                    res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(responseData);
                });
            });

            apiReq.on('error', (error) => {
                console.error('Proxy error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy server error' }));
            });

            apiReq.write(JSON.stringify(requestData));
            apiReq.end();
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`Proxying requests to: ${EASYDNC_API}`);
});
