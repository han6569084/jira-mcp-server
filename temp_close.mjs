import { Version2Client } from 'jira.js';
const jira = new Version2Client({
host: 'https://jira.huami.com/',
authentication: { basic: { email: 'hanzhijian', apiToken: 'Asdfghjkl;'@6902' } },
});
async function main() {
const issueKey = 'COLOGNE-2403';
try {
const issue = await jira.issues.getIssue({ issueIdOrKey: issueKey });
const ts = await jira.issues.getTransitions({ issueIdOrKey: issueKey });
const c = ts.transitions.find(t => t.name === 'Closed' || t.name === 'Close');
if (c) {
await jira.issues.doTransition({ issueIdOrKey: issueKey, transition: { id: c.id } });
console.log('Successfully closed ' + issueKey);
}
} catch (e) { console.error(e.message); }
}
main();