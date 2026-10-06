// Captures the real Mise app, driven like a person would, at iPhone 15 Pro size
// (393 pt wide, 3×), for the launch film. Model answers are scripted (steak bites
// week) so the film is deterministic; everything on screen is the app's own UI.
//   qa/setup.sh   (app on :3000)    then    node hype/capture.js
// Output: hype/cap/<n>.jpg + hype/cap/manifest.json  {shots:[{name,file,taps,scroll}]}
const { chromium } = require('/opt/node22/lib/node_modules/@playwright/mcp/node_modules/playwright');
const { classify } = require('../qa/fake-model.js');
const fs = require('fs');
const BASE = 'http://localhost:3000', OUT = __dirname + '/cap/';
const VW = 393, VH = 764;           // webview: 852 pt screen − 54 status bar − 34 home indicator

const STEAK = {
  title: 'Garlic Butter Steak Bites', servings: '2 servings', time: '20 min', technique: 'a hard sear',
  seasoning: 'Flaky salt and lemon at the very end', doneness: '130°F for medium-rare — pull them a touch early',
  assembly: 'Pile into a warm bowl, spoon the pan juices over', missing: [],
  components: [{ name: 'Steak', items: ['1 lb sirloin, cut into 1-inch cubes', '3 tbsp butter', '4 cloves garlic, minced', 'Small handful parsley, chopped', '½ lemon', 'Salt and pepper'] }],
  steps: [
    { do: 'Pat the steak very dry and season well with salt and pepper.', why: 'Dry meat browns; wet meat steams.' },
    { do: 'Heat the cast iron over high heat for 3 minutes, until it just smokes.', why: '' },
    { do: 'Sear in one layer, 2 minutes a side. Don\'t crowd the pan.', why: 'Crowding drops the heat.' },
    { do: 'Lower the heat, add the butter and garlic, and baste for 1 minute.', why: '' },
    { do: 'Finish with parsley and a squeeze of lemon.', why: '' },
  ],
};
const STEAK_DF = {
  ...STEAK,
  components: [{ name: 'Steak', items: ['1 lb sirloin, cut into 1-inch cubes', '3 tbsp olive oil', '1 tsp soy sauce', '4 cloves garlic, minced', 'Small handful parsley, chopped', '½ lemon', 'Salt and pepper'] }],
  steps: STEAK.steps.map((s, i) => i === 3 ? { do: 'Lower the heat, add the olive oil, garlic and soy, and toss for 1 minute.', why: 'Soy brings back the savoury depth the butter gave.' } : s),
};
const recipeFor = (t) => /Steak/.test(t) ? STEAK : {
  ...STEAK, title: t, components: [{ name: 'Main', items: ['1½ lb chicken thighs', '1 lemon', '4 sprigs thyme'] }],
  steps: [{ do: 'Season and roast at 425°F for 30 minutes.', why: '' }],
};
const BODY = {
  ideas: () => ({
    say: 'Your sirloin is the star on Tuesday. The lemon and parsley carry over into Thursday, so nothing goes to waste.',
    ecosystem: { aromatics: 'garlic, parsley', protein: 'sirloin', vegetable: 'green beans', flavorSystem: 'lemon + garlic', wildcard: '', logic: 'lemon and parsley cross over' },
    dishes: [
      { title: 'Garlic Butter Steak Bites', blurb: 'Seared sirloin, garlic butter, lemon', why: 'Uses the sirloin while it\'s fresh', fits: 'ok', spice: 0, minutes: 20 },
      { title: 'Lemon Herb Chicken Thighs', blurb: 'Crisp skin, roasted lemon, thyme', why: 'The other half of that lemon', fits: 'ok', spice: 0, minutes: 40 },
      { title: 'Crispy Gnocchi & Greens', blurb: 'Pan-fried gnocchi, garlicky spinach', why: 'Fast for a busy Saturday', fits: 'ok', spice: 1, minutes: 25 },
      { title: 'Spicy Peanut Noodles', blurb: 'Chili crisp, peanut, scallion', why: 'Something with a kick', fits: 'ok', spice: 3, minutes: 20 },
    ],
  }),
  shopping: () => ({
    say: 'Everything here gets used. The parsley does double duty.', flags: [],
    items: [
      { item: 'butter', qty: '1 stick', section: 'Dairy', jobs: 'steak bites', days: 30 },
      { item: 'parsley', qty: '1 bunch', section: 'Produce', jobs: 'steak, chicken', days: 3 },
      { item: 'green beans', qty: '12 oz', section: 'Produce', jobs: 'side', days: 5 },
      { item: 'baby spinach', qty: '5 oz', section: 'Produce', jobs: 'gnocchi', days: 4 },
      { item: 'lemons', qty: '2', section: 'Produce', jobs: 'chicken, steak', days: 14 },
      { item: 'chicken thighs', qty: '1½ lb', section: 'Protein', jobs: 'roast', days: 2 },
      { item: 'gnocchi', qty: '1 lb', section: 'Pantry', jobs: 'Saturday', days: 90 },
      { item: 'parmesan', qty: '1 wedge', section: 'Dairy', jobs: 'gnocchi', days: 30 },
    ],
  }),
  recipe: (p) => { const m = p.match(/^Write the recipe for: (.*?) —/); return recipeFor(m ? m[1] : 'Recipe'); },
  propose: () => ({
    say: 'Easy. The butter is doing two jobs here: browning and that glossy finish. Three ways to cover both:',
    options: [
      { label: 'Olive oil + a splash of soy', what: 'Baste in olive oil; soy brings the savoury depth butter gave', cost: 'Nothing new to buy', best: true },
      { label: 'Vegan butter', what: 'Same method, plant-based butter', cost: 'One new item' },
      { label: 'Chimichurri finish', what: 'Skip the baste; spoon a herb sauce over', cost: 'Adds 5 minutes' },
    ],
  }),
  apply: () => ({ say: 'Done. Butter\'s out, olive oil and soy are in, and I took butter off your shopping list.', shoppingAdd: [{ item: 'soy sauce', qty: '1 small bottle', section: 'Pantry', days: 365 }], shoppingRemove: ['butter'], recipe: STEAK_DF }),
  ask: () => ({ say: 'Press one with your finger. It should feel like the base of your thumb. Or 130°F inside. Pull them now; they keep cooking off the heat.', shoppingAdd: [], shoppingRemove: [], recipeInstruction: '' }),
  order: () => ({ say: 'Steak Tuesday while it\'s fresh.', order: [{ night: 1, dish: 1 }, { night: 2, dish: 2 }, { night: 3, dish: 3 }] }),
};
let delay = 0;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(OUT + f);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('mise:consent-v1', '{"optional":false}'); } catch (_) {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.route('**/api/chat', async (route) => {
    let j = {}; try { j = route.request().postDataJSON(); } catch (_) {}
    const prompt = j?.messages?.[j.messages.length - 1]?.content || '';
    const kind = classify(prompt);
    const fn = BODY[kind];
    if (!fn) console.log('unscripted call:', kind);
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(fn ? fn(prompt) : { say: 'ok' }) }) });
  });
  await p.request.post(BASE + '/api/auth/signup', { data: { email: `film${Date.now()}@example.com`, password: 'password123', ageConfirmed: true, termsAccepted: true } });
  const profile = { people: 2, consistent: true, headcount: {}, nights: ['Tue', 'Thu', 'Sat'], time: 45, spice: 2, adventure: 3, restrictions: [], restrictionsNote: '', dislikes: '', healthConscious: false, equipment: ['Oven', 'Stovetop', 'Cast iron pan', 'Sheet pans'], smokeAlarm: true };
  await p.request.post(BASE + '/api/storage', { data: { key: 'mise:profile-v3', value: JSON.stringify({ profile, favorites: [], setupDone: true, savedAt: new Date().toISOString(), style: 'modern' }) } });
  await p.addStyleTag({ content: '' }).catch(() => {});
  await p.goto(BASE + '/app'); await p.waitForTimeout(2000);
  // no caret blink, no smooth scrolling: every capture is a settled frame
  await p.addStyleTag({ content: '*{caret-color:transparent!important;scroll-behavior:auto!important} ::-webkit-scrollbar{display:none}' });

  const shots = [];
  const snap = async (name, extra = {}) => {
    const file = `${String(shots.length).padStart(3, '0')}.jpg`;
    await p.screenshot({ path: OUT + file, type: 'jpeg', quality: 90 });
    shots.push({ name, file, scroll: await p.evaluate(() => window.scrollY), ...extra });
  };
  const center = async (loc) => { const bb = await loc.boundingBox(); return bb ? [bb.x + bb.width / 2, bb.y + bb.height / 2] : null; };
  const settle = (ms = 500) => p.waitForTimeout(ms);
  // tap: records where (viewport pts) on the shot taken just before the tap
  const tap = async (loc, name) => {
    await loc.scrollIntoViewIfNeeded(); await settle(200);
    const c = await center(loc);
    await snap(name + ':before', { tap: c });
    await loc.click(); await settle();
  };
  const type = async (loc, text, name) => {
    await loc.scrollIntoViewIfNeeded(); await loc.click(); await settle(200);
    await snap(name + ':0');
    for (let i = 0; i < text.length; i++) { await loc.pressSequentially(text[i]); await snap(`${name}:${i + 1}`); }
  };
  // scroll: a smooth run of positions, so the film can scroll the real page
  const scrollTo = async (y, name, step = 24) => {
    const y0 = await p.evaluate(() => window.scrollY);
    const n = Math.max(1, Math.round(Math.abs(y - y0) / step));
    for (let i = 1; i <= n; i++) { await p.evaluate((v) => window.scrollTo(0, v), Math.round(y0 + (y - y0) * i / n)); await settle(60); await snap(`${name}:${i}`); }
  };
  const yOf = async (loc, margin = 90) => (await loc.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) - margin;

  // PLAN
  await snap('home');
  await tap(p.getByRole('button', { name: /Start this week|Show me this week/ }).first(), 'start');
  await type(p.locator('#fr'), 'Sirloin, garlic, half a lemon, parsley', 'fridge');
  delay = 2500;
  const show = p.getByRole('button', { name: 'Show me some ideas', exact: true });
  await tap(show, 'ideasTap');
  await settle(400); await snap('ideasThinking');
  await p.waitForSelector('article.dish', { timeout: 20000 }); delay = 0; await settle(800);
  await snap('ideas');
  await scrollTo(await yOf(p.locator('.says, .bub--mise').first(), 120), 'ideasScroll');
  await snap('ideasMise');
  const adds = p.locator('.dish__add:not(.dish__add--on)');
  await tap(adds.first(), 'add1');
  await tap(adds.first(), 'add2');
  await tap(adds.first(), 'add3');
  await tap(p.locator('.wiz button').last(), 'plan');
  await snap('planned');
  delay = 2000;
  await tap(p.locator('.wiz button').last(), 'shopTap');
  await settle(300); await snap('shopThinking');
  await p.waitForSelector('.row2__face', { timeout: 20000 }); delay = 0; await settle(800);
  // SHOP
  await p.evaluate(() => window.scrollTo(0, 0)); await settle(300);
  await snap('shop');
  const ticks = p.locator('.row2__tick');
  await tap(ticks.nth(0), 'tick1'); await snap('tick1');
  await tap(ticks.nth(1), 'tick2'); await snap('tick2');
  await scrollTo(260, 'shopScroll');
  await snap('shopLow');
  await tap(p.getByRole('button', { name: /Go to the recipes|Start cooking/ }).first(), 'toRecipes');
  await settle(1500); await snap('afterRecipes');
  // CHANGE: the recipe, then "make it dairy-free"
  const steakBtn = p.getByRole('button', { name: /Garlic Butter Steak Bites/ }).first();
  if (await steakBtn.count()) await tap(steakBtn, 'openSteak');
  await settle(1500); await p.evaluate(() => window.scrollTo(0, 0)); await settle(300);
  await snap('recipe');
  await scrollTo(await yOf(p.locator('.comp, .comp__l2').first(), 160), 'recipeScroll');
  await snap('recipeIngredients');
  // the pinned "Ask Mise to change anything…" bar → the change sheet
  await type(p.locator('#ra'), 'Make it dairy-free', 'askType');
  delay = 2200;
  await snap('askSend:before');
  await p.locator('#ra').press('Enter');
  await settle(400); await snap('askThinking');
  await p.waitForSelector('.opts .opt', { timeout: 20000 }); delay = 0; await settle(900);
  await snap('options');
  delay = 2200;
  await tap(p.locator('.opts .opt--best').first(), 'pickBest');
  await settle(400); await snap('applyThinking');
  await p.waitForSelector('.rtoast', { timeout: 20000 }); delay = 0; await settle(800);
  await snap('applied');
  await p.evaluate(() => window.scrollTo(0, 0)); await settle(300);
  await snap('newIngredients');
  // COOK: cook mode, step 3, ask Mise at the stove
  await p.evaluate(() => window.scrollTo(0, 0)); await settle(300);
  await tap(p.getByRole('button', { name: 'Start cooking', exact: true }).first(), 'startCooking');
  await settle(800); await snap('prep');
  const toSteps = p.locator('.prepbar button').last();
  if (await toSteps.count()) await tap(toSteps, 'toSteps');
  await snap('step1');
  await tap(p.getByRole('button', { name: 'Next step' }), 'next1');
  await tap(p.getByRole('button', { name: 'Next step' }), 'next2');
  await snap('step3');
  // the step's own timer is the big ring; moving on docks it at the top
  const startT = p.locator('.bigtimer__acts .cbtn--hot');
  if (await startT.count()) {
    await tap(startT, 'startTimer'); await settle(2200); await snap('timerRunning');
    await tap(p.getByRole('button', { name: 'Next step' }), 'next3'); await settle(500); await snap('timerDocked');
    await tap(p.getByRole('button', { name: 'Back', exact: true }), 'back3'); await settle(400);
  }
  await tap(p.locator('.cooknav__mise'), 'askBubble'); await snap('caskOpen');
  await type(p.locator('#cq'), 'How do I know they\'re done?', 'cookType');
  delay = 2000;
  await tap(p.locator('.cask__foot .cbtn--hot').first(), 'cookSend');
  await settle(400); await snap('cookThinking');
  await p.waitForSelector('.cask__say', { timeout: 20000 }); delay = 0;
  await p.waitForFunction(() => /base of your thumb/.test(document.body.innerText), null, { timeout: 20000 }); await settle(800);
  await snap('cookAnswer');
  fs.writeFileSync(OUT + 'manifest.json', JSON.stringify({ vw: VW, vh: VH, dsf: 3, shots }, null, 1));
  console.log('shots', shots.length);
  await b.close();
})();
