// proxy-forward.mjs — local unauthenticated forwarding proxy for testing.
// Headless Chrome on this VM cannot complete a CONNECT tunnel to the egress
// proxy directly (ERR_TUNNEL_CONNECTION_FAILED), although curl and raw
// sockets can. This tiny forwarder listens on 127.0.0.1:18080 and relays
// CONNECT/HTTP through the egress proxy (198.19.0.1:3128), which Chrome
// reaches fine over localhost. Test-only tool; not part of the app.
// Usage: node proxy-forward.mjs   (runs in foreground)
import net from 'node:net';

const UPSTREAM_HOST = '198.19.0.1';
const UPSTREAM_PORT = 3128;
const LISTEN_PORT = 18080;

const server = net.createServer((client) => {
  let buf = Buffer.alloc(0);
  let upstream = null;
  let connected = false;
  const onData = (chunk) => {
    if (connected) return;
    buf = Buffer.concat([buf, chunk]);
    const end = buf.indexOf('\r\n\r\n');
    if (end === -1) return;
    const head = buf.slice(0, end).toString();
    const rest = buf.slice(end + 4);
    const [method, target] = head.split(' ');
    client.removeListener('data', onData);
    if (method === 'CONNECT') {
      upstream = net.createConnection(UPSTREAM_PORT, UPSTREAM_HOST, () => {
        upstream.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\nProxy-Connection: keep-alive\r\n\r\n`);
      });
      let upBuf = Buffer.alloc(0);
      upstream.on('data', (d) => {
        if (!connected) {
          upBuf = Buffer.concat([upBuf, d]);
          const e2 = upBuf.indexOf('\r\n\r\n');
          if (e2 === -1) return;
          const resp = upBuf.slice(0, e2).toString();
          if (!resp.includes(' 200')) {
            client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
            upstream.destroy();
            return;
          }
          connected = true;
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          const leftover = upBuf.slice(e2 + 4);
          if (leftover.length) client.write(leftover);
          if (rest.length) upstream.write(rest);
          upstream.pipe(client);
          client.pipe(upstream);
        }
      });
      upstream.on('error', () => client.destroy());
    } else {
      // Plain HTTP: forward the absolute-form request to the upstream proxy.
      upstream = net.createConnection(UPSTREAM_PORT, UPSTREAM_HOST, () => {
        upstream.write(Buffer.concat([Buffer.from(head + '\r\n\r\n'), rest]));
        connected = true;
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on('error', () => client.destroy());
    }
  };
  client.on('data', onData);
  client.on('error', () => { if (upstream) upstream.destroy(); });
});
server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`forwarding proxy on 127.0.0.1:${LISTEN_PORT} -> ${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});
