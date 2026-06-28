/**
 * Generates cognition/tde/intent-clusters.json with precomputed local embeddings.
 * Run: pnpm tsx scripts/generate-intent-clusters.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildMenuQueryEmbedText,
  cosineSimilarity,
  embedMenuTextLocal,
} from "@/lib/denis/cognition/context/menu-rag-embeddings";

export const INTENT_CLUSTER_EXAMPLES: Record<string, readonly string[]> = {
  order: [
    "1x cola",
    "2x pivo",
    "daj mi pivo",
    "daj mi sok",
    "daj mi burger",
    "daj mi colu",
    "daj mi kafu",
    "daj mi cevape",
    "daj mi jedno pivo",
    "daj mi dva piva",
    "naruči burger",
    "poruči cevape",
    "molim jedno pivo",
    "hoću burger",
    "želim pilsner",
    "jedno pivo molim",
    "I want a beer",
    "give me a cola",
    "can I get two burgers",
    "bestell ein bier",
    "ich möchte ein weizen",
    "2 weizen bitte",
    "order a pizza",
    "add fries",
    "dodaj pomfrit",
    "1x weizen 0.5",
    "pilsner molim",
    "weizen molim te",
    "cevapi jedan",
    "sendvič molim",
    "espresso please",
    "latte macchiato",
    "0.5l pilsner",
    "tri pive",
    "two colas",
    "noch ein bier",
    "zwei pils und ein schnitzel",
    "zwei pils",
    "ein schnitzel",
    "povo",
    "povoj",
    "hleb",
    "cevap",
    "ćevap",
    "brötchen bitte",
  ],
  browse: [
    "šta imate",
    "šta imate?",
    "sta imate",
    "what do you have",
    "preporuči mi nešto",
    "preporuci mi nesto",
    "recommend something",
    "surprise me",
    "ma daj nešto",
    "ma daj nesto",
    "ma daj",
    "daj nešto",
    "daj nesto",
    "koje pive imate",
    "what beers do you have",
    "was habt ihr",
    "empfehl mir was",
    "suggest a drink",
    "šta preporučujete",
    "what should I order",
    "was soll ich bestellen",
    "nešto lagano",
    "nesto lagano",
    "something light",
    "koje vino imate",
    "show me options",
    "imamo li vegan",
    "do you have gluten free",
    "koje su opcije",
    "izaberi za mene",
    "odaberi za mene",
    "pick for me",
    "nesto za jesti",
    "nešto za jesti",
  ],
  smalltalk: [
    "zdravo",
    "zdravo kako si",
    "kako si",
    "gde si legendo",
    "denis legendo gde si",
    "hello",
    "hello Denis",
    "hey how are you",
    "hallo wie gehts",
    "guten tag",
    "hi there",
    "šta ima",
    "sta ima",
    "what's up",
    "kako ide",
    "lepo te vidim",
    "nice to see you",
    "danke dir",
    "thanks Denis",
    "super si",
    "you're great",
    "legend",
    "legendo",
    "jesi tu",
    "are you there",
    "bist du da",
    "hej",
    "cao",
    "ćao",
    "servus",
    "moin",
    "alo",
    "moze",
    "može",
    "Može",
    "ok",
    "okej",
    "merhaba",
    "Merhaba",
    "que tal",
    "Que tal",
    "bonjour",
    "hola",
    "ciao bella",
  ],
  complaint: [
    "nisi poslao",
    "nisi poslao porudžbinu",
    "nije poslato",
    "nije stiglo",
    "nisam dobio",
    "nisi dobio",
    "konobar kaže da nisi poslao",
    "konobar kaze da nisi poslao order",
    "not sent",
    "order not received",
    "keine bestellung",
    "waiter says you didn't send",
    "order was not sent",
    "still waiting nothing came",
    "još nije stiglo",
    "jos nije stiglo",
    "gde je moja porudžbina",
    "gdje je moja porudzba",
    "missing order",
    "never got my food",
    "bestellung nicht angekommen",
    "ihr habt nicht bestellt",
    "nothing arrived",
    "half an hour no food",
    "sat vam čekam hranu",
    "sat cekam hranu",
    "lažete",
    "lazete",
    "this is wrong",
  ],
  status: [
    "kad stiže",
    "kada stiže",
    "kad stize moje pivo",
    "gde je pivo",
    "gdje je pivo",
    "gde je moj burger",
    "where is my order",
    "when will it arrive",
    "wo ist mein bier",
    "wann kommt die bestellung",
    "order status",
    "status porudžbine",
    "moje pivo status",
    "my beer status",
    "jesi poslao",
    "jesi poslala",
    "da li ste poslali",
    "poslata porudžbina",
    "poslata",
    "not arrived yet",
    "how long",
    "koliko još",
    "koliko jos",
    "is it ready",
    "je li spremno",
    "ist es fertig",
    "kada je spremno",
    "when is it ready",
    "still waiting",
    "još čekam",
    "jos cekam",
  ],
  handoff: [
    "konobar",
    "pozovi konobara",
    "treba mi konobar",
    "kellner",
    "kellner bitte",
    "waiter please",
    "call the waiter",
    "can I get a waiter",
    "bring the waiter",
    "molim konobara",
    "treba mi osoblje",
    "staff please",
    "help from staff",
    "real person",
    "pravi konobar",
    "human please",
    "not a bot",
    "nije bot",
    "hoću da pričam sa konobarom",
    "hocu da pricam sa konobarom",
    "speak to waiter",
    "garson",
    "garson molim",
    "service bitte",
    "service please",
    "osoba za uslugu",
    "can someone come",
    "dođi konobar",
    "dodi konobar",
    "waiter",
    "bill waiter",
  ],
  settling: [
    "hvala",
    "hvala to je sve",
    "to je sve",
    "samo to",
    "to je to",
    "fertig",
    "das war's",
    "that's all",
    "that's it",
    "done ordering",
    "rechnung bitte",
    "rechnung",
    "ajde račun",
    "ajde racun",
    "račun molim",
    "racun molim",
    "bill please",
    "pay please",
    "zaplatiti",
    "zaplatim",
    "checkout",
    "close the bill",
    "zatvori račun",
    "zatvori racun",
    "gotovo hvala",
    "all set thanks",
    "nothing else thanks",
    "ne treba ništa više",
    "ne treba nista vise",
    "we're done",
    "gotovi smo",
    "fini",
    "danke schön",
    "danke schoen",
    "vielen dank",
    "thanks a lot",
    "hvala puno",
  ],
};

function averageVector(vectors: number[][]): number[] {
  if (!vectors.length) return [];
  const dim = vectors[0]!.length;
  const sum = new Array<number>(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i]! += vec[i] ?? 0;
    }
  }
  const avg = sum.map((v) => v / vectors.length);
  const magnitude = Math.sqrt(avg.reduce((acc, v) => acc + v * v, 0));
  if (magnitude <= 0) return avg;
  return avg.map((v) => v / magnitude);
}

function embedIntentPhrase(text: string): number[] {
  return embedMenuTextLocal(buildMenuQueryEmbedText(text));
}

type ClusterPayload = {
  examples: string[];
  exampleVectors: number[][];
  centroid: number[];
};

function buildClusters(): Record<string, ClusterPayload> {
  const clusters: Record<string, ClusterPayload> = {};
  for (const [name, examples] of Object.entries(INTENT_CLUSTER_EXAMPLES)) {
    const exampleVectors = examples.map((phrase) => embedIntentPhrase(phrase));
    clusters[name] = {
      examples: [...examples],
      exampleVectors,
      centroid: averageVector(exampleVectors),
    };
  }
  return clusters;
}

function main() {
  const clusters = buildClusters();
  const dim = clusters.order?.centroid.length ?? 96;
  const outPath = resolve(
    process.cwd(),
    "src/lib/denis/cognition/tde/intent-clusters.json"
  );

  writeFileSync(
    outPath,
    `${JSON.stringify({ version: 1, dim, clusters }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Wrote ${outPath}`);
  for (const [name, data] of Object.entries(clusters)) {
    console.log(`  ${name}: ${data.examples.length} examples, dim=${data.centroid.length}`);
  }

  // Sanity checks for key fixtures
  const checks: Array<[string, string]> = [
    ["ma daj", "browse"],
    ["ajde racun", "settling"],
    ["gde si legendo", "smalltalk"],
    ["kad stiže moje pivo", "status"],
    ["nisi poslao", "complaint"],
    ["daj mi pivo", "order"],
  ];

  for (const [phrase, expected] of checks) {
    const query = embedIntentPhrase(phrase);
    let best = { cluster: "", score: -1 };
    for (const [name, data] of Object.entries(clusters)) {
      const score = cosineSimilarity(query, data.centroid);
      if (score > best.score) best = { cluster: name, score };
    }
    const ok = best.cluster === expected ? "✓" : "✗";
    console.log(`  ${ok} "${phrase}" → ${best.cluster} (expected ${expected})`);
  }
}

main();
