import { chromium } from 'playwright';
import { SignJWT } from 'jose';
import { SEED, mockChat } from './mocks.mjs';
const VIDEO = process.env.VIDEO === '1';
const token = await new SignJWT({ uid: 'promo-user' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(new TextEncoder().encode('promo-secret-promo-secret-12345'));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true,
  ...(VIDEO ? { recordVideo: { dir: 'vid', size: { width: 780, height: 1688 } } } : {}) });
await ctx.addCookies([{ name: 'mise_session', value: token, domain: 'localhost', path: '/' }]);
await ctx.addInitScript((seed) => { window.__PROMO_SEED = seed; }, SEED);
const p = await ctx.newPage();
import fs0 from 'fs';
const REC = process.env.REC === '1'; const frames = []; let cdp;
if (REC) { fs0.rmSync('frames', { recursive: true, force: true }); fs0.mkdirSync('frames');
  cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', async (f) => { const i = frames.length; frames.push({ i, t: f.metadata.timestamp }); fs0.writeFileSync(`frames/${String(i).padStart(5,'0')}.jpg`, Buffer.from(f.data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(()=>{}); });
}
const marks = [];
const mark = (name) => { marks.push({ name, t: Date.now() / 1000 }); console.log('MARK', name, marks.at(-1).t); };
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.route('**/api/storage**', r => r.request().method()==='GET' ? r.fulfill({json:{value:null}}) : r.fulfill({json:{ok:true}}));
await p.route('**/api/chat', async r => {
  const body = JSON.parse(r.request().postData());
  const out = mockChat(body);
  await new Promise(res => setTimeout(res, /grocery spine/.test(body.messages[0].content) ? 2200 : 1300));
  r.fulfill({ json: { text: JSON.stringify(out) } });
});
let n = 0;
const shot = async (name) => { if (!VIDEO) await p.screenshot({ path: `s/${String(++n).padStart(2,'0')}-${name}.png` }); };
const click = async (text, opts = {}) => { const l = p.getByRole('button', { name: text, exact: !!opts.exact }).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); await l.click(); };
const W = (ms) => p.waitForTimeout(ms);
// smooth scroll helper
const glide = async (dy, ms = 1200) => { await p.evaluate(async ([dy, ms]) => { const s = window.scrollY, t = performance.now(); await new Promise(res => { const f = (now) => { const k = Math.min(1, (now - t) / ms); const e = k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; window.scrollTo(0, s + dy * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }); }, [dy, ms]); };

await p.goto('http://localhost:3000/app', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
if (REC) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
await W(1500); mark('intro'); await shot('intro1');
await click('Next'); await W(1800); await shot('intro2');
await click('Next'); await W(1800); await shot('intro3');
await click('Set up my kitchen'); await W(1000); mark('setup');
await p.getByRole('button', { name: 'More people' }).click(); await W(700); await shot('setup-people');
await click('Next'); await W(800);
for (const d of ['Monday']) { await p.getByRole('button', { name: d, exact: true }).click().catch(()=>console.log('noday', d)); await W(350); }
await p.getByRole('button', { name: '30 minutes' }).click().catch(()=>{}); await W(600); await shot('setup-nights');
await click('Next'); await W(1200); await shot('setup-spice');
await click('Next'); await W(1200); await shot('setup-adv');
await click('Next'); await W(1000); await shot('setup-avoid');
await click('Next'); await W(600);
for (const e of ['Big pot']) { await p.getByRole('button', { name: e, exact: true }).click().catch(()=>console.log('noeq', e)); await W(300); }
await W(500); await shot('setup-kitchen');
await click('Next'); await W(2000); mark('recap'); await shot('recap');
await click('Show me this week'); await W(1200); mark('thisweek'); await shot('thisweek');
await p.locator('#fr').click(); await p.locator('#fr').pressSequentially('Half a bunch of scallions, a knob of ginger', { delay: 45 });
await W(500); await shot('thisweek-typed');
await click('Show me some ideas'); mark('ideas-loading'); await W(900); await shot('ideas-loading');
await p.getByText('Pick the ones you want').waitFor(); await W(900); mark('ideas'); await shot('ideas');
await glide(420, 1400); await W(500); await shot('ideas-scroll');
const adds = p.getByRole('button', { name: 'Add it', exact: true });
for (let i = 0; i < 4; i++) { const a = adds.first(); await a.scrollIntoViewIfNeeded(); await W(300); await a.click(); await W(500); }
await shot('ideas-added'); mark('added');
await click(/Plan my week/); await W(1200); mark('week'); await shot('week');
await click('Sort out my week'); await W(2600); await shot('week-sorted'); mark('sorted');
await p.getByRole('button', { name: 'Close', exact: true }).click(); await W(900);
await glide(500, 1400); await W(600); await shot('week-scroll');
await click(/Make my shopping list/); mark('shop-loading'); await W(900); await shot('shop-loading');
await p.getByText('Shopping List', { exact: true }).waitFor(); await W(1200); mark('shop'); await shot('shop');
const ticks = p.locator('.row2__tick input');
await glide(300, 1000);
for (let i = 0; i < 4; i++) { await ticks.nth(i).click(); await W(420); }
await shot('shop-ticked'); mark('ticked');
await glide(700, 1600); await W(500); await shot('shop-bottom');
await click(/Start cooking|Go to the recipes/); await W(1500); mark('cook'); await shot('cook');
const chip = p.getByRole('button', { name: /Miso-glazed eggplant/ }).first();
await chip.click(); await W(1600); await shot('cook-recipe');
await glide(500, 1600); await W(500); await shot('cook-recipe-scroll');
await click('Start cooking — guided'); await W(1500); mark('cookmode'); await shot('cookmode');
const prep = p.locator('.prep__b');
for (let i = 0; i < 5; i++) { await prep.nth(i).click(); await W(380); }
await shot('prep-ticked'); mark('prep');
await p.locator('.btn--solid', { hasText: 'Start cooking' }).last().click(); await W(1800); mark('steps'); await shot('step1');
const hot = p.locator('.cbtn--hot').first();
if (await hot.count()) { await hot.click(); await W(1500); await shot('step1-timer'); }
await click('Next step'); await W(1600); await shot('step2');
await click('Next step'); await W(1400);
await click('Next step'); await W(1600); await shot('step4'); mark('step4');
await p.locator('.cbubble').click(); await W(1200); await shot('mise-open');
const inp = p.getByPlaceholder('Ask anything…').last();
await inp.click(); await inp.pressSequentially('Is the eggplant done?', { delay: 60 }); await W(400);
await p.getByRole('button', { name: 'Ask', exact: true }).last().click(); mark('ask');
await W(2600); await shot('mise-answer'); mark('answer');
await W(1500);
if (REC) await cdp.send('Page.stopScreencast'); await W(300);
await ctx.close(); await b.close();
fs0.writeFileSync('marks.json', JSON.stringify(marks, null, 1)); fs0.writeFileSync('frames.json', JSON.stringify(frames));
