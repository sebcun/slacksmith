# SlackSmith

Desktop app for building Slack bots without writing code. You wire up triggers, conditions, and actions on a canvas, connect your Slack app, and run the bot from the editor.

You can create bots, build them with drag and drop, run them independently, change themes, create themes, and more!

## Requirements

- Node.js
- npm

## Setup

```bash
git clone https://github.com/sebcun/slacksmith.git
cd slacksmith
npm install
npm start / npm run dev
```

## How it works

1. Pick components from the library on the left (triggers like message received or slash commands, conditions, loops, Slack actions, HTTP requests, variables, etc.)
2. Drag them onto the canvas and connect ports between nodes
3. Select a node to edit its settings in the properties panel on the right
4. Connect Slack via the onboarding wizard (bot token, app token, signing secret)
5. Hit run to start the bot against your saved project.

Flows auto-save as you edit. A project can have multiple canvases/tabs if you want to split things up.

## Slack setup

You'll need a Slack app with at least:

- A bot token (`xoxb-...`)
- An app-level token with `connections:write` for socket mode (`xapp-...`)
- The signing secret from your app's basic info page

## AI Usage

- Used claude web for debugging things I couldn't fix myself.
- Used claude to create project json files for test runs.
- Used claude for describing and some text on the app including how variables work