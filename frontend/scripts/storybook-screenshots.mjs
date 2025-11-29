#!/usr/bin/env node
// Script: Capture screenshots from Storybook stories using Puppeteer
// Outputs to artifacts/screenshots/ directory with mobile viewport (390x844)

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDir = resolve(__dirname, '..');
const artifactsDir = resolve(frontendDir, '..', 'artifacts', 'screenshots');

// Stories to capture screenshots for
const STORIES = [
  { id: 'views-loginview--default', name: 'LoginView-Default' },
  { id: 'views-roomselectionview--spotify-user', name: 'RoomSelectionView-SpotifyUser' },
  { id: 'views-roomselectionview--guest-user', name: 'RoomSelectionView-GuestUser' },
  { id: 'views-roomlobbyview--with-players', name: 'RoomLobbyView-WithPlayers' },
  { id: 'views-roomlobbyview--empty-lobby', name: 'RoomLobbyView-EmptyLobby' },
  { id: 'views-songpickerview--spotify-user', name: 'SongPickerView-SpotifyUser' },
  { id: 'views-songpickerview--guest-user', name: 'SongPickerView-GuestUser' },
  { id: 'views-gameview--round-in-progress', name: 'GameView-RoundInProgress' },
  { id: 'views-guessingview--default', name: 'GuessingView-Default' },
  { id: 'views-revealview--default', name: 'RevealView-Default' },
  { id: 'views-testplaybackview--authenticated', name: 'TestPlaybackView-Authenticated' },
  { id: 'views-testplaybackview--not-authenticated', name: 'TestPlaybackView-NotAuthenticated' },
  { id: 'views-testplaybackview--with-search-results', name: 'TestPlaybackView-WithSearchResults' },
  { id: 'views-errortestview--connected', name: 'ErrorTestView-Connected' },
  { id: 'views-errortestview--disconnected', name: 'ErrorTestView-Disconnected' },
  { id: 'views-exceptiondemoview--default', name: 'ExceptionDemoView-Default' },
  { id: 'views-serverdisconnecteddemoview--default', name: 'ServerDisconnectedDemoView-Default' },
];

const STORYBOOK_PORT = 6006;
const STORYBOOK_URL = `http://localhost:${STORYBOOK_PORT}`;
const VIEWPORT = { width: 390, height: 844 };

async function waitForStorybook(url, maxAttempts = 30) {
  console.log(`Waiting for Storybook at ${url}...`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('Storybook is ready!');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Storybook did not start within ${maxAttempts} seconds`);
}

async function captureScreenshots() {
  // Clean and create artifacts directory
  if (existsSync(artifactsDir)) {
    await rm(artifactsDir, { recursive: true });
  }
  await mkdir(artifactsDir, { recursive: true });

  console.log(`Screenshots will be saved to: ${artifactsDir}`);

  // Start Storybook in the background
  console.log('Starting Storybook...');
  const storybookProcess = spawn('npm', ['run', 'storybook', '--', '--ci'], {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: true,
  });

  let storybookOutput = '';
  storybookProcess.stdout.on('data', (data) => {
    storybookOutput += data.toString();
    process.stdout.write(data);
  });
  storybookProcess.stderr.on('data', (data) => {
    storybookOutput += data.toString();
    process.stderr.write(data);
  });

  try {
    await waitForStorybook(STORYBOOK_URL);

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    console.log(`\nCapturing ${STORIES.length} stories...\n`);

    for (const story of STORIES) {
      const storyUrl = `${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`;
      console.log(`📸 ${story.name}...`);

      await page.goto(storyUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for any animations/transitions
      await new Promise(r => setTimeout(r, 500));

      const screenshotPath = resolve(artifactsDir, `${story.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   ✓ Saved: ${story.name}.png`);
    }

    await browser.close();
    console.log(`\n✅ All ${STORIES.length} screenshots captured successfully!`);
    console.log(`📁 Saved to: ${artifactsDir}`);

  } finally {
    // Kill Storybook process
    console.log('\nShutting down Storybook...');
    storybookProcess.kill('SIGTERM');

    // Give it time to clean up
    await new Promise(r => setTimeout(r, 1000));

    // Force kill if still running
    if (!storybookProcess.killed) {
      storybookProcess.kill('SIGKILL');
    }
  }
}

captureScreenshots().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
