const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '3000'
  ? `${window.location.origin}/api` 
  : null;

let currentFilter = 'all';
let tasksCache = [];

// --- DARK MODE TOGGLE ---
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('tb_theme', isDark ? 'dark' : 'light');
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.innerText = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function initTheme() {
  const savedTheme = localStorage.getItem('tb_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.innerText = '☀️ Light Mode';
  }
}

// --- AUTHENTICATION ---
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (tabLogin) tabLogin.classList.add('active');
    if (tabSignup) tabSignup.classList.remove('active');
  } else {
    if (signupForm) signupForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (tabSignup) tabSignup.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name')?.value.trim() || '';
  const email = document.getElementById('signup-email')?.value.trim() || '';
  const password = document.getElementById('signup-password')?.value || '';

  if (!email || !password) {
    alert('Please enter your email and password');
    return;
  }

  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem('tb_token', data.token);
      localStorage.setItem('tb_user', JSON.stringify(data.user));
      window.location.href = 'TaskBuddy.html';
    } catch (err) {
      alert(err.message);
    }
  } else {
    // Standalone Web Mode for GitHub Pages
    const users = JSON.parse(localStorage.getItem('tb_users') || '[]');
    if (users.some(u => u.email === email)) {
      alert('Email already registered!');
      return;
    }

    const newUser = { id: Date.now(), name: name || 'User', email };
    users.push({ ...newUser, password });
    localStorage.setItem('tb_users', JSON.stringify(users));
    localStorage.setItem('tb_token', 'demo_token_' + Date.now());
    localStorage.setItem('tb_user', JSON.stringify(newUser));
    window.location.href = 'TaskBuddy.html';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';

  if (!email || !password) {
    alert('Please enter your email and password');
    return;
  }

  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem('tb_token', data.token);
      localStorage.setItem('tb_user', JSON.stringify(data.user));
      window.location.href = 'TaskBuddy.html';
    } catch (err) {
      alert(err.message);
    }
  } else {
    // Standalone Web Mode for GitHub Pages
    const users = JSON.parse(localStorage.getItem('tb_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      alert('Invalid email or password!');
      return;
    }

    localStorage.setItem('tb_token', 'demo_token_' + Date.now());
    localStorage.setItem('tb_user', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
    window.location.href = 'TaskBuddy.html';
  }
}

function logout() {
  localStorage.removeItem('tb_token');
  localStorage.removeItem('tb_user');
  window.location.href = 'LoginSignup.html';
}

function getToken() {
  return localStorage.getItem('tb_token');
}

// --- TASK CRUD OPERATIONS ---
async function fetchTasks() {
  const token = getToken();
  if (!token) return;

  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      tasksCache = await res.json();
      renderTasks();
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  } else {
    // Standalone Web Mode for GitHub Pages
    const user = JSON.parse(localStorage.getItem('tb_user') || '{}');
    const allTasks = JSON.parse(localStorage.getItem('tb_tasks') || '[]');
    tasksCache = allTasks.filter(t => t.userId === user.id);
    renderTasks();
  }
}

function isOverdue(dueDateStr, completed) {
  if (completed || !dueDateStr) return false;
  const today = new Date().toISOString().split('T')[0];
  return dueDateStr < today;
}

