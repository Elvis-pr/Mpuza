/**
 * MPUZA - Frontend App
 * Handles:
 *   - Fetching opportunities from the backend API
 *   - Filtering / searching
 *   - Rendering opportunity & resource cards
 */

const API_BASE = '/api';

// DOM refs
const opportunityGrid = document.getElementById('opportunity-grid');
const resourceGrid = document.getElementById('resource-grid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

// State
let currentFilter = 'all';
let currentSearch = '';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadOpportunities();
  loadResources();
  setupNav();
  setupFilters();
  setupSearch();
});

// ===== NAVIGATION =====
function setupNav() {
  document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-links a').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      const target = link.getAttribute('data-section');
      if (target === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ===== FILTERS =====
function setupFilters() {
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadOpportunities();
    });
  });
}

// ===== SEARCH =====
function setupSearch() {
  searchBtn.addEventListener('click', () => {
    currentSearch = searchInput.value.trim();
    loadOpportunities();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      currentSearch = searchInput.value.trim();
      loadOpportunities();
    }
  });
}

// ===== LOAD OPPORTUNITIES =====
async function loadOpportunities() {
  try {
    let url = `${API_BASE}/opportunities?type=${currentFilter}`;
    if (currentSearch) {
      url += `&q=${encodeURIComponent(currentSearch)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      opportunityGrid.innerHTML = `<div class="loading">Error: ${data.message}</div>`;
      return;
    }

    renderOpportunities(data.grouped, data.total);
  } catch (err) {
    opportunityGrid.innerHTML = `<div class="loading">Failed to load opportunities. ${err.message}</div>`;
  }
}

// ===== RENDER OPPORTUNITIES =====
function renderOpportunities(grouped, total) {
  const internshipCards = grouped.internship.map(opp => `
    <div class="opportunity-card">
      <span class="card-type-badge internship">Internship</span>
      <div class="card-title">${escapeHtml(opp.title)}</div>
      <div class="card-company">${escapeHtml(opp.company)}</div>
      <div class="card-location">📍 ${escapeHtml(opp.location)}</div>
      <p class="card-desc">${escapeHtml(opp.description)}</p>
      <div class="card-meta">
        <span>💰 ${escapeHtml(opp.pay)}</span>
        <span>📅 Deadline: ${escapeHtml(opp.deadline)}</span>
      </div>
      <div class="card-actions">
        <a href="#" class="btn btn-primary">Apply</a>
        <a href="#" class="btn btn-secondary">Learn More</a>
      </div>
    </div>
  `).join('');

  const fulltimeCards = grouped.fulltime.map(opp => `
    <div class="opportunity-card">
      <span class="card-type-badge fulltime">Full-Time</span>
      <div class="card-title">${escapeHtml(opp.title)}</div>
      <div class="card-company">${escapeHtml(opp.company)}</div>
      <div class="card-location">📍 ${escapeHtml(opp.location)}</div>
      <p class="card-desc">${escapeHtml(opp.description)}</p>
      <div class="card-meta">
        <span>💰 ${escapeHtml(opp.pay)}</span>
        <span>📅 Deadline: ${escapeHtml(opp.deadline)}</span>
      </div>
      <div class="card-actions">
        <a href="#" class="btn btn-primary">Apply</a>
        <a href="#" class="btn btn-secondary">Learn More</a>
      </div>
    </div>
  `).join('');

  opportunityGrid.innerHTML = `
    <div class="section-header" style="margin-top:0;">
      <span class="section-header">Showing ${total} opportunities</span>
    </div>
    <div class="opportunity-grid">
      ${internshipCards || '<div class="loading">No internships found</div>'}
      ${fulltimeCards || '<div class="loading">No full-time jobs found</div>'}
    </div>
  `;
}

// ===== LOAD RESOURCES =====
async function loadResources() {
  try {
    const res = await fetch(`${API_BASE}/opportunities`);
    const data = await res.json();

    if (!data.success) {
      resourceGrid.innerHTML = `<div class="loading">Error loading resources</div>`;
      return;
    }

    renderResources(data.resources);
  } catch (err) {
    resourceGrid.innerHTML = `<div class="loading">Failed to load resources. ${err.message}</div>`;
  }
}

// ===== RENDER RESOURCES =====
function renderResources(resources) {
  const cards = resources.map(r => `
    <a href="${r.url}" target="_blank" rel="noopener" class="resource-card">
      <div class="resource-icon">${r.icon}</div>
      <div class="resource-name">${escapeHtml(r.name)}</div>
      <div class="resource-category">${escapeHtml(r.category)}</div>
    </a>
  `).join('');

  resourceGrid.innerHTML = cards || '<div class="loading">No resources found</div>';
}

// ===== UTILITIES =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
