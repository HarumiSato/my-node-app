const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inquiries.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      message TEXT,
      createdAt TEXT,
      createdAtMs INTEGER,
      isRead INTEGER DEFAULT 0
    )
  `);
});

module.exports = db;
