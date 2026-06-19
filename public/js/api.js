export async function fetchConfig() {
  const r = await fetch('/api/config');
  return r.json();
}

export async function fetchWeather(lat, lon) {
  const r = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
  return r.json();
}

export async function fetchAQI(lat, lon) {
  const r = await fetch(`/api/aqi?lat=${lat}&lon=${lon}`);
  return r.json();
}

export async function fetchAlerts(lat, lon) {
  const mock = new URLSearchParams(location.search).has('mockAlerts') ? '&mock=1' : '';
  const r = await fetch(`/api/alerts?lat=${lat}&lon=${lon}${mock}`);
  return r.json();
}

export async function fetchNHLScores() {
  const r = await fetch('/api/nhl/scores');
  return r.json();
}

export async function fetchNHLBracket() {
  const r = await fetch('/api/nhl/bracket');
  return r.json();
}

export async function fetchRSS(url) {
  const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
  return r.json();
}

export async function fetchCalendar(url) {
  const r = await fetch(`/api/ical?url=${encodeURIComponent(url)}`);
  return r.json();
}

export async function fetchJSON(url) {
  const r = await fetch(`/api/json-fetch?url=${encodeURIComponent(url)}`);
  return r.json();
}

export async function fetchCustomDates() {
  const r = await fetch('/api/custom-dates');
  return r.json();
}

export async function fetchFavoriteTeams() {
  const r = await fetch('/api/favorite-teams');
  return r.json();
}

export async function fetchYoLink() {
  const r = await fetch('/api/yolink/states');
  return r.json();
}

export async function fetchYoLinkHistory(hours = 24) {
  const r = await fetch(`/api/yolink/history?hours=${hours}`);
  return r.json();
}

export async function fetchStocks() {
  const r = await fetch('/api/stocks');
  return r.json();
}

export async function fetchMovies() {
  const r = await fetch('/api/movies');
  return r.json();
}

export async function fetchJellyfin() {
  const r = await fetch('/api/jellyfin/recent');
  return r.json();
}
