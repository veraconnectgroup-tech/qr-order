/** Verify all product stock image URLs return HTTP 200. */
const images = [
  ["Aperol Spritz", "photo-1758218058958-78f40a716c20"],
  ["Negroni", "photo-1514362545857-3bc16c4c7d1b"],
  ["Espresso Martini", "photo-1544145945-f90425340c7e"],
  ["Hugo Spritz", "photo-1556679343-c7306c1976bc"],
  ["Mojito", "photo-1572116469696-31de0f17cc34"],
  ["Old Fashioned", "photo-1558642452-9d2a7deb7f62"],
  ["Gin & Tonic", "photo-1556679343-c7306c1976bc"],
  ["Whiskey Sour", "photo-1544145945-f90425340c7e"],
  ["Prosecco DOC", "photo-1553361371-9b22f78e8b1d"],
  ["Pinot Grigio", "photo-1547595628-c61a29f496f0"],
  ["Malbec Reserva", "photo-1514362545857-3bc16c4c7d1b"],
  ["Craft IPA", "photo-1436076863939-06870fe779c2"],
  ["Pilsner", "photo-1535958636474-b021ee887b13"],
  ["Radler", "photo-1535958636474-b021ee887b13"],
  ["Fresh Lemonade", "photo-1541167760496-1628856ab772"],
  ["Sparkling Water", "photo-1602143407151-7111542de6e8"],
  ["Cola", "photo-1559339352-11d035aa65de"],
  ["Espresso", "photo-1495474472287-4d71bcdd2085"],
  ["Truffle Fries", "photo-1551782450-a2132b4ba21d"],
  ["Nachos Supreme", "photo-1555939594-58d7cb561ad1"],
  ["Charcuterie Board", "photo-1504674900247-0877df9cc836"],
  ["Bruschetta Trio", "photo-1571091718767-18b5b1457add"],
  ["Tiramisu", "photo-1563805042-7684c019e1cb"],
  ["Cheesecake", "photo-1551218808-94e220e084d2"],
  ["Chocolate Lava Cake", "photo-1567620905732-2d1ec7ab7445"],
];

const failed = [];
for (const [name, id] of images) {
  const res = await fetch(`https://images.unsplash.com/${id}?w=400`);
  console.log(`${res.status}\t${name}\t${id}`);
  if (res.status !== 200) failed.push(name);
}

if (failed.length) {
  console.error("FAILED:", failed.join(", "));
  process.exit(1);
}

console.log("All images OK");
