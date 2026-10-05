// Deterministic stand-in for /api/chat, for checking the harness itself and for
// UI regression runs that must not depend on a live model. Recognises each call
// by the prompt the client builds and answers with well-formed JSON.
const calls = [];
const overrides = []; // [{match: RegExp, body|status|delay|raw}]
function classify(prompt) {
  if (/THIS WEEK'S DRAW/.test(prompt)) return 'ideas';
  if (/The candidates currently on their screen/.test(prompt)) return 'feedback';
  if (/^They don't want:/.test(prompt)) return 'swap';
  if (/Build the grocery list/.test(prompt)) return 'shopping';
  if (/^CURRENT LIST:/.test(prompt)) return 'revise';
  if (/^Write the recipe for:/.test(prompt)) return 'recipe';
  if (/Do NOT rewrite the recipe yet/.test(prompt)) return 'propose';
  if (/They chose this route/.test(prompt)) return 'apply';
  if (/WHAT THEY ACTUALLY HAVE LEFT/.test(prompt)) return 'leftovers';
  if (/^They have:/.test(prompt)) return 'expand';
  if (/what order to cook these/.test(prompt)) return 'order';
  if (/WHAT IS ON THEIR SCREEN RIGHT NOW/.test(prompt)) return 'ask';
  return 'other';
}
const dishes = [
  { title: 'Charred Cabbage Wedges', blurb: 'Smoky cabbage, garlic oil', why: 'Char as seasoning', fits: 'ok', spice: 1, minutes: 30 },
  { title: 'Garlic Chickpea Stew', blurb: 'Brothy chickpeas, greens', why: 'Pantry-led', fits: 'ok', spice: 0, minutes: 35 },
  { title: 'Crispy Rice Bowl', blurb: 'Pan-crisped rice, egg', why: 'Texture contrast', fits: 'ok', spice: 2, minutes: 25 },
  { title: 'Sheet-Pan Chicken Thighs', blurb: 'Roasted thighs, lemon', why: 'One pan', fits: 'ok', spice: 0, minutes: 40 },
];
const recipe = (title) => ({ title, servings: '2 servings', time: '30 min', technique: 'searing', seasoning: 'add acid', doneness: '165°F', assembly: 'plate it', missing: [],
  components: [{ name: 'Main', items: ['1 lb chicken thighs, patted dry', '2 cloves garlic, sliced'] }],
  steps: [{ do: 'Heat the pan for 3 minutes until shimmering.', why: 'browning' }, { do: 'Cook 6 minutes per side.', why: '' }, { do: 'Rest 5 minutes.', why: '' }] });
function body(kind, prompt) {
  switch (kind) {
    case 'ideas': return { say: 'Here is the week.', ecosystem: { aromatics: 'dill', protein: 'chicken', vegetable: 'cabbage', flavorSystem: 'garlic', wildcard: '', logic: 'crosses over' }, dishes };
    case 'feedback': return { say: 'Revised.', dishes };
    case 'swap': return { title: 'Swapped Lentil Soup', blurb: 'Red lentils', why: 'Different format', spice: 0, minutes: 30, say: 'Try this.' };
    case 'shopping': return { say: 'Uses everything.', flags: [], items: [
      { item: 'chicken thighs', qty: '1 lb', section: 'Protein', jobs: 'stew', days: 5 },
      { item: 'green cabbage', qty: '1 head', section: 'Produce', jobs: 'wedges', days: 14 },
      { item: 'dill', qty: '1 bunch', section: 'Herbs', jobs: 'all', days: 2 },
      { item: 'chickpeas', qty: '2 cans', section: 'Pantry', jobs: 'stew', days: 90 } ] };
    case 'revise': return { say: 'Done.', items: [
      { item: 'chicken thighs', qty: '1 lb', section: 'Protein', jobs: 'stew', days: 5 },
      { item: 'green cabbage', qty: '1 head', section: 'Produce', jobs: 'wedges', days: 14 },
      { item: 'chickpeas', qty: '2 cans', section: 'Pantry', jobs: 'stew', days: 90 },
      { item: 'lettuce', qty: '1 head', section: 'Produce', jobs: 'salad', days: 5 } ] };
    case 'recipe': { const m = prompt.match(/^Write the recipe for: (.*?) —/); return recipe(m ? m[1] : 'Recipe'); }
    case 'propose': return { say: 'Two ways.', options: [{ label: 'Rice bowl', what: 'swap bun', cost: 'none', best: true }, { label: 'Lettuce cups', what: 'no carbs', cost: 'less filling' }] };
    case 'apply': return { say: 'Changed.', shoppingAdd: [{ item: 'rice', qty: '1 bag', section: 'Pantry', days: 90 }], shoppingRemove: ['dill'], recipe: recipe('Reworked Bowl') };
    case 'leftovers': return { say: 'Use the rice first.', safety: 'Rice: one day.', orphans: '', ideas: [{ title: 'Fried rice', blurb: 'quick', usesItems: ['cold rice'], need: '', minutes: 10 }] };
    case 'expand': return recipe('Fried rice');
    case 'order': return { say: 'Tue — stew', order: [{ night: 1, dish: 1 }, { night: 2, dish: 2 }] };
    case 'ask': return { say: 'Sure thing.', shoppingAdd: [], shoppingRemove: [], recipeInstruction: '' };
    default: return { say: 'ok' };
  }
}
async function install(page) {
  await page.route('**/api/chat', async (route) => {
    const req = route.request(); let j = {}; try { j = req.postDataJSON(); } catch (_) {}
    const prompt = j?.messages?.[j.messages.length - 1]?.content || '';
    const kind = classify(prompt);
    calls.push({ kind, prompt, body: j, t: Date.now() });
    const ov = overrides.find((o) => o.kind === kind && (o.times === undefined || o.times-- > 0));
    if (ov?.delay) await new Promise((r) => setTimeout(r, ov.delay));
    if (ov?.abort) return route.abort('failed');
    if (ov && ('raw' in ov)) return route.fulfill({ status: ov.status || 200, contentType: 'application/json', body: ov.raw });
    if (ov?.text !== undefined) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: ov.text }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(body(kind, prompt)) }) });
  });
}
module.exports = { install, calls, overrides, classify, body };
