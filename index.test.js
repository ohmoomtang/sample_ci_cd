const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');

test('server responds with 200', (t, done) => {
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('ok');
  });

  server.listen(0, () => {
    const { port } = server.address();
    http.get(`http://localhost:${port}`, (res) => {
      assert.strictEqual(res.statusCode, 200);
      server.close(done);
    });
  });
});
