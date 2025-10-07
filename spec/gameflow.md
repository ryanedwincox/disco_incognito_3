# 🎧 Disco Incognito – Game Flow Spec

A multiplayer web game powered by Spotify. Guess who's hearing something different.

## 🟣 Overview

Disco Incognito is a social listening game where one player hears a different song than everyone else — and the group must figure out who it is. The game uses the Spotify Web API and requires users to log in with their Spotify account.

### Workflow Notes

- Keep designs minimal: dark background, pink accents, and no extra chrome beyond the described controls.
- Stay in Spotify test mode (`SPOTIFY_MODE=test`) while building these flows.
- After finishing each section below, run the automated test suite, capture Puppeteer screenshots, and make a local git commit (no pushing yet).
- Room and game data persist to a shared JSON file (`disco_incognito.json`); ensure updates are atomic to avoid corruption.

## 🔐 1. Login Page

- Fullscreen dark background
- App logo/title: DISCO INCOGNITO
- "Log in with Spotify" pink button
- On successful login → redirect to room screen

## 🏠 2. Room Selection Page

Options:

- Create Room → generates a 3-digit numeric code (e.g., 127)
- Enter Room → input a 3-digit code to join
- Room codes are numbers only
- After entry, user is taken to the Room Lobby

## 👥 3. Room Lobby

Shown to all players:

- Room code
- Player count
- Button: Pick Songs
- Button: Leave Room

Only host sees:

- Start Game (enabled when ≥ 3 players and ≥ 1 song pair saved)

Song pairs:

- Are hidden from everyone
- Cannot be deleted once added
- Are removed after being used in a round
- Persist immediately to the JSON storage adapter with optimistic locking

## 🎶 4. Song Picker Page

- Search bar with live Spotify search results
- Users must select 2 different tracks to form a valid pair
- Each user can contribute multiple pairs
- After selecting, the pair is saved to the shared room pool
- Song names are not visible anywhere until revealed during gameplay

## 🕹️ 5. Starting the Game

Host clicks "Start Game":

- Randomly selects a song pair from the pool
- Randomly selects one player to be the Odd Duck
- Assigns one song to the Odd Duck and the other to everyone else
- Countdown appears: 1.5 minutes of listening
- Songs start playing on each user's Spotify account simultaneously
- Record start/end timestamps in the JSON file so reconnecting clients can recover

## 🔊 6. In-Game UI

Music Player Bar (always visible):

- Bottom left: Now playing (shows title only during playback)
- Bottom center: Play/Pause button
  - Disabled during the game round
  - Enabled when picking songs
- Bottom right: Device status and selector

## ❓ 7. Guessing Phase

After 90 seconds, music stops automatically

Players see:

- All usernames
- "Guess Who's the Odd Duck" buttons
- Each vote is written to the JSON file before broadcasting updates

Once everyone has voted, show:

## ✅ 8. Reveal Screen

Show:

- The Odd Duck
- What each person guessed
- Highlight anyone who guessed correctly
- Only the host sees a button: Finish Round

When the host ends the round:

- Everyone is returned to the Room Lobby
- The song pair used is removed from the pool

## 🔁 9. Game Loop

The game continues indefinitely until the host stops playing

Players can add more song pairs between rounds

Song pairs cannot be reused once played
- Room state persists as long as at least one person stays (JSON file retains the room while active)

## 🧑‍💻 Edge Cases

If a user disconnects:

- Marked as "Disconnected" in the player list
- Can rejoin the same room if it's still active
- On reconnect, reload state from the shared JSON file before resuming playback

If Spotify playback fails:

- Show error and allow retry or device switch
- Capture a screenshot of the error state for QA before committing

If no song pairs are left:

- Disable "Start Game" and prompt users to add more songs

Other:

- Room expires after 60 minutes of inactivity (tracked in JSON storage with last-activity timestamps)

## 🎨 UI Theme

Dark theme (near-black background)

Primary accent: Pink (buttons, highlights, progress bars)

Clean sans-serif fonts

Minimalist layout optimized for desktop & mobile

Play bar on the bottom with:

- Current song on the left
- Play button in the middle
- Device connected status/list on the right
