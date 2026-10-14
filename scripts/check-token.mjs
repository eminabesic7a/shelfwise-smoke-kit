// Checks the QA_BOT_TOKEN: is it valid, who owns it, can it see the repo, when does it expire?
// Exit code 0 = fine, 1 = invalid, 2 = expires within WARN_DAYS (default 14).
const token = process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const expectedLogin = process.env.QA_BOT_LOGIN || '';
const warnDays = Number(process.env.WARN_DAYS || 14);
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

if (!token) {
  console.log('::error::QA_BOT_TOKEN secret is not set');
  process.exit(1);
}

const me = await fetch(`${API}/user`, { headers });
if (me.status === 401) {
  console.log('::error::QA_BOT_TOKEN is invalid or has expired. The token owner must create a new one and update the secret.');
  process.exit(1);
}
const { login } = await me.json();
console.log(`Token belongs to: ${login}`);
if (expectedLogin && login.toLowerCase() !== expectedLogin.toLowerCase()) {
  console.log(`::warning::Token belongs to "${login}" but the QA_BOT_LOGIN variable says "${expectedLogin}". Update the variable, or the agent workflow will ignore new incidents.`);
}

const issues = await fetch(`${API}/repos/${repo}/issues?per_page=1`, { headers });
if (!issues.ok) {
  console.log(`::error::Token cannot read issues in ${repo} (HTTP ${issues.status}). Check its repository access and permissions.`);
  process.exit(1);
}

const expiry = me.headers.get('github-authentication-token-expiration');
if (!expiry) {
  console.log('Token has no expiration date.');
  process.exit(0);
}
const daysLeft = Math.floor((new Date(expiry.replace(' UTC', 'Z').replace(' ', 'T')) - Date.now()) / 86400000);
console.log(`Token expires ${expiry} (${daysLeft} day(s) left)`);
if (daysLeft <= warnDays) {
  console.log(`::warning::QA_BOT_TOKEN expires in ${daysLeft} day(s). Rotate it now.`);
  process.exit(2);
}
