# 🎧 Disco Incognito – Game Flow Spec

A multiplayer web game. Guess who's hearing something different.

## 🟣 Overview

Disco Incognito is a social listening game where one player hears a different song than everyone else — and the group must figure out who it is. Players log in with a display name (guest login) and manually enter song titles/artists.

### Workflow Notes

- Keep designs minimal: dark background, pink accents, and no extra chrome beyond the described controls.
- After finishing each section below, run the automated test suite, capture Puppeteer screenshots, and make a local git commit (no pushing yet).
- Room and game data persist to a shared JSON file (`disco_incognito.json`); ensure updates are atomic to avoid corruption.

## 🔐 1. Login Page

- Fullscreen dark background
- App logo/title: DISCO INCOGNITO
- Display name input + "Enter" pink button (guest login)
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

- Manual entry: two title + artist text fields
- Users enter 2 different songs to form a valid pair
- Each user can contribute multiple pairs
- After submitting, the pair is saved to the shared room pool
- Song names are not visible anywhere until revealed during gameplay

## 🕹️ 5. Starting the Game

Host clicks "Start Game":

- Randomly selects a song pair from the pool
- Randomly selects one player to be the Dancer Incognito
- Assigns one song to the Dancer Incognito and the other to everyone else
- Players see their assigned song (title + artist)
- Players mark "I'm Ready!", host clicks "Start Round"
- Host clicks "End Listening" when done
- Record start/end timestamps in the JSON file so reconnecting clients can recover

## 🔊 6. In-Game UI

Song assignment display:

- Shows song title and artist
- No playback controls (no Spotify integration)

## ❓ 7. Guessing Phase

Host ends listening → guessing begins

Players see:

- All usernames
- "Guess Who's the Dancer Incognito" buttons
- Each vote is written to the JSON file before broadcasting updates

Once everyone has voted, show:

## ✅ 8. Reveal Screen

Show:

- The Dancer Incognito
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

If no song pairs are left:

- Disable "Start Game" and prompt users to add more songs

Other:

- Room expires after 60 minutes of inactivity (tracked in JSON storage with last-activity timestamps)

## 🎨 UI Theme

Dark theme (near-black background)

Primary accent: Pink (buttons, highlights, progress bars)

Clean sans-serif fonts

Minimalist layout optimized for desktop & mobile

Song assignment card showing title + artist
