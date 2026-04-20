require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./db');

const helmet = require('helmet');
const validator = require('validator');

const app = express();
const PORT = 3000;


app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  })
);


// 管理ページのログイン情報
const ADMIN_USER = process.env.ADMIN_USER 
const ADMIN_PASS = process.env.ADMIN_PASS

// Basic認証
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('認証が必要です');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('ユーザー名またはパスワードが違います');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// トップページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 紹介ページ
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// お問い合わせページ
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});



app.post('/admin/inquiries/read', basicAuth, (req, res) => {
  const id = req.body.id;
  if (!req.body.id) {
    return res.status(400).send('IDが不正です');
  } 

  db.run(
    "UPDATE inquiries SET isRead = 1 WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('更新に失敗しました');
      }
      res.redirect('/admin/inquiries');
    }
  );
});


app.post('/admin/inquiries/delete', basicAuth, (req, res) => {
  const id = req.body.id;
  if (!req.body.id) {
    return res.status(400).send('IDが不正です');
  }
  db.run(
    "DELETE FROM inquiries WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('削除に失敗しました');
      }
      res.redirect('/admin/inquiries');
    }
  );
});


app.post('/contact', (req, res) => {
  const now = Date.now();
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const message = String(req.body.message || '').trim();

  // 入力チェック
  if (!name || name.length > 100) {
    return res.status(400).send('名前が不正です');
  }

  if (!validator.isEmail(email)) {
    return res.status(400).send('メールアドレスが不正です');
  }

  if (!message || message.length > 2000) {
    return res.status(400).send('お問い合わせ内容が不正です');
  }

  // DB保存
  db.run(
    `INSERT INTO inquiries (id, name, email, message, createdAt, isRead, createdAtMs)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [  
      now.toString(),
      name,
      validator.normalizeEmail(email) || email,
      message,
      new Date(now).toLocaleString('ja-JP'),
      0,
      now
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('保存に失敗しました');
      }
      res.send('お問い合わせを受け付けました');
    }
  );
});


//スパム対策
app.post('/inquiry', (req, res) => {
  const { name, email, message, website } = req.body;

  if (website) {
    return res.status(400).send('送信に失敗しました');
  }

  if (!name || !email || !message) {
    return res.status(400).send('未入力の項目があります');
  }

  const createdAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const createdAtMs = Date.now();

  db.run(
    `INSERT INTO inquiries (name, email, message, createdAt, createdAtMs, isRead)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, message, createdAt, createdAtMs, 0],
    function (err) {
      if (err) {
        console.error('保存エラー:', err);
        return res.status(500).send('保存に失敗しました');
      }
      res.send('お問い合わせを受け付けました');
    }
  );
});





// 管理ページ（Basic認証あり）
app.get('/admin/inquiries', basicAuth, (req, res) => {

  db.all("SELECT * FROM inquiries ORDER BY createdAtMs DESC", (err, inquiries) => {
    if (err) {
       return res.status(500).send('DBエラー');
    }
    const rows = inquiries.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.name || '')}</td>
        <td>${escapeHtml(item.email || '')}</td>
        <td>${escapeHtml(item.message || '')}</td>
        <td>${escapeHtml(item.createdAt || '-')}</td>
        <td>
          ${
            item.isRead
              ? '既読'
              : `
              <form method="POST" action="/admin/inquiries/read" style="display:inline;">
                <input type="hidden" name="id" value="${encodeURIComponent(item.id)}">
                <button type="submit">既読にする</button>
              </form>
            `
          }

          <form method="POST" action="/admin/inquiries/delete" style="display:inline;">
            <input type="hidden" name="id" value="${encodeURIComponent(item.id)}">
            <button type="submit">削除</button>
          </form>
        </td>
      </tr>
    `).join('');

    res.send(`
      <html>
        <body>
          <h1>お問い合わせ一覧</h1>
          <table border="1">
            <tr>
              <th>ID</th><th>名前</th><th>メール</th><th>内容</th><th>日時</th><th>操作</th>
            </tr>
            ${rows}
          </table>


        <div style="display:none;">
          <input type="text" name="website" tabindex="-1" autocomplete="off">
        </div>

        </body>
      </html>
    `);
  });
});

// サーバー起動
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
