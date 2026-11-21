// Catalogue des personnages. Ce sont des personnages inventés pour le site.
// power : "arm" (bras élastique), "spell" (sort magique) ou "fly" (un objet vole jusqu'à la case).
window.CHARACTERS = [
  { id: "pirate",     name: "Pirate élastique", icon: "🏴‍☠️", color: "#ff6b35", power: "arm",   powerName: "Bras élastique", words: ["BOING !", "POW !", "BAM !", "SPLOK !"] },
  { id: "magicienne", name: "Magicienne",       icon: "🧙",   color: "#6c5ce7", power: "spell", powerName: "Sort magique",   words: ["Abracadabra !", "Pouf !", "Zim zam zoum !", "Shazam !"], sparks: ["✨", "⭐", "🌟", "💜", "🦋"] },
  { id: "dragon",     name: "Petit dragon",     icon: "🐉",   color: "#1f9d6b", power: "fly",   powerName: "Souffle de feu", fly: "🔥", sparks: ["🔥", "✨", "💥"], words: ["FWOOSH !", "Grrr !", "Brûlant !"] },
  { id: "licorne",    name: "Licorne étoilée",  icon: "🦄",   color: "#e84393", power: "fly",   powerName: "Arc-en-ciel",    fly: "🌈", sparks: ["🌈", "✨", "💖", "⭐"], words: ["Tadaa !", "Magique !", "Wouah !"] },
  { id: "ninja",      name: "Ninja",            icon: "🥷",   color: "#5f6b7a", power: "fly",   powerName: "Étoile ninja",   fly: "✴️", spin: true, sparks: ["✴️", "💨"], words: ["Tchac !", "Hiya !", "Zip !"] },
  { id: "astronaute", name: "Astronaute",       icon: "🧑‍🚀", color: "#0984e3", power: "fly",   powerName: "Fusée",          fly: "🚀", sparks: ["⭐", "🌟", "🪐", "✨"], words: ["Décollage !", "3, 2, 1… !", "Houston !"] },
  { id: "dino",       name: "Dino",             icon: "🦖",   color: "#6ab04c", power: "fly",   powerName: "Gros pas",       fly: "🐾", sparks: ["🐾", "💥", "🌿"], words: ["BOUM !", "Roarrr !", "Stomp !"] },
  { id: "robot",      name: "Robot",            icon: "🤖",   color: "#7f8c8d", power: "fly",   powerName: "Laser",          fly: "⚡", sparks: ["⚡", "🔩", "✨"], words: ["Bip bip !", "Zzzap !", "Mission OK !"] },
  { id: "sirene",     name: "Sirène",           icon: "🧜",   color: "#00b894", power: "fly",   powerName: "Vague",          fly: "🌊", sparks: ["🐚", "💧", "🐠", "✨"], words: ["Splash !", "Plouf !", "Glou glou !"] },
  { id: "heros",      name: "Super-héros",      icon: "🦸",   color: "#d63031", power: "fly",   powerName: "Vol éclair",     fly: "⚡", sparks: ["⚡", "💥", "⭐"], words: ["SUPER !", "Vlouf !", "Héroïque !"] },
  { id: "panda",      name: "Panda",            icon: "🐼",   color: "#4b6584", power: "fly",   powerName: "Bambou",         fly: "🎋", sparks: ["🎋", "🍃", "✨"], words: ["Miam !", "Zen !", "Hop !"] },
  { id: "renard",     name: "Renard rusé",      icon: "🦊",   color: "#e17055", power: "fly",   powerName: "Grand saut",     fly: "🦊", sparks: ["🍂", "✨", "💨"], words: ["Hop là !", "Rusé !", "Youpi !"] }
];
window.characterById = function (id) {
  return window.CHARACTERS.find(c => c.id === id) || window.CHARACTERS[0];
};
