#!/usr/bin/env node
// Script: Visual regression testing for Storybook screenshots using pixelmatch

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { mkdir, readdir, copyFile, rm } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, basename } from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { STORIES, STORYBOOK_PORT, VIEWPORT } from './storybook-screenshots.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDir = resolve(__dirname, '..');
const baselinesDir = resolve(frontendDir, 'tests', 'screenshots', 'baselines');
const currentDir = resolve(frontendDir, '..', 'artifacts', 'screenshots', 'current');
const diffsDir = resolve(frontendDir, '..', 'artifacts', 'screenshots', 'diffs');

const STORYBOOK_URL = `http://localhost:${STORYBOOK_PORT}`;

// Default threshold: 0.1% pixel difference tolerance
const DEFAULT_THRESHOLD = 0.001;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    updateBaselines: args.includes('--update-baselines'),
    threshold: DEFAULT_THRESHOLD,
  };

  const thresholdIndex = args.findIndex(arg => arg.startsWith('--threshold='));
  if (thresholdIndex !== -1) {
    const value = parseFloat(args[thresholdIndex].split('=')[1]);
    if (!isNaN(value)) {
      options.threshold = value;
    }
  }

  return options;
}

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

async function captureCurrentScreenshots(page) {
  // Clean and create current screenshots directory
  if (existsSync(currentDir)) {
    await rm(currentDir, { recursive: true });
  }
  await mkdir(currentDir, { recursive: true });

  console.log(`\nCapturing ${STORIES.length} current screenshots...\n`);

  for (const story of STORIES) {
    const storyUrl = `${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`;
    console.log(`📸 ${story.name}...`);

    await page.goto(storyUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 500));

    const screenshotPath = resolve(currentDir, `${story.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }

  console.log(`\n✅ Captured ${STORIES.length} current screenshots`);
}

function compareImages(baselinePath, currentPath, diffPath, threshold) {
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const current = PNG.sync.read(readFileSync(currentPath));

  const { width, height } = baseline;

  // Check dimensions match
  if (current.width !== width || current.height !== height) {
    return {
      match: false,
      diffPixels: -1,
      percentage: 100,
      error: `Dimension mismatch: baseline ${width}x${height} vs current ${current.width}x${current.height}`,
    };
  }

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(baseline.data, current.data, diff.data, width, height, {
    threshold: 0.1, // pixelmatch per-pixel threshold
  });

  writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const percentage = (diffPixels / totalPixels) * 100;

  return {
    match: percentage <= threshold * 100,
    diffPixels,
    percentage,
    error: null,
  };
}

async function runComparison(threshold) {
  // Create diffs directory
  if (existsSync(diffsDir)) {
    await rm(diffsDir, { recursive: true });
  }
  await mkdir(diffsDir, { recursive: true });

  console.log(`\nComparing screenshots (threshold: ${(threshold * 100).toFixed(2)}% pixel difference)...\n`);

  const results = [];
  let failures = 0;

  for (const story of STORIES) {
    const baselinePath = resolve(baselinesDir, `${story.name}.png`);
    const currentPath = resolve(currentDir, `${story.name}.png`);
    const diffPath = resolve(diffsDir, `${story.name}-diff.png`);

    if (!existsSync(baselinePath)) {
      console.log(`⚠️  ${story.name}: No baseline found`);
      results.push({ name: story.name, status: 'missing', message: 'No baseline' });
      failures++;
      continue;
    }

    if (!existsSync(currentPath)) {
      console.log(`❌ ${story.name}: Current screenshot missing`);
      results.push({ name: story.name, status: 'error', message: 'Current screenshot missing' });
      failures++;
      continue;
    }

    const comparison = compareImages(baselinePath, currentPath, diffPath, threshold);

    if (comparison.error) {
      console.log(`❌ ${story.name}: ${comparison.error}`);
      results.push({ name: story.name, status: 'error', message: comparison.error });
      failures++;
    } else if (comparison.match) {
      console.log(`✓  ${story.name}: ${comparison.percentage.toFixed(4)}% diff`);
      results.push({ name: story.name, status: 'pass', percentage: comparison.percentage });
    } else {
      console.log(`❌ ${story.name}: ${comparison.percentage.toFixed(4)}% diff (exceeds threshold)`);
      console.log(`   Diff saved: ${basename(diffPath)}`);
      results.push({ name: story.name, status: 'fail', percentage: comparison.percentage });
      failures++;
    }
  }

  return { results, failures };
}

async function updateBaselines() {
  // Create baselines directory if it doesn't exist
  await mkdir(baselinesDir, { recursive: true });

  console.log(`\nUpdating baselines from current screenshots...\n`);

  let copied = 0;
  for (const story of STORIES) {
    const currentPath = resolve(currentDir, `${story.name}.png`);
    const baselinePath = resolve(baselinesDir, `${story.name}.png`);

    if (existsSync(currentPath)) {
      await copyFile(currentPath, baselinePath);
      console.log(`✓  Updated: ${story.name}.png`);
      copied++;
    } else {
      console.log(`⚠️  Missing: ${story.name}.png`);
    }
  }

  console.log(`\n✅ Updated ${copied}/${STORIES.length} baselines in ${baselinesDir}`);
}

async function main() {
  const options = parseArgs();

  // Start Storybook in the background
  console.log('Starting Storybook...');
  const storybookProcess = spawn('npm', ['run', 'storybook', '--', '--ci'], {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: true,
  });

  storybookProcess.stdout.on('data', (data) => process.stdout.write(data));
  storybookProcess.stderr.on('data', (data) => process.stderr.write(data));

  try {
    await waitForStorybook(STORYBOOK_URL);

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // Capture current screenshots
    await captureCurrentScreenshots(page);

    await browser.close();

    if (options.updateBaselines) {
      // Update mode: copy current to baselines
      await updateBaselines();
      console.log('\n🎉 Baselines updated successfully!');
    } else {
      // Comparison mode: compare current vs baselines
      const { results, failures } = await runComparison(options.threshold);

      console.log('\n' + '='.repeat(60));
      console.log('VISUAL REGRESSION TEST RESULTS');
      console.log('='.repeat(60));

      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const missing = results.filter(r => r.status === 'missing').length;
      const errors = results.filter(r => r.status === 'error').length;

      console.log(`Passed: ${passed}/${STORIES.length}`);
      console.log(`Failed: ${failed}/${STORIES.length}`);
      if (missing > 0) console.log(`Missing baselines: ${missing}`);
      if (errors > 0) console.log(`Errors: ${errors}`);
      console.log('='.repeat(60));

      if (failures > 0) {
        console.log('\n❌ Visual regression tests FAILED');
        console.log(`   Check diffs in: ${diffsDir}`);
        process.exit(1);
      } else {
        console.log('\n✅ All visual regression tests PASSED');
      }
    }

  } finally {
    console.log('\nShutting down Storybook...');
    storybookProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
    if (!storybookProcess.killed) {
      storybookProcess.kill('SIGKILL');
    }
  }
}

main().catch((error) => {
  console.error('Visual regression testing failed:', error);
  process.exit(1);
});
