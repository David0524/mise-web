export const SEED = {
  pantry: "white miso", tradition: "Japanese home cooking", vegetable: "eggplant",
  technique: "salting ahead, and what it does to texture",
  formats: ["a sheet-pan roast", "a noodle or pasta dish", "a handheld — wrap, taco, sandwich", "a soup"], month: 8,
};

const IDEAS = {
  say: "One tub of miso, four very different dinners. My favourite is the miso-glazed eggplant — it goes glossy and almost butterscotch-sweet under the broiler.",
  ecosystem: {
    aromatics: "Scallions, ginger and one bunch of cilantro", protein: "Chicken thighs",
    vegetable: "Eggplant", flavorSystem: "White miso", wildcard: "Limes",
    logic: "One herb bunch, one tub of miso, four nights — nothing is left to wilt.",
  },
  dishes: [
    { title: "Miso-glazed eggplant & crispy rice", blurb: "Charred eggplant, sticky glaze, crackly rice.", why: "Miso caramelises like butterscotch under heat.", spice: 0, minutes: 30 },
    { title: "Sheet-pan miso butter chicken", blurb: "Thighs and eggplant roasted in miso butter.", why: "The pan juices become the sauce.", spice: 1, minutes: 35 },
    { title: "Ginger-scallion miso noodles", blurb: "Slurpy noodles in a sizzled scallion oil.", why: "Hot oil poured over aromatics — instant sauce.", spice: 2, minutes: 20 },
    { title: "Charred eggplant tacos, lime crema", blurb: "Smoky eggplant, cilantro, bright lime.", why: "Finishes the cilantro before it turns.", spice: 2, minutes: 25 },
    { title: "Miso tomato soup, jammy eggs", blurb: "Silky tomato broth deepened with miso.", why: "Miso does what parmesan rind usually does.", spice: 0, minutes: 25 },
  ],
};

const SHOP = {
  say: "Every fresh thing here gets used at least twice — the cilantro is gone by Thursday and the miso carries into next week.",
  flags: ["Cilantro only keeps ~3 days — tacos on Thursday finish it."],
  items: [
    { item: "Eggplant", qty: "3 medium", section: "Produce", jobs: "Glaze, sheet pan, tacos", days: 5 },
    { item: "Scallions", qty: "1 bunch", section: "Produce", jobs: "Noodles, rice, soup", days: 7 },
    { item: "Cilantro", qty: "1 bunch", section: "Produce", jobs: "Tacos, noodles", days: 3 },
    { item: "Fresh ginger", qty: "1 thumb", section: "Produce", jobs: "Noodles, chicken", days: 21 },
    { item: "Limes", qty: "3", section: "Produce", jobs: "Tacos, noodles", days: 14 },
    { item: "Cherry tomatoes", qty: "1 pint", section: "Produce", jobs: "Soup", days: 5 },
    { item: "Chicken thighs, bone-in", qty: "1.5 lb", section: "Protein", jobs: "Sheet-pan chicken", days: 2 },
    { item: "Eggs", qty: "6", section: "Dairy & eggs", jobs: "Soup, crispy rice", days: 21 },
    { item: "Sour cream", qty: "8 oz tub", section: "Dairy & eggs", jobs: "Lime crema", days: 10 },
    { item: "Corn tortillas", qty: "1 pack", section: "Bakery", jobs: "Tacos", days: 10 },
    { item: "White miso", qty: "1 tub", section: "Pantry", jobs: "All four dinners", days: 90 },
    { item: "Fresh ramen noodles", qty: "2 portions", section: "Pantry", jobs: "Noodles", days: 30 },
  ],
};

