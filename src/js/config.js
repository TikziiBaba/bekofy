/**
 * Centralized configuration for Bekofy
 * Supabase anon key is public by design (client-side key).
 * Service role key is NEVER exposed to renderer - only used in main.js via IPC.
 */
var APP_CONFIG = {
  SUPABASE_URL: 'https://dtdsawyynetqlbosrvqo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHNhd3l5bmV0cWxib3NydnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0MDUsImV4cCI6MjA5MDEyMTQwNX0.6rKxp51OOj_b1iKtz_21ZkHcvbThNF4w5sPdP7RAua4',
};

// Premium Temalar
var PREMIUM_THEMES = {
  default: { name: 'Varsayılan', cssVars: {} },
  ocean: { name: 'Okyanus', cssVars: { '--green': '#00bcd4', '--green-h': '#00acc1', '--green-glow': 'rgba(0,188,212,.3)' }},
  sunset: { name: 'Gün Batımı', cssVars: { '--green': '#ff6b35', '--green-h': '#ff8552', '--green-glow': 'rgba(255,107,53,.3)' }},
  forest: { name: 'Orman', cssVars: { '--green': '#2e7d32', '--green-h': '#388e3c', '--green-glow': 'rgba(46,125,50,.3)' }},
  midnight: { name: 'Gece Yarısı', cssVars: { '--green': '#673ab7', '--green-h': '#7e57c2', '--green-glow': 'rgba(103,58,183,.3)' }},
  rose: { name: 'Gül', cssVars: { '--green': '#e91e63', '--green-h': '#f06292', '--green-glow': 'rgba(233,30,99,.3)' }},
  gold: { name: 'Altın', cssVars: { '--green': '#ffb300', '--green-h': '#ffc107', '--green-glow': 'rgba(255,179,0,.3)' }},
  cyber: { name: 'Siber', cssVars: { '--green': '#00e676', '--green-h': '#69f0ae', '--green-glow': 'rgba(0,230,118,.4)' }}
};

function applyTheme(themeName) {
  const theme = PREMIUM_THEMES[themeName] || PREMIUM_THEMES.default;
  Object.entries(theme.cssVars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  localStorage.setItem('bekofy-theme', themeName);
}

function initTheme() {
  const saved = localStorage.getItem('bekofy-theme') || 'default';
  applyTheme(saved);
}
