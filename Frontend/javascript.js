
// Global Configuration & State
const API_URL = 'http://localhost:3000/api';
let currentFilter = 'all';
let tasksCache = [];

// --- AUTHENTICATION & TAB SWITCHING ---
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

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
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

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
}

function renderTasks() {
  const taskGrid = document.getElementById('task-list');
  if (!taskGrid) return;

  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase();

  const filtered = tasksCache.filter(task => {
    const matchesFilter = 
      currentFilter === 'all' ? true :
      currentFilter === 'completed' ? task.completed : !task.completed;
    
    const matchesSearch = task.title.toLowerCase().includes(searchQuery) ||
                          task.desc.toLowerCase().includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    taskGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">No tasks found.</p>`;
    return;
  }

  taskGrid.innerHTML = filtered.map(task => `
    <div class="task-card ${task.completed ? 'completed' : ''}">
      <div class="task-header">
        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
        <small>Due: ${task.due}</small>
      </div>
      <h4>${task.title}</h4>
      <p style="font-size: 14px; color: #555; margin-top: 6px;">${task.desc}</p>
      <div class="task-actions">
        <button class="btn-complete" onclick="toggleTask(${task.id}, ${task.completed})">
          ${task.completed ? 'Undo' : 'Complete'}
        </button>
        <button class="btn-delete" onclick="deleteTask(${task.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function saveTask(e) {
  e.preventDefault();
  const token = getToken();
  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const due = document.getElementById('task-due').value;
  const priority = document.getElementById('task-priority').value;

  try {
    const res = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, desc, due, priority })
    });

    if (!res.ok) throw new Error('Failed to save task');

    closeTaskModal();
    fetchTasks();
  } catch (err) {
    alert(err.message);
  }
}

async function toggleTask(id, currentStatus) {
  const token = getToken();
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
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  const token = getToken();
  try {
    await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    fetchTasks();
  } catch (err) {
    console.error('Failed to delete task:', err);
  }
}

function openTaskModal() {
  document.getElementById('task-modal').classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('task-form').reset();
  document.getElementById('task-modal').classList.add('hidden');
}

function setFilter(filter, element) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');
  renderTasks();
}

// Page Auth Guard & Initialization
document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  const user = JSON.parse(localStorage.getItem('tb_user') || 'null');
  const isDashboard = window.location.pathname.includes('TaskBuddy.html');

  if (isDashboard) {
    if (!token || !user) {
      window.location.href = 'LoginSignup.html';
    } else {
      document.getElementById('user-display').innerText = `Welcome, ${user.name}`;
      fetchTasks();
    }
  }
});