const RECIPE = {
  title: "Miso-glazed eggplant & crispy rice", servings: "2", time: "30 minutes",
  technique: "Salting the eggplant first — it seasons it and stops it drinking oil.",
  seasoning: "Taste the glaze: flat needs a squeeze of lime, harsh needs a pinch of sugar.",
  doneness: "Glaze bubbling and blistered at the edges; eggplant collapses when pressed.",
  assembly: "Crispy rice in the bowl, eggplant on top, scallions and cilantro over everything.",
  missing: [],
  components: [
    { name: "Eggplant", items: ["2 medium eggplant, halved lengthwise, flesh scored", "1 tsp salt", "2 tbsp neutral oil"] },
    { name: "Miso glaze", items: ["3 tbsp white miso", "1 tbsp sugar", "1 tbsp rice vinegar", "1 tsp grated ginger"] },
    { name: "Crispy rice", items: ["2 cups cooked rice, cold", "1 tbsp oil", "2 scallions, thinly sliced", "Small handful cilantro, torn"] },
  ],
  steps: [
    { do: "Score the eggplant flesh in a crosshatch, sprinkle with salt, and leave cut-side up for 10 minutes.", why: "Salt pulls water out so the eggplant browns instead of steaming." },
    { do: "Heat the oven broiler. Pat the eggplant dry, brush with oil, and roast cut-side up on a sheet pan for 12 minutes until soft.", why: "" },
    { do: "Whisk miso, sugar, vinegar and ginger into a thick glaze while the eggplant cooks.", why: "" },
    { do: "Spread the glaze over the eggplant and broil 3–4 minutes, watching closely, until it bubbles and blisters.", why: "Miso's sugars burn fast — pull it the moment the edges darken." },
    { do: "Press the cold rice into a hot oiled cast-iron pan. Don't touch it for 5 minutes until the bottom crackles.", why: "You're building a crust, not just reheating." },
    { do: "Pile rice into bowls, top with eggplant, scatter scallions and cilantro.", why: "" },
  ],
};

const GENERIC_RECIPE = (title) => ({ ...RECIPE, title });

const MISE_REPLIES = [
  { m: /done|ready/i, say: "Press it with a spoon — if it slumps and the glaze is blistered at the edges, it's done. Pull it now; miso goes from caramel to burnt in about 30 seconds." },
  { m: /dill|cilantro|herb/i, say: "Agreed — nobody needs a whole bunch for one taco night. I've moved the cilantro into the noodles too, so the whole bunch gets used." },
];

export function mockChat(body) {
  const prompt = body.messages.map((m) => m.content).join("\n");
  if (/grocery spine/i.test(prompt)) return IDEAS;
  if (/Build the grocery list/.test(prompt)) return SHOP;
  if (/Write the recipe for:/.test(prompt)) {
    const t = prompt.match(/Write the recipe for: (.+?) —/)?.[1] || RECIPE.title;
    return t === RECIPE.title ? RECIPE : GENERIC_RECIPE(t);
  }
  if (/what order to cook/.test(prompt)) {
    const dishes = [...prompt.matchAll(/^(\d+)\. (.+?) —/gm)].map((m) => ({ n: +m[1], t: m[2] }));
    const nightsBlock = prompt.split("NIGHTS AVAILABLE (numbered):")[1] || "";
    const nights = [...nightsBlock.matchAll(/^(\d+)\. (\w+)$/gm)].map((m) => ({ n: +m[1], d: m[2] }));
    const reasons = ["cilantro's freshest now", "chicken won't wait", "quickest night", "pantry-only, holds fine"];
    const order = nights.slice(0, dishes.length).map((nn, i) => ({ night: nn.n, dish: dishes[i].n }));
    return { say: order.map((o, i) => `${nights[i].d} — ${dishes[i].t}, ${reasons[i % 4]}`).join("\n"), order };
  }
  if (/They ask:/.test(prompt)) {
    const q = prompt.match(/They ask: "([^"]+)"/)?.[1] || "";
    const hit = MISE_REPLIES.find((r) => r.m.test(q));
    return { say: hit ? hit.say : "Good question — go for it, it'll be great.", shoppingAdd: [], shoppingRemove: [], recipeInstruction: "" };
  }
  if (/usesItems/.test(prompt)) {
    return { say: "Half a tub of miso and three eggs is a proper lunch.", safety: "", orphans: "",
      ideas: [{ title: "Miso butter fried eggs on rice", blurb: "Five minutes, uses the last of everything.", usesItems: ["White miso", "Eggs"], need: "", minutes: 10 }] };
  }
  return { say: "On it." };
}
