# SketchShip

Live at **https://sketchship.netlify.app**, auto-deployed from the
`main` branch of this repo.

Layout:

    index.html                  the whole client (no build step)
    netlify/functions/game.mjs  server: game storage + seat assignment
    netlify.toml                points Netlify at the functions folder
    package.json                one dependency, @netlify/blobs

Netlify settings: no build command, publish directory = repo root.
Functions are bundled automatically with esbuild.

## Updating
Push to `main`. Netlify rebuilds itself. Check the Deploys tab if a
change doesn't show up within a couple of minutes.

## How players are identified
Each browser generates a permanent id on first visit and stores it in
localStorage. The invite link contains only the game id, never an
identity. The server hands seat 1 to the creator, seat 2 to the first
other device that opens the link, and refuses everyone after that.

## Test after deploy
Open the site, start a new game, and confirm it reaches the server. A
network error on creation means the function isn't running — check the
deploy log for `game.mjs`.
