const http = require('http');
const os = require('os');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <body style="font-family: monospace; padding: 40px;">
        <h2 style="color:red">🚀 Hello from K3s! v2</h2>
        <p><b>Pod:</b> ${os.hostname()}</p>
        <p><b>Node IP:</b> ${
          Object.values(os.networkInterfaces())
            .flat()
            .find((i) => i.family === 'IPv4' && !i.internal)?.address ||
          'unknown'
        }</p>
        <p><b>Time:</b> ${new Date().toISOString()}</p>
      </body>
    </html>
  `);
});

server.listen(3000, () => console.log('Server running on port 3000'));
