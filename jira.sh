#!/bin/bash
export JIRA_HOST="https://jira.huami.com/"
export JIRA_USER="hanzhijian"
export JIRA_PASSWORD="Asdfghjkl;'@6902"
node /home/hanzj/workspace/mcp_server/jira-mcp-server/build/index.js "$@"
