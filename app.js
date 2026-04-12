const http = require('node:http');

const host = '127.0.0.1';
const port = 3000;

const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Node App</title>
</head>
<body>
  <h1>Hello Node.js!</h1>
  <p>ブラウザにHTMLが表示されました。</p>
  <p>TEST</p>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