function renderTasks() {
  const taskGrid = document.getElementById('task-list');
  if (!taskGrid) return;

  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase();

  const filtered = tasksCache.filter(task => {
    const taskOverdue = isOverdue(task.due, task.completed);
    const matchesFilter = 
      currentFilter === 'all' ? true :
      currentFilter === 'completed' ? task.completed :
      currentFilter === 'pending' ? !task.completed :
      currentFilter === 'overdue' ? taskOverdue : true;
    
    const matchesSearch = task.title.toLowerCase().includes(searchQuery) ||
                          (task.desc || '').toLowerCase().includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    taskGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">No tasks found.</p>`;
    return;
  }

  taskGrid.innerHTML = filtered.map(task => {
    const overdue = isOverdue(task.due, task.completed);
    const catClass = `cat-${(task.category || 'Personal').toLowerCase()}`;

    return `
      <div class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}">
        <div>
          <div class="task-header">
            <div class="task-badges">
              <span class="priority-badge priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
              <span class="category-badge ${catClass}">${task.category || 'Personal'}</span>
            </div>
            <small style="color: ${overdue ? '#e53e3e' : 'inherit'}; font-weight: ${overdue ? 'bold' : 'normal'};">
              Due: ${task.due || 'N/A'}
            </small>
          </div>
          <h4>${task.title}</h4>
          <p style="font-size: 14px; color: var(--text-muted, #555); margin-top: 6px;">${task.desc || ''}</p>
          ${overdue ? '<div class="overdue-tag">⚠️ Overdue Task</div>' : ''}
        </div>
        <div class="task-actions">
          <button class="btn-complete" onclick="toggleTask(${task.id}, ${task.completed})">
            ${task.completed ? 'Undo' : 'Complete'}
          </button>
          <button class="btn-edit" onclick="editTask(${task.id})">Edit</button>
          <button class="btn-delete" onclick="deleteTask(${task.id})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function openTaskModal() {
  const taskIdEl = document.getElementById('task-id');
  const titleEl = document.getElementById('modal-title');
  const submitBtnEl = document.getElementById('modal-submit-btn');
  const formEl = document.getElementById('task-form');
  const modalEl = document.getElementById('task-modal');

  if (taskIdEl) taskIdEl.value = '';
  if (titleEl) titleEl.innerText = 'Create New Task';
  if (submitBtnEl) submitBtnEl.innerText = 'Save Task';
  if (formEl) formEl.reset();
  if (modalEl) modalEl.classList.remove('hidden');
}

function editTask(id) {
  const task = tasksCache.find(t => t.id == id);
  if (!task) return;

  const taskIdEl = document.getElementById('task-id');
  const titleEl = document.getElementById('modal-title');
  const submitBtnEl = document.getElementById('modal-submit-btn');
  
  if (taskIdEl) taskIdEl.value = task.id;
  if (titleEl) titleEl.innerText = 'Edit Task';
  if (submitBtnEl) submitBtnEl.innerText = 'Update Task';
  
  if (document.getElementById('task-title')) document.getElementById('task-title').value = task.title;
  if (document.getElementById('task-desc')) document.getElementById('task-desc').value = task.desc || '';
  if (document.getElementById('task-due')) document.getElementById('task-due').value = task.due || '';
  if (document.getElementById('task-category')) document.getElementById('task-category').value = task.category || 'Personal';
  if (document.getElementById('task-priority')) document.getElementById('task-priority').value = task.priority || 'medium';

  const modalEl = document.getElementById('task-modal');
  if (modalEl) modalEl.classList.remove('hidden');
}

function closeTaskModal() {
  const formEl = document.getElementById('task-form');
  const modalEl = document.getElementById('task-modal');
  if (formEl) formEl.reset();
  if (modalEl) modalEl.classList.add('hidden');
}

async function saveTask(e) {
  e.preventDefault();
  const token = getToken();
  const taskId = document.getElementById('task-id')?.value || '';
  const title = document.getElementById('task-title')?.value.trim() || '';
  const desc = document.getElementById('task-desc')?.value.trim() || '';
  const due = document.getElementById('task-due')?.value || '';
  const category = document.getElementById('task-category')?.value || 'Personal';
  const priority = document.getElementById('task-priority')?.value || 'medium';

  if (!title) {
    alert('Please enter a task title.');
    return;
  }

  if (API_URL) {
    const method = taskId ? 'PUT' : 'POST';
    const url = taskId ? `${API_URL}/tasks/${taskId}` : `${API_URL}/tasks`;

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, desc, due, category, priority })
      });
      if (!res.ok) throw new Error('Failed to save task');
      closeTaskModal();
      fetchTasks();
    } catch (err) {
      alert(err.message);
    }
  } else {
    // Standalone Web Mode for GitHub Pages
    const user = JSON.parse(localStorage.getItem('tb_user') || '{}');
    let allTasks = JSON.parse(localStorage.getItem('tb_tasks') || '[]');

    if (taskId) {
      const taskIndex = allTasks.findIndex(t => t.id == taskId);
      if (taskIndex !== -1) {
        allTasks[taskIndex] = { ...allTasks[taskIndex], title, desc, due, category, priority };
      }
    } else {
      allTasks.push({ id: Date.now(), userId: user.id, title, desc, due, category, priority, completed: false });
    }

    localStorage.setItem('tb_tasks', JSON.stringify(allTasks));
    closeTaskModal();
    fetchTasks();
  }
}

async function toggleTask(id, currentStatus) {
  const token = getToken();
  if (API_URL) {
    try {
      await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !currentStatus })
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  } else {
    let allTasks = JSON.parse(localStorage.getItem('tb_tasks') || '[]');
    const task = allTasks.find(t => t.id == id);
    if (task) {
      task.completed = !currentStatus;
      localStorage.setItem('tb_tasks', JSON.stringify(allTasks));
      fetchTasks();
    }
  }
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  const token = getToken();
  if (API_URL) {
    try {
      await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  } else {
    let allTasks = JSON.parse(localStorage.getItem('tb_tasks') || '[]');
    allTasks = allTasks.filter(t => t.id != id);
    localStorage.setItem('tb_tasks', JSON.stringify(allTasks));
    fetchTasks();
  }
}

function setFilter(filter, element) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  renderTasks();
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const token = getToken();
  const user = JSON.parse(localStorage.getItem('tb_user') || 'null');
  const isDashboard = window.location.pathname.includes('TaskBuddy.html');

  if (isDashboard) {
    if (!token || !user) {
      window.location.href = 'LoginSignup.html';
    } else {
      const userDisplay = document.getElementById('user-display');
      if (userDisplay) userDisplay.innerText = `Welcome, ${user.name}`;
      fetchTasks();
    }
  }
});