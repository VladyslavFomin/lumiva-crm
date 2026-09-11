// Proxy: rewrites Metro manifest URLs so ngrok HTTPS tunnel works with Expo Go
// Metro always puts http://SOMEHOST:8081/ in bundle URLs.
// ngrok serves on HTTPS port 443 only, so Expo Go can't reach :8081 through it.
// This proxy rewrites any http://ANY_HOST:8081/ → https://NGROK_HOST/ before
// returning the manifest to Expo Go.
const http = require('http');

const METRO_PORT = 8081;
const PROXY_PORT = 7001;
const NGROK_HOST = process.env.NGROK_HOST || '';

function fetchFromMetro(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: METRO_PORT,
      path: path,
      method: 'GET',
      headers: { ...headers, host: `localhost:${METRO_PORT}` },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const result = await fetchFromMetro(req.url, req.headers);
    const ct = result.headers['content-type'] || '';

    // Rewrite JSON manifest: replace any http://HOST:8081/ → https://NGROK_HOST/
    if (ct.includes('application/json') && NGROK_HOST) {
      let body = result.body.toString('utf8');

      // Replace http://ANY_HOST:PORT/  →  https://NGROK_HOST/
      body = body.replace(new RegExp(`http://[^/"]+:${METRO_PORT}/`, 'g'), `https://${NGROK_HOST}/`);
      // Replace http://ANY_HOST:PORT (no trailing slash)
      body = body.replace(new RegExp(`http://[^/"]+:${METRO_PORT}`, 'g'), `https://${NGROK_HOST}`);
      // Replace bare HOST:PORT occurrences (hostUri / debuggerHost fields)
      body = body.replace(new RegExp(`[^/'"@]+:${METRO_PORT}`, 'g'), NGROK_HOST);

      const buf = Buffer.from(body, 'utf8');
      const outHeaders = {
        ...result.headers,
        'content-length': String(buf.length),
        'ngrok-skip-browser-warning': 'true',
      };
      res.writeHead(result.status, outHeaders);
      res.end(buf);
    } else {
      res.writeHead(result.status, { ...result.headers, 'ngrok-skip-browser-warning': 'true' });
      res.end(result.body);
    }
  } catch (e) {
    res.writeHead(502);
    res.end('Metro not running: ' + e.message);
  }
});

server.listen(PROXY_PORT, () => {
  console.log(`Expo proxy running on :${PROXY_PORT}`);
  console.log(`Metro: http://localhost:${METRO_PORT}`);
  console.log(`NGROK_HOST: ${NGROK_HOST}`);
  if (!NGROK_HOST) console.warn('WARNING: NGROK_HOST not set — manifest rewriting disabled');
});
