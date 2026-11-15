// Integration checks use a real AudioContext/worklet with a synthetic microphone.
// Run against npm run dev. No real microphone is requested or recorded.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
await context.addInitScript(() => {
  window.testMic = { delay: 0, reject: false, streams: [], contexts: [] };
  navigator.mediaDevices.getUserMedia = async () => {
    const mic = window.testMic;
    if (mic.delay) await new Promise((r) => setTimeout(r, mic.delay));
    if (mic.reject) throw new DOMException('Test permission denied', 'NotAllowedError');
    const ctx = new AudioContext();
    await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    mic.contexts.push(ctx);
    mic.streams.push(dest.stream);
    mic.play = (phrase) => {
      let t = ctx.currentTime + 0.05;
      for (const note of phrase) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 330 * 2 ** (note.semi / 12);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
        gain.gain.setValueAtTime(0.25, t + note.dur - 0.03);
        gain.gain.linearRampToValueAtTime(0, t + note.dur);
        osc.connect(gain).connect(dest);
        osc.start(t);
        osc.stop(t + note.dur);
        t += note.dur + (note.gap ?? 0.15);
      }
    };
    return dest.stream;
  };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = process.env.APP_URL ?? 'http://127.0.0.1:5180';
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const status = (name) => page.getByText(name, { exact: true }).last().waitFor({ timeout: 15000 });
const listening = () => status('Your turn');
try {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await click('Play tanpura drone');
  await click('Begin');
  await status('Hold your Sa');
  assert.equal(await page.getByRole('button', { name: 'Play tanpura drone', exact: true }).getAttribute('aria-pressed'), 'false', 'tuning silences the drone');
  await page.waitForTimeout(3400);
  await page.evaluate(() => window.testMic.play([{ semi: 0, dur: 0.55 }]));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.testMic.play([{ semi: 0, dur: 0.55 }]));
  await page.waitForTimeout(1000);
  await status('Hold your Sa'); // two disconnected short tones must not calibrate
  await page.evaluate(() => window.testMic.play([{ semi: 0, dur: 1.9 }]));
  await listening();
  await page.waitForTimeout(600);
  await click('Echo me');
  await page.evaluate(() => window.testMic.play([{ semi: 0, dur: 0.4 }, { semi: 2, dur: 0.5 }, { semi: 4, dur: 0.6 }]));
  await status('Listen…');
  await listening();
  assert.equal(await page.getByRole('button', { name: 'Play it again', exact: true }).isEnabled(), true);
  await click('Play it again');
  await status('Listen…');
  await listening();
  await click('Again, slower');
  await status('Listen…');
  await listening();

  await click('Learn together');
  await click('You lead');
  await status('Listen…');
  await listening();
  await page.evaluate(() => window.testMic.play([{ semi: 0, dur: 0.6 }, { semi: 0, dur: 0.9 }]));
  await status('Listen…');
  await listening();
  let journey = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-flute-flow:journey')));
  assert.equal(journey.practice.progress.bhupali.caught, 1, 'first imitation heard through the worklet');
  assert.equal(journey.practice.progress.bhupali.step, 0);
  await click('You lead');
  await listening();
  await page.evaluate(() => window.testMic.play([{ semi: 0, dur: 0.6 }, { semi: 0, dur: 0.9 }]));
  await status('Listen…');
  await listening();
  journey = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-flute-flow:journey')));
  assert.equal(journey.practice.progress.bhupali.step, 1, 'revisiting advances the practice');

  await click('You lead');
  await status('Listen…');
  await click('Rest');
  await status('Resting');
  await page.waitForTimeout(3500);
  await status('Resting');
  assert.ok(await page.evaluate(() => window.testMic.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))), 'Rest releases every mic track');
  await page.reload();
  await page.getByText('Making room for Re', { exact: true }).waitFor();
  await click('Begin');
  await listening(); // remembered tonic skips tuning
  await click('Rest');

  // A permission request resolving after Cancel must not reopen the mic or session.
  await page.evaluate(() => { window.testMic.delay = 600; });
  await click('Begin');
  await click('Cancel');
  await page.waitForTimeout(1000);
  await status('Resting');
  assert.ok(await page.evaluate(() => window.testMic.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))));
  await page.evaluate(() => { window.testMic.delay = 0; window.testMic.reject = true; });
  await click('Begin');
  await page.getByText(/Your browser blocked the microphone/).waitFor();
  await status('Resting');
  await page.evaluate(() => { window.testMic.reject = false; });
  await click('Begin');
  await listening();
  await click('Rest');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/tmp/flute-friend-mobile.png', fullPage: true, animations: 'disabled' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile has no horizontal overflow');
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/tmp/flute-friend-desktop.png', fullPage: true, animations: 'disabled' });
  await click('Settings');
  await click('Forget our history');
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-flute-flow:journey')).practice.progress), {});
  await page.evaluate(() => {
    localStorage.setItem('echo-flute-flow:settings', JSON.stringify({ tuned: false, mode: 'beat' }));
    localStorage.setItem('echo-flute-flow:journey', '{broken json');
  });
  await page.reload();
  await click('Begin');
  await listening();
  await click('Back to flute');
  await status('Hold your Sa');
  await click('Rest');
  // Force one load failure, then use the real worklet on retry.
  await page.reload();
  await page.evaluate(() => {
    const ctx = new AudioContext();
    const proto = Object.getPrototypeOf(ctx.audioWorklet);
    const original = proto.addModule;
    void ctx.close();
    proto.addModule = function () {
      proto.addModule = original;
      return Promise.reject(new Error('Simulated worklet load failure'));
    };
  });
  await click('Begin');
  await page.getByText(/couldn't reach a microphone/).waitFor();
  await status('Resting');
  assert.ok(await page.evaluate(() => window.testMic.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))), 'worklet failure releases input');
  await click('Begin');
  await status('Hold your Sa');
  await click('Rest');
  assert.deepEqual(errors, [], 'no browser exceptions');
  console.log('✓ tuning, microphone → worklet → echo, replay, slower playback, learning, memory, Rest, permission cancellation/recovery, and mobile layout');
} catch (error) {
  console.error(await page.locator('body').innerText());
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser.close();
}
