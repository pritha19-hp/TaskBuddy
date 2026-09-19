const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const SECRET_KEY = 'taskbuddy_secret_jwt_key';
const DB_FILE = path.join(__dirname, 'taskbuddy.db');

// Connect to SQLite Database
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('SQLite connection error:', err.message);
  } else {
    console.log('Connected to SQLite Database: taskbuddy.db');
    initDatabase();
  }
});

// Initialize SQL Tables automatically
function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Explicit Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'LoginSignup.html'));
});

app.get('/LoginSignup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'LoginSignup.html'));
});

app.get('/TaskBuddy.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'TaskBuddy.html'));
});

// Serve Static Files
app.use(express.static(path.join(__dirname, '..')));

// JWT Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access token missing' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// --- AUTH ROUTES ---

// 1. Signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ message: err.message });
    if (user) return res.status(400).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
      if (err) return res.status(500).json({ message: err.message });

      const userId = this.lastID;
      const token = jwt.sign({ id: userId, name, email }, SECRET_KEY, { expiresIn: '24h' });
      res.status(201).json({ token, user: { id: userId, name, email } });
    });
  });
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  });
});

// --- TASK CRUD ROUTES ---

// 3. Get User Tasks
app.get('/api/tasks', authenticateToken, (req, res) => {
  db.all(
    'SELECT id, title, description AS desc, due_date AS due, priority, completed FROM tasks WHERE user_id = ? ORDER BY id DESC',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      const tasks = rows.map(t => ({ ...t, completed: Boolean(t.completed) }));
      res.json(tasks);
    }
  );
});

// 4. Create Task
app.post('/api/tasks', authenticateToken, (req, res) => {
  const { title, desc, due, priority } = req.body;

  db.run(
    'INSERT INTO tasks (user_id, title, description, due_date, priority, completed) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, title, desc, due, priority || 'medium', 0],
    function(err) {
      if (err) return res.status(500).json({ message: err.message });

      res.status(201).json({
        id: this.lastID,
        userId: req.user.id,
        title,
        desc,
        due,
        priority: priority || 'medium',
        completed: false
      });
    }
  );
});

// 5. Update Task
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const taskId = req.params.id;
  const { title, desc, due, priority, completed } = req.body;

  db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, req.user.id], (err, task) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const newTitle = title !== undefined ? title : task.title;
    const newDesc = desc !== undefined ? desc : task.description;
    const newDue = due !== undefined ? due : task.due_date;
    const newPriority = priority !== undefined ? priority : task.priority;
    const newCompleted = completed !== undefined ? (completed ? 1 : 0) : task.completed;

    db.run(
      'UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, completed = ? WHERE id = ? AND user_id = ?',
      [newTitle, newDesc, newDue, newPriority, newCompleted, taskId, req.user.id],
      function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id: taskId, title: newTitle, desc: newDesc, due: newDue, priority: newPriority, completed: Boolean(newCompleted) });
      }
    );
  });
});

// 6. Delete Task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const taskId = req.params.id;

  db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, req.user.id], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Task not found' });

    res.json({ message: 'Task deleted successfully' });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
