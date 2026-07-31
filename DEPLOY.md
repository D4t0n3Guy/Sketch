# Deploying SketchShip to Netlify

This version stores games on the server, so it needs Netlify's
function support — a plain drag-and-drop of index.html is not enough.
Two ways, pick one:

## Option A — Netlify CLI (fastest)
From this folder, on a machine with Node.js:

    npm install
    npx netlify-cli login        # once, opens browser
    npx netlify-cli deploy --prod
    # when asked, link it to your existing SketchShip site

Every future update is just `npx netlify-cli deploy --prod` again.

## Option B — GitHub (set & forget)
1. Put this folder in a GitHub repo
2. In Netlify: Add new site -> Import from GitHub -> pick the repo
3. No build command needed; publish directory = repo root
4. Future updates: git push, Netlify redeploys itself

## Test after deploy
Open your site URL -> Start a new game. If game creation fails with
a network error, the function isn't running — check the deploy log
for `game.mjs`.
