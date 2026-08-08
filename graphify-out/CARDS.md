# Ashen Court — Complete Card Map

Generated from `buildPool()` + `cardText()` (`core/src/cardtext.ts`) — rules text is derived from each card's machine-readable `EffectSpec[]`/`TriggerSpec[]`, so it cannot drift from engine behavior.

**285 cards total** — 26 neutral, 12 archetypes x 21 signature cards, 7 tokens.

## Mechanics reference

**Keywords** (`core/src/engine/keywords.ts`)

| Keyword | Effect |
|---|---|
| `taunt` | Enemies must attack this creature before your hero or your other creatures. |
| `rush` | Can attack enemy creatures the turn it is summoned. |
| `charge` | Can attack anything, including the enemy hero, the turn it is summoned. |
| `windfury` | Can attack twice each turn. |
| `lifesteal` | Damage this creature deals also restores that much health to your hero. |
| `ward` | Absorbs the next enemy spell or effect that targets this creature. |
| `shield` | Absorbs the next instance of damage from any source. |
| `venom` | Any creature damaged by this creature is destroyed. |
| `stealth` | Cannot be targeted by the enemy until it attacks. |

**Triggers** — `battlecry` (on play), `deathrattle` (on death), `startOfTurn`, `endOfTurn`, `onDamage`.

**Effect kinds** (`core/src/engine/effects.ts`) — `dealDamage`, `heal`, `draw`, `buff` (+atk/+hp, negative = hex), `summon`, `gainMana` (empty crystal), `refillMana` (immediate mana), `freeze`, `destroy`, `consume` (sacrifice friendly tokens), `silence` (strip keywords/triggers), `returnToHand` (bounce), `copyCard`, `giveKeyword`, `discountMostExpensive`, `discountNextSpell`, `spellPower` (spell-damage aura), `overload` (lock mana next turn).

**Targets** — `any`, `hero`/`self`, `anyCreature`, `enemyCreature`, `friendlyCreature`, `friendlyDragon`, `allEnemies`, `allEnemyCreatures`, `allFriendlyCreatures`, `randomEnemy`, `randomEnemyCreature`.

## Neutrals (`neutral`) — 26 cards

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Herbal Remedy** <br>`neutral-herb` | spell | — | — | common | Restore 3 health to your hero. |
| 1 | **Scroll of Lore** <br>`neutral-scroll` | spell | — | — | common | Draw a card. |
| 1 | **Village Militia** <br>`neutral-militia` | creature | 1/2 | taunt | common | *vanilla* |
| 1 | **Wild Boar** <br>`neutral-boar` | creature | 2/1 | rush | common | *vanilla* |
| 2 | **Feral Hound** <br>`neutral-hound` | creature | 2/2 | rush | common | *vanilla* |
| 2 | **Frostbind** <br>`neutral-frostbind` | spell | — | — | epic | Deal 2 damage to a creature. Freeze a creature. |
| 2 | **Mana Bloom** <br>`neutral-bloom` | spell | — | — | common | Gain 1 empty mana crystal. |
| 2 | **Swiftblade** <br>`neutral-swift` | creature | 2/1 | rush | rare | *vanilla* |
| 2 | **Vanguard Squire** <br>`neutral-squire` | creature | 2/1 | taunt | common | *vanilla* |
| 2 | **War Drums** <br>`neutral-drums` | spell | — | — | common | Give all friendly creatures +1/+1. |
| 3 | **Crack of Thunder** <br>`neutral-crack` | spell | — | — | common | Deal 3 damage to an enemy creature. |
| 3 | **Idol of Growth** <br>`neutral-idol` | artifact | — | — | rare | Start of Turn: Gain 1 empty mana crystal. |
| 3 | **Relic of Restoration** <br>`neutral-relic` | artifact | — | — | rare | Start of Turn: Restore 2 health to your hero. |
| 3 | **Rite of Remembering** <br>`neutral-rite` | spell | — | — | rare | Draw 2 cards. |
| 3 | **Sanctuary Light** <br>`neutral-light` | spell | — | — | rare | Restore 5 health to your hero. |
| 3 | **Stone Golem** <br>`neutral-golem` | creature | 3/3 | taunt | common | *vanilla* |
| 3 | **Wall Sentinel** <br>`neutral-sentinel` | creature | 1/4 | taunt | common | *vanilla* |
| 4 | **Banner of Courage** <br>`neutral-banner` | spell | — | — | epic | Give a friendly creature +2/+2. |
| 4 | **Ironclad Bear** <br>`neutral-bear` | creature | 4/4 | taunt | rare | *vanilla* |
| 4 | **Shadow Lance** <br>`neutral-lance` | spell | — | — | rare | Deal 4 damage to an enemy creature. |
| 5 | **Bulwark Knight** <br>`neutral-knight` | creature | 4/5 | taunt | rare | *vanilla* |
| 5 | **Execute** <br>`neutral-execute` | spell | — | — | epic | Destroy an enemy creature. |
| 5 | **War Ogre** <br>`neutral-ogre` | creature | 5/5 | ward | common | *vanilla* |
| 6 | **Soul Mirror** <br>`neutral-soulmirror` | artifact | — | — | legendary | End of Turn: Add a copy of a random enemy creature to your hand. |
| 7 | **Colossus** <br>`neutral-colossus` | creature | 7/7 | taunt | epic | *vanilla* |
| 9 | **Titan of Ash** <br>`neutral-titan` | creature | 9/9 | taunt | legendary | *vanilla* |

## Ember Court (`ember`) — 21 cards

**Hero:** Pyra Emberveil — *Ember Bolt* (2 mana): Deal 1 damage to any target.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Cinderling** <br>`ember-cinderling` | creature | 2/1 | — | common | Deathrattle: Deal 1 damage to a random enemy. |
| 1 | **Ember Bolt** <br>`ember-bolt` | spell | — | — | common | Deal 2 damage to any target. |
| 1 | **Sparkmage** <br>`ember-sparkmage` | creature | 1/1 | — | common | Battlecry: Deal 1 damage to any target. |
| 2 | **Ash Hunter** <br>`ember-ashhunter` | creature | 2/2 | stealth | common | *vanilla* |
| 2 | **Flamewhelp** <br>`ember-flamewhelp` | creature | 2/1 | rush | common | *vanilla* |
| 2 | **Searing Wave** <br>`ember-searing` | spell | — | — | common | Deal 1 damage to all enemies. |
| 3 | **Blast** <br>`ember-blast` | spell | — | — | common | Deal 4 damage to any target. |
| 3 | **Firebrand** <br>`ember-firebrand` | creature | 3/3 | — | common | Battlecry: Give all friendly creatures Spell Power +1. |
| 3 | **Igniter** <br>`ember-igniter` | creature | 2/3 | — | common | Battlecry: Deal 1 damage to any target. |
| 4 | **Cauterize** <br>`ember-cauterize` | spell | — | — | common | Deal 3 damage to any target. Restore 3 health to your hero. |
| 4 | **Emberforged Blade** <br>`ember-emberforged` | artifact | — | — | rare | Start of Turn: Deal 1 damage to a random enemy. |
| 4 | **Hellhound** <br>`ember-hellhound` | creature | 4/3 | charge | common | *vanilla* |
| 5 | **Firestorm** <br>`ember-firestorm` | spell | — | — | rare | Deal 4 damage to all enemies. |
| 5 | **Phoenix Whelp** <br>`ember-phoenixwhelp` | creature | 5/4 | lifesteal | rare | *vanilla* |
| 5 | **Pyroblast** <br>`ember-pyroblast` | spell | — | — | rare | Deal 7 damage to any target. |
| 6 | **Emberlord Vharn** <br>`ember-emberlord` | creature | 5/5 | — | legendary | Battlecry: Deal 2 damage to a random enemy. |
| 6 | **Flamebringer** <br>`ember-flamebringer` | creature | 5/5 | — | rare | Battlecry: Deal 2 damage to any target. |
| 7 | **Ashwing** <br>`ember-ashwing` | creature | 7/6 | charge | epic | *vanilla* |
| 7 | **Conflagration** <br>`ember-conflagration` | spell | — | — | epic | Deal 2 damage to all enemies. |
| 8 | **Magmasoul** <br>`ember-magmasoul` | creature | 7/7 | windfury | epic | *vanilla* |
| 9 | **The Phoenix Sovereign** <br>`ember-phoenix` | creature | 8/8 | — | legendary | Battlecry: Deal 3 damage to all enemies.<br>Deathrattle: Summon 1 Phoenix Ash. |

## Hollow Choir (`choir`) — 21 cards

**Hero:** Vespera Dawnlight — *Lullaby* (2 mana): Restore 2 health to your hero.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Acolyte** <br>`choir-acolyte` | creature | 1/2 | — | common | Battlecry: Restore 2 health to your hero. |
| 1 | **Mend** <br>`choir-mend` | spell | — | — | common | Restore 3 health to any target. |
| 2 | **Candlelight** <br>`choir-candle` | spell | — | — | common | Draw a card. Restore 2 health to your hero. |
| 2 | **Sergeant of the Pale** <br>`choir-sergeant` | creature | 2/3 | ward | common | *vanilla* |
| 2 | **Smite** <br>`choir-smite` | spell | — | — | common | Deal 2 damage to an enemy creature. |
| 3 | **Chant of Rest** <br>`choir-chant` | spell | — | — | common | Restore 5 health to your hero. |
| 3 | **Warden** <br>`choir-warden` | creature | 2/4 | taunt | common | *vanilla* |
| 4 | **Banish** <br>`choir-banish` | spell | — | — | common | Destroy an enemy creature. |
| 4 | **Cleansing Light** <br>`choir-clear` | spell | — | — | common | Deal 2 damage to all enemy creatures. |
| 4 | **Praetor** <br>`choir-praetor` | creature | 3/5 | — | common | Battlecry: Silence an enemy creature. |
| 4 | **Revelation** <br>`choir-revelation` | spell | — | — | rare | Draw 3 cards. |
| 5 | **Luminarch** <br>`choir-luminarch` | creature | 4/6 | — | common | Battlecry: Draw a card. |
| 5 | **Martyr** <br>`choir-martyr` | creature | 3/5 | — | rare | Deathrattle: Restore 5 health to your hero. |
| 5 | **Sanctum of Echoes** <br>`choir-sanctum` | artifact | — | — | rare | Start of Turn: Draw a card. |
| 6 | **Exorcist** <br>`choir-exorcist` | creature | 4/7 | — | epic | Battlecry: Destroy an enemy creature. |
| 6 | **Mirror of Souls** <br>`choir-mirror` | artifact | — | — | legendary | End of Turn: Summon 1 Choir Spirit. |
| 6 | **Seraph of Lament** <br>`choir-seraph` | creature | 5/6 | lifesteal | rare | *vanilla* |
| 6 | **Truth Unveiled** <br>`choir-truth` | spell | — | — | epic | Draw 4 cards. Restore 4 health to your hero. |
| 7 | **Lightbringer** <br>`choir-lightbringer` | creature | 6/8 | taunt | epic | *vanilla* |
| 8 | **Final Verdict** <br>`choir-verdict` | spell | — | — | rare | Destroy an enemy creature. Restore 5 health to your hero. |
| 9 | **Lady of the Pale Choir** <br>`choir-lady` | creature | 6/8 | taunt | legendary | Start of Turn: Restore 4 health to your hero. |

## Vermin Swarm (`vermin`) — 21 cards

**Hero:** Rat King Moulder — *Rat Call* (2 mana): Summon 1 Giant Rat.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Nibble** <br>`vermin-nibble` | spell | — | — | common | Deal 1 damage to a creature. |
| 1 | **Scavenger** <br>`vermin-scavenger` | creature | 2/1 | — | common | Deathrattle: Summon 1 Giant Rat. |
| 1 | **Squeaker** <br>`vermin-squeaker` | creature | 1/1 | venom | common | *vanilla* |
| 2 | **Mangy Brute** <br>`vermin-brute` | creature | 3/2 | — | common | Battlecry: Summon 1 Giant Rat. |
| 2 | **Pack Call** <br>`vermin-packcall` | spell | — | — | common | Summon 2 Giant Rats. |
| 3 | **Frenzy** <br>`vermin-frenzy` | spell | — | — | common | Give all friendly creatures +2/+0. |
| 3 | **Gnawer** <br>`vermin-gnawer` | creature | 3/3 | venom | common | *vanilla* |
| 3 | **Swarmlord** <br>`vermin-swarmlord` | creature | 2/4 | — | common | Battlecry: Consume 2 friendly tokens. Give all friendly creatures +1/+1. |
| 4 | **Alpha Rat** <br>`vermin-alpha` | creature | 3/3 | — | rare | Battlecry: Give all friendly creatures +1/+1. |
| 4 | **Carrion Call** <br>`vermin-carrion` | spell | — | — | epic | Summon 2 Giant Rats. |
| 4 | **Vermin Army** <br>`vermin-army` | spell | — | — | common | Summon 3 Giant Rats. |
| 4 | **Warband** <br>`vermin-warband` | creature | 5/4 | rush | common | *vanilla* |
| 5 | **Breeder** <br>`vermin-breeder` | creature | 3/4 | — | rare | End of Turn: Summon 1 Giant Rat. |
| 5 | **Pestilence** <br>`vermin-pestilence` | spell | — | — | common | Deal 2 damage to all enemy creatures. |
| 5 | **Plaguemaster** <br>`vermin-plaguemaster` | creature | 3/5 | — | rare | Deathrattle: Summon 2 Giant Rats. |
| 6 | **Queen Moulder** <br>`vermin-queen` | creature | 4/6 | — | rare | Start of Turn: Summon 1 Giant Rat. |
| 6 | **The Tide of Teeth** <br>`vermin-tide` | spell | — | — | rare | Summon 4 Giant Rats. |
| 7 | **Plague King** <br>`vermin-plagueking` | creature | 6/6 | — | legendary | Start of Turn: Summon 2 Giant Rats. |
| 7 | **The Horde** <br>`vermin-horde` | spell | — | — | epic | Summon 6 Giant Rats. |
| 8 | **Rattus the God** <br>`vermin-rattus` | creature | 8/8 | taunt | epic | *vanilla* |
| 9 | **The Endless Swarm** <br>`vermin-endless` | spell | — | — | legendary | Summon 7 Giant Rats. Give all friendly creatures +1/+1. |

## Dragonflight (`dragon`) — 21 cards

**Hero:** Seraphina Skywing — *Dragon's Boon* (2 mana): Give a friendly Dragon +1/+1.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Dragon Whelp** <br>`dragon-whelp` | creature | 1/2 | rush | common | *vanilla* |
| 2 | **Scaleglider** <br>`dragon-scaleglider` | creature | 2/3 | stealth | common | *vanilla* |
| 2 | **Wingmen** <br>`dragon-wingmen` | spell | — | — | common | Give a friendly Dragon +2/+2. |
| 2 | **Wyrm Snout** <br>`dragon-snout` | spell | — | — | common | Deal 2 damage to a creature. |
| 3 | **Claw Sweep** <br>`dragon-claw` | spell | — | — | common | Deal 3 damage to all enemy creatures. |
| 3 | **Hatchling** <br>`dragon-hatchling` | creature | 3/3 | — | common | Battlecry: Summon 1 Dragon Whelp. |
| 3 | **Roost Guardian** <br>`dragon-roost` | creature | 2/4 | taunt | common | *vanilla* |
| 3 | **Sky Hunter** <br>`dragon-hunter` | creature | 3/3 | rush | common | *vanilla* |
| 4 | **Elderscale** <br>`dragon-elderscale` | creature | 3/5 | taunt | common | *vanilla* |
| 4 | **Seer** <br>`dragon-seer` | creature | 2/5 | — | rare | End of Turn: Draw a card. |
| 4 | **Swoop** <br>`dragon-swoop` | spell | — | — | common | Deal 4 damage to an enemy creature. |
| 5 | **Drakeling** <br>`dragon-drakeling` | creature | 5/5 | — | common | Battlecry: Give a friendly Dragon +1/+1. |
| 5 | **Matriarch** <br>`dragon-matriarch` | creature | 4/5 | — | rare | Battlecry: Give all friendly creatures +1/+1. |
| 6 | **Celestial Skywing** <br>`dragon-celestial` | creature | 4/4 | windfury | legendary | Battlecry: Give all friendly creatures +1/+1. |
| 6 | **Flight of Dragons** <br>`dragon-flight` | spell | — | — | rare | Summon 2 Dragon Whelps. |
| 6 | **Warden of Skies** <br>`dragon-warden` | creature | 5/6 | taunt | rare | *vanilla* |
| 7 | **Prince of Scales** <br>`dragon-prince` | creature | 7/7 | — | rare | Battlecry: Give a friendly Dragon +2/+2. |
| 7 | **Sky Council** <br>`dragon-council` | artifact | — | — | epic | Start of Turn: Give a friendly Dragon +1/+1. |
| 8 | **Dragonstorm** <br>`dragon-storm` | spell | — | — | epic | Summon 3 Dragon Whelps. |
| 8 | **Wyrm Tyrant** <br>`dragon-tyrant` | creature | 8/6 | windfury | epic | *vanilla* |
| 10 | **Worldeater** <br>`dragon-worldeater` | creature | 10/10 | taunt | legendary | *vanilla* |

## Elder Roots (`roots`) — 21 cards

**Hero:** Oldroot — *Roots of the World* (2 mana): Gain 1 empty mana crystal. Gain 1 Mana.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Creeping Vine** <br>`roots-vine` | spell | — | — | common | Deal 1 damage to a creature. |
| 1 | **Grow** <br>`roots-grow` | spell | — | — | common | Gain 1 empty mana crystal. |
| 1 | **Sapling** <br>`roots-sapling` | creature | 1/2 | taunt | common | *vanilla* |
| 2 | **Sprout** <br>`roots-sprout` | creature | 2/2 | taunt | common | *vanilla* |
| 3 | **Barkhide** <br>`roots-barkhide` | creature | 2/4 | taunt | common | *vanilla* |
| 3 | **Bloom** <br>`roots-bloom` | spell | — | — | common | Gain 2 empty mana crystals. |
| 3 | **Forager** <br>`roots-forager` | creature | 3/3 | — | common | Battlecry: Gain 1 empty mana crystal. |
| 3 | **Regrowth** <br>`roots-regen` | spell | — | — | rare | Restore 4 health to your hero. |
| 3 | **Thornlash** <br>`roots-thorn` | spell | — | — | common | Deal 3 damage to a creature. |
| 3 | **Verdant Bloom** <br>`roots-verdant` | spell | — | — | rare | Gain 2 empty mana crystals. Draw a card. |
| 4 | **Ancient's Wrath** <br>`roots-ancients` | creature | 4/4 | taunt | common | *vanilla* |
| 4 | **Nature's Bounty** <br>`roots-bounty` | spell | — | — | rare | Draw 2 cards. Gain 1 empty mana crystal. |
| 4 | **Sylvan Grove** <br>`roots-sylvan` | artifact | — | — | common | Start of Turn: Gain 1 empty mana crystal. Gain 1 Mana. |
| 5 | **Ironwood** <br>`roots-ironwood` | creature | 4/6 | taunt | common | *vanilla* |
| 6 | **Worldtree Sapling** <br>`roots-worldtree` | creature | 5/5 | — | rare | Battlecry: Gain 2 empty mana crystals. |
| 7 | **Elder Treant** <br>`roots-treant` | creature | 7/7 | taunt | rare | *vanilla* |
| 7 | **Heart of the Forest** <br>`roots-heart` | artifact | — | — | legendary | End of Turn: Summon 1 Root Treant. |
| 8 | **Awakening** <br>`roots-awaken` | spell | — | — | epic | Gain 2 empty mana crystals. Summon 3 Root Treants. |
| 8 | **Goliath** <br>`roots-goliath` | creature | 8/8 | — | epic | Battlecry: Gain 2 empty mana crystals. |
| 10 | **Titan of the Deep Roots** <br>`roots-titan` | creature | 10/10 | taunt | epic | *vanilla* |
| 12 | **Worldmother** <br>`roots-worldmother` | creature | 12/12 | — | legendary | Battlecry: Give all friendly creatures +2/+2. |

## Shadow Dancers (`dance`) — 21 cards

**Hero:** Nyx Nightshade — *Gamble* (2 mana): Draw a card. Deal 1 damage to your hero.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Dagger Throw** <br>`dance-dagger` | spell | — | — | common | Deal 2 damage to a creature. |
| 1 | **Shadow Step** <br>`dance-step` | spell | — | — | common | Draw a card. |
| 1 | **Twirl** <br>`dance-twirl` | spell | — | — | common | Deal 1 damage to any target. |
| 2 | **Acrobat** <br>`dance-acrobat` | creature | 2/2 | stealth | common | *vanilla* |
| 2 | **Dervish** <br>`dance-dervish` | creature | 3/1 | rush | common | *vanilla* |
| 2 | **Slash** <br>`dance-slash` | spell | — | — | common | Deal 3 damage to an enemy creature. |
| 3 | **Echo** <br>`dance-echo` | spell | — | — | common | Draw 2 cards. |
| 3 | **Spinning Blade** <br>`dance-spin` | spell | — | — | common | Deal 2 damage to all enemies. |
| 3 | **Vanish** <br>`dance-vanish` | spell | — | — | common | Deal 3 damage to a creature. |
| 4 | **Bladeweaver** <br>`dance-bladeweaver` | creature | 4/4 | stealth | common | *vanilla* |
| 4 | **Flurry** <br>`dance-flurry` | spell | — | — | rare | Deal 4 damage to a random enemy creature. |
| 4 | **Veil Dance** <br>`dance-veil` | spell | — | — | common | Draw 2 cards. Give a friendly creature Stealth. |
| 5 | **Grand Finale** <br>`dance-finale` | spell | — | — | rare | Deal 6 damage to a random enemy. |
| 5 | **Mirage** <br>`dance-mirage` | spell | — | — | rare | Draw 3 cards. Return an enemy creature to its owner's hand. |
| 5 | **Trickster** <br>`dance-trickster` | creature | 4/4 | — | rare | Battlecry: Draw a card. |
| 6 | **Illusionist** <br>`dance-illusionist` | creature | 5/5 | — | rare | Battlecry: Return an enemy creature to its owner's hand. |
| 6 | **Infinite Shadows** <br>`dance-infinite` | artifact | — | — | legendary | End of Turn: Draw a card. |
| 7 | **Puppet Master** <br>`dance-puppet` | creature | 6/6 | — | epic | Battlecry: Draw 2 cards. |
| 7 | **Shadow Dancer** <br>`dance-shadow` | creature | 5/5 | — | epic | Deathrattle: Draw 2 cards. |
| 8 | **The Ultimate Trick** <br>`dance-trick` | spell | — | — | epic | Deal 8 damage to any target. |
| 9 | **Nyx, the Last Dance** <br>`dance-nyx` | creature | 8/8 | windfury | legendary | *vanilla* |

## Bone Horde (`bone`) — 21 cards

**Hero:** Baron Von Bone — *Raise Skeleton* (2 mana): Summon 1 Skeleton.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Clatter** <br>`bone-clatter` | spell | — | — | common | Summon 1 Skeleton. |
| 1 | **Scrapper** <br>`bone-scrapper` | creature | 1/2 | — | common | *vanilla* |
| 2 | **Gnaw** <br>`bone-gnaw` | spell | — | — | common | Deal 2 damage to a creature. |
| 2 | **Gravedigger** <br>`bone-gravedigger` | creature | 2/2 | — | common | Deathrattle: Summon 1 Skeleton. |
| 2 | **Marauder** <br>`bone-marauder` | creature | 3/1 | — | common | *vanilla* |
| 3 | **Bone Frenzy** <br>`bone-frenzy` | spell | — | — | common | Give all friendly creatures +1/+1. |
| 3 | **Cairn** <br>`bone-cairn` | creature | 0/4 | taunt | common | Deathrattle: Summon 1 Skeleton. |
| 3 | **Raider** <br>`bone-raider` | creature | 3/3 | — | common | *vanilla* |
| 4 | **Howl** <br>`bone-howl` | spell | — | — | common | Summon 2 Skeletons. |
| 4 | **Rattle** <br>`bone-rattle` | spell | — | — | common | Deal 2 damage to all enemies. |
| 4 | **Skull Wall** <br>`bone-skull` | creature | 2/5 | taunt | common | *vanilla* |
| 5 | **Legion Call** <br>`bone-legion` | spell | — | — | rare | Summon 3 Skeletons. |
| 5 | **Necromancer** <br>`bone-necromancer` | creature | 3/4 | — | rare | Start of Turn: Summon 1 Skeleton. |
| 5 | **Whisperer** <br>`bone-whisper` | creature | 3/6 | — | epic | End of Turn: Summon 1 Skeleton. |
| 6 | **Bone Horde** <br>`bone-horde` | spell | — | — | rare | Summon 4 Skeletons. |
| 6 | **Warlord** <br>`bone-warlord` | creature | 6/6 | — | rare | Deathrattle: Summon 2 Skeletons. |
| 7 | **Behemoth** <br>`bone-behemoth` | creature | 7/7 | taunt | rare | *vanilla* |
| 7 | **Risen Army** <br>`bone-army` | spell | — | — | legendary | Summon 6 Skeletons. |
| 8 | **Cataclysm** <br>`bone-cataclysm` | spell | — | — | epic | Deal 3 damage to all enemies. |
| 9 | **Overlord** <br>`bone-overlord` | creature | 8/10 | — | epic | Deathrattle: Summon 2 Skeletons. |
| 10 | **The Bone King** <br>`bone-king` | creature | 8/10 | taunt | legendary | Deathrattle: Summon 3 Skeletons. |

## Grave Pact (`pact`) — 21 cards

**Hero:** Morticia Gravefall — *Blood Toll* (2 mana): Deal 1 damage to your hero. Draw a card.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Blood Thirst** <br>`pact-thirst` | spell | — | — | common | Deal 2 damage to a creature. |
| 1 | **Bloodrite** <br>`pact-bloodrite` | spell | — | — | common | Deal 1 damage to your hero. Draw a card. |
| 2 | **Bargain** <br>`pact-bargain` | spell | — | — | rare | Deal 3 damage to your hero. Gain 5 Mana. |
| 2 | **Blood Imp** <br>`pact-imp` | creature | 3/2 | — | common | *vanilla* |
| 2 | **Leech** <br>`pact-leech` | creature | 2/2 | lifesteal | common | *vanilla* |
| 2 | **Sacrifice** <br>`pact-sacrifice` | spell | — | — | common | Destroy a friendly creature. Draw 2 cards. |
| 3 | **Blood Bond** <br>`pact-bond` | spell | — | — | common | Give a friendly creature +3/+3. Deal 2 damage to your hero. |
| 3 | **Dark Pact** <br>`pact-darkpact` | spell | — | — | rare | Destroy a friendly creature. Draw 2 cards. |
| 3 | **Masochist** <br>`pact-masochist` | creature | 3/4 | — | common | On Damage: Draw a card. |
| 4 | **Ascension** <br>`pact-ascend` | spell | — | — | epic | Gain 5 Mana. Draw 3 cards. Deal 5 damage to your hero. |
| 4 | **Cultist** <br>`pact-cultist` | creature | 4/4 | — | common | Deathrattle: Draw a card. |
| 4 | **Life Leech** <br>`pact-lifeleech` | spell | — | — | common | Deal 3 damage to an enemy creature. Restore 3 health to your hero. |
| 4 | **Ravager** <br>`pact-ravager` | creature | 5/3 | — | common | Battlecry: Deal 2 damage to your hero. Draw a card. |
| 5 | **Fiend** <br>`pact-fiend` | creature | 6/4 | — | rare | Battlecry: Deal 2 damage to your hero. Draw 2 cards. |
| 5 | **Hemorrhage** <br>`pact-hemorrhage` | spell | — | — | common | Deal 5 damage to any target. |
| 5 | **Torment** <br>`pact-torment` | spell | — | — | rare | Deal 3 damage to all enemies. Deal 2 damage to your hero. |
| 6 | **Dreadknight** <br>`pact-dread` | creature | 6/6 | — | rare | Battlecry: Deal 2 damage to your hero. Gain 2 Mana. |
| 6 | **Immortal Bargain** <br>`pact-immortal` | artifact | — | — | legendary | Start of Turn: Deal 1 damage to your hero. Draw a card. |
| 7 | **Mirror of Blood** <br>`pact-mirror` | spell | — | — | epic | Deal 7 damage to a random enemy. Deal 3 damage to your hero. |
| 8 | **Lord of the Pact** <br>`pact-lord` | creature | 8/8 | — | epic | Start of Turn: Deal 1 damage to your hero. Draw a card. |
| 9 | **Morticia Gravefall** <br>`pact-morticia` | creature | 7/9 | — | legendary | Battlecry: Deal 3 damage to your hero. Deal 3 damage to all enemies. |

## Night Coven (`coven`) — 21 cards

**Hero:** Morwenna Hex — *Hex* (2 mana): Give an enemy creature −1/−1.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Whisper** <br>`coven-whisper` | spell | — | — | common | Deal 1 damage to a creature. |
| 2 | **Curse** <br>`coven-curse` | spell | — | — | common | Give an enemy creature −1/−1. Deal 1 damage to an enemy creature. |
| 2 | **Familiar** <br>`coven-familiar` | creature | 2/2 | — | common | *vanilla* |
| 2 | **Hex** <br>`coven-hex` | spell | — | — | common | Give an enemy creature −1/−1. |
| 3 | **Bog Hag** <br>`coven-bog` | creature | 2/4 | — | common | *vanilla* |
| 3 | **Doom** <br>`coven-doom` | spell | — | — | common | Deal 3 damage to an enemy creature. |
| 3 | **Transfix** <br>`coven-transfix` | spell | — | — | rare | Freeze an enemy creature. Give an enemy creature −1/−1. |
| 3 | **Wither** <br>`coven-wither` | spell | — | — | common | Give an enemy creature −2/−2. |
| 4 | **Nightmare** <br>`coven-nightmare` | spell | — | — | common | Give an enemy creature −3/−3. |
| 4 | **Raven** <br>`coven-raven` | creature | 4/4 | — | common | Battlecry: Give an enemy creature −1/−1. |
| 4 | **Scarecrow** <br>`coven-scare` | creature | 1/7 | taunt | common | *vanilla* |
| 5 | **Decay** <br>`coven-decay` | spell | — | — | rare | Give all enemy creatures −2/−2. |
| 5 | **Drain** <br>`coven-drain` | spell | — | — | common | Deal 2 damage to an enemy creature. Restore 2 health to your hero. |
| 5 | **Mirror Hex** <br>`coven-mirrorhex` | spell | — | — | rare | Give an enemy creature −4/−4. |
| 6 | **Eldritch Horror** <br>`coven-eldritch` | creature | 6/6 | venom | rare | *vanilla* |
| 6 | **Veil of Night** <br>`coven-veil` | spell | — | — | rare | Draw 3 cards. Deal 1 damage to your hero. |
| 7 | **Apathy** <br>`coven-apathy` | spell | — | — | epic | Give all enemy creatures −3/−3. |
| 7 | **Eternal Night** <br>`coven-eternal` | artifact | — | — | legendary | Start of Turn: Give all enemy creatures −1/−1. |
| 8 | **Morwenna's Glare** <br>`coven-glare` | spell | — | — | epic | Destroy an enemy creature. Give all enemy creatures −1/−1. |
| 9 | **Abyssal Gaze** <br>`coven-abyss` | creature | 8/9 | — | epic | Battlecry: Give an enemy creature −2/−2. |
| 10 | **The Hex Queen** <br>`coven-queen` | creature | 7/10 | — | legendary | Battlecry: Give all enemy creatures −2/−2. |

## Starforged (`star`) — 21 cards

**Hero:** Archon Stellara — *Star Rite* (2 mana): Your most expensive creature costs 1 less this turn.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Spark** <br>`star-spark` | spell | — | — | common | Deal 2 damage to a creature. |
| 2 | **Meditate** <br>`star-meditate` | spell | — | — | common | Draw a card. Gain 1 empty mana crystal. |
| 2 | **Meteor Shard** <br>`star-meteor` | spell | — | — | common | Deal 3 damage to an enemy creature. |
| 2 | **Star Acolyte** <br>`star-acolyte` | creature | 2/3 | taunt | common | *vanilla* |
| 3 | **Guardian** <br>`star-guardian` | creature | 2/4 | taunt | common | *vanilla* |
| 3 | **Star Focus** <br>`star-focus` | spell | — | — | common | Gain 2 empty mana crystals. |
| 4 | **Comet** <br>`star-comet` | spell | — | — | common | Deal 4 damage to an enemy creature. |
| 4 | **Prophet** <br>`star-prophet` | creature | 3/3 | — | rare | Battlecry: Your most expensive creature costs 1 less this turn. |
| 4 | **Sentinel** <br>`star-sentinel` | creature | 3/5 | taunt | common | *vanilla* |
| 5 | **Gravitate** <br>`star-gravitate` | spell | — | — | common | Deal 3 damage to all enemies. |
| 5 | **Oracle** <br>`star-oracle` | creature | 3/4 | — | rare | Battlecry: Your most expensive creature costs 1 less this turn. |
| 5 | **Starmage** <br>`star-mage` | creature | 4/6 | — | common | Battlecry: Give a friendly creature Spell Power +1. |
| 6 | **Celestial Chorus** <br>`star-chorus` | spell | — | — | rare | Draw 2 cards. Gain 1 empty mana crystal. |
| 6 | **Starfall** <br>`star-fall` | spell | — | — | common | Deal 6 damage to any target. |
| 7 | **Eclipse** <br>`star-eclipse` | spell | — | — | rare | Deal 7 damage to any target. |
| 7 | **Star Giant** <br>`star-giant` | creature | 7/7 | taunt | rare | *vanilla* |
| 8 | **Living Constellation** <br>`star-constellation` | creature | 7/7 | — | legendary | Battlecry: Your most expensive creature costs 2 less this turn. |
| 8 | **Wanderer** <br>`star-wanderer` | creature | 8/8 | charge | epic | *vanilla* |
| 9 | **Chorus of the Void** <br>`star-void` | spell | — | — | epic | Deal 9 damage to any target. |
| 10 | **Megastar** <br>`star-megastar` | creature | 10/10 | windfury | epic | *vanilla* |
| 12 | **Archon Stellara** <br>`star-archon` | creature | 12/12 | taunt | legendary | *vanilla* |

## Eternal Vigil (`vigil`) — 21 cards

**Hero:** Ser Aldric the Vigilant — *Renewal* (2 mana): Restore 1 health to all friendly creatures.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Bless** <br>`vigil-bless` | spell | — | — | common | Restore 2 health to any target. |
| 1 | **Guard** <br>`vigil-guard` | creature | 1/3 | taunt | common | *vanilla* |
| 2 | **Divine Shield** <br>`vigil-divine` | spell | — | — | rare | Give a friendly creature Shield. |
| 2 | **Lights** <br>`vigil-lights` | spell | — | — | common | Deal 1 damage to all enemies. |
| 2 | **Prayer** <br>`vigil-pray` | spell | — | — | common | Restore 4 health to your hero. |
| 2 | **Squire** <br>`vigil-squire` | creature | 2/2 | shield | common | *vanilla* |
| 3 | **Monk** <br>`vigil-monk` | creature | 3/3 | lifesteal | common | *vanilla* |
| 3 | **Paladin** <br>`vigil-paladin` | creature | 2/4 | taunt | common | *vanilla* |
| 3 | **Smite** <br>`vigil-smite` | spell | — | — | common | Deal 3 damage to an enemy creature. |
| 4 | **Hymn of Dawn** <br>`vigil-hymn` | spell | — | — | common | Restore 6 health to your hero. Give a friendly creature Lifesteal. |
| 4 | **Shieldbearer** <br>`vigil-shieldbearer` | creature | 1/6 | taunt, shield | common | *vanilla* |
| 5 | **Avenger** <br>`vigil-avenger` | creature | 5/4 | rush | rare | *vanilla* |
| 5 | **Crusader** <br>`vigil-crusader` | creature | 4/5 | rush | common | *vanilla* |
| 5 | **Lay on Hands** <br>`vigil-layhands` | spell | — | — | rare | Restore 8 health to your hero. Draw a card. |
| 5 | **Radiance** <br>`vigil-radiance` | spell | — | — | epic | Restore 5 health to your hero. Draw 2 cards. |
| 6 | **Sanctify** <br>`vigil-sanctify` | spell | — | — | rare | Restore 10 health to your hero. Give all friendly creatures Shield. |
| 6 | **The Eternal Vigil** <br>`vigil-eternal` | artifact | — | — | legendary | Start of Turn: Restore 3 health to your hero. |
| 6 | **Warden of Dawn** <br>`vigil-warden` | creature | 5/6 | lifesteal | rare | *vanilla* |
| 7 | **Archon of Dawn** <br>`vigil-archon` | creature | 6/7 | taunt, lifesteal | epic | *vanilla* |
| 8 | **Saint** <br>`vigil-saint` | creature | 6/9 | lifesteal | epic | *vanilla* |
| 9 | **Ser Aldric** <br>`vigil-aldric` | creature | 8/8 | taunt, lifesteal | legendary | *vanilla* |

## Stormwrought (`storm`) — 21 cards

**Hero:** Zephyra Stormveil — *Static* (2 mana): Your next spell costs 1 less this turn.

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 1 | **Arc** <br>`storm-arc` | spell | — | — | common | Deal 2 damage to a creature. |
| 2 | **Adept** <br>`storm-adept` | creature | 2/2 | rush | common | *vanilla* |
| 2 | **Bolt** <br>`storm-bolt` | spell | — | — | common | Deal 3 damage to any target. |
| 2 | **Storm Charge** <br>`storm-charge` | spell | — | — | common | Give a friendly creature +2/+2. |
| 3 | **Emberwitch** <br>`storm-emberwitch` | creature | 3/2 | — | common | Battlecry: Deal 1 damage to any target. |
| 3 | **Squall** <br>`storm-squall` | spell | — | — | common | Deal 2 damage to all enemies. |
| 4 | **Gust** <br>`storm-gust` | spell | — | — | common | Deal 4 damage to an enemy creature. |
| 4 | **Mistweaver** <br>`storm-mistweaver` | creature | 3/3 | — | rare | Battlecry: Your next spell costs 1 less this turn. |
| 4 | **Sorcerer** <br>`storm-sorcerer` | creature | 3/4 | — | common | Battlecry: Return an enemy creature to its owner's hand. |
| 4 | **Storm Rider** <br>`storm-rider` | creature | 4/3 | rush | common | *vanilla* |
| 5 | **Downpour** <br>`storm-downpour` | spell | — | — | common | Deal 3 damage to all enemies. |
| 5 | **Echoes** <br>`storm-echoes` | spell | — | — | rare | Draw 2 cards. Deal 1 damage to all enemies. |
| 5 | **Siren** <br>`storm-siren` | creature | 4/4 | — | epic | Battlecry: Your next spell costs 1 less this turn. |
| 6 | **Cyclone** <br>`storm-cyclone` | spell | — | — | common | Deal 6 damage to any target. |
| 6 | **Stormcaller** <br>`storm-stormcaller` | creature | 5/5 | — | rare | Battlecry: Your next spell costs 2 less this turn. |
| 7 | **Eye of the Storm** <br>`storm-eye` | spell | — | — | rare | Deal 4 damage to all enemies. Draw a card. |
| 7 | **Leviathan** <br>`storm-leviathan` | creature | 7/7 | taunt | rare | *vanilla* |
| 8 | **Boreas, Eye of the Storm** <br>`storm-boreas` | artifact | — | — | legendary | Start of Turn: Deal 2 damage to a random enemy. Draw a card. |
| 8 | **Tempest** <br>`storm-tempest` | spell | — | — | epic | Deal 5 damage to all enemies. |
| 9 | **Thunderhead** <br>`storm-thunderhead` | creature | 9/9 | taunt | epic | *vanilla* |
| 10 | **Zephyra** <br>`storm-zephyra` | creature | 9/9 | windfury | legendary | *vanilla* |

## Tokens (`token`) — 7 cards

| Cost | Card | Type | Stats | Keywords | Rarity | Text |
|---|---|---|---|---|---|---|
| 0 | **Choir Spirit** <br>`token-wisp` | creature | 1/1 | — | common | *vanilla* |
| 0 | **Dragon Whelp** <br>`token-dragon-whelp` | creature | 1/1 | — | common | *vanilla* |
| 0 | **Giant Rat** <br>`token-rat` | creature | 1/1 | — | common | *vanilla* |
| 0 | **Mana Surge** <br>`mana-surge` | spell | — | — | common | Gain 1 Mana. |
| 0 | **Phoenix Ash** <br>`token-phoenixash` | creature | 2/2 | — | common | *vanilla* |
| 0 | **Root Treant** <br>`token-treant` | creature | 1/1 | taunt | common | *vanilla* |
| 0 | **Skeleton** <br>`token-skeleton` | creature | 1/1 | — | common | *vanilla* |

## Preconstructed decks (60 cards each)

Each deck = 21 signature cards (with copy counts) + 12 neutral cards.

**Ember Court** (60 cards)

- Signature: Cinderling x3, Sparkmage x3, Ember Bolt x3, Ash Hunter x3, Searing Wave x3, Flamewhelp x3, Blast x3, Firebrand x3, Igniter x3, Cauterize x3, Hellhound x3, Firestorm x2, Phoenix Whelp x2, Pyroblast x2, Flamebringer x2, Emberforged Blade x2, Conflagration x1, Ashwing x1, Magmasoul x1, The Phoenix Sovereign x1, Emberlord Vharn x1
- Neutrals: Village Militia, Wild Boar, Crack of Thunder, Scroll of Lore, Mana Bloom, War Drums, War Ogre, Swiftblade, Shadow Lance, Banner of Courage, Vanguard Squire, Herbal Remedy

**Hollow Choir** (60 cards)

- Signature: Acolyte x3, Mend x3, Sergeant of the Pale x3, Candlelight x3, Smite x3, Warden x3, Chant of Rest x3, Praetor x3, Banish x3, Cleansing Light x3, Luminarch x3, Revelation x2, Seraph of Lament x2, Final Verdict x2, Martyr x2, Sanctum of Echoes x2, Exorcist x1, Truth Unveiled x1, Lightbringer x1, Lady of the Pale Choir x1, Mirror of Souls x1
- Neutrals: Village Militia, Stone Golem, Crack of Thunder, Scroll of Lore, Rite of Remembering, Sanctuary Light, Wall Sentinel, Ironclad Bear, Bulwark Knight, Execute, Titan of Ash, Relic of Restoration

**Vermin Swarm** (60 cards)

- Signature: Squeaker x3, Nibble x3, Scavenger x3, Pack Call x3, Mangy Brute x3, Swarmlord x3, Frenzy x3, Gnawer x3, Vermin Army x3, Warband x3, Pestilence x3, Alpha Rat x2, Breeder x2, Plaguemaster x2, The Tide of Teeth x2, Queen Moulder x2, Carrion Call x1, The Horde x1, Rattus the God x1, Plague King x1, The Endless Swarm x1
- Neutrals: Village Militia, Wild Boar, Feral Hound, Vanguard Squire, War Drums, Scroll of Lore, Mana Bloom, Swiftblade, Banner of Courage, Frostbind, War Ogre, Shadow Lance

**Dragonflight** (60 cards)

- Signature: Dragon Whelp x3, Scaleglider x3, Wingmen x3, Wyrm Snout x3, Sky Hunter x3, Roost Guardian x3, Claw Sweep x3, Hatchling x3, Elderscale x3, Swoop x3, Drakeling x3, Matriarch x2, Seer x2, Flight of Dragons x2, Warden of Skies x2, Prince of Scales x2, Sky Council x1, Dragonstorm x1, Wyrm Tyrant x1, Worldeater x1, Celestial Skywing x1
- Neutrals: Stone Golem, Wall Sentinel, Crack of Thunder, Scroll of Lore, Rite of Remembering, Ironclad Bear, Bulwark Knight, Banner of Courage, Frostbind, War Ogre, Colossus, Titan of Ash

**Elder Roots** (60 cards)

- Signature: Sapling x3, Grow x3, Creeping Vine x3, Sprout x3, Bloom x3, Barkhide x3, Forager x3, Thornlash x3, Ancient's Wrath x3, Sylvan Grove x3, Ironwood x3, Regrowth x2, Worldtree Sapling x2, Verdant Bloom x2, Elder Treant x2, Nature's Bounty x2, Goliath x1, Awakening x1, Titan of the Deep Roots x1, Worldmother x1, Heart of the Forest x1
- Neutrals: Village Militia, Stone Golem, Crack of Thunder, Scroll of Lore, Rite of Remembering, Sanctuary Light, Wall Sentinel, Ironclad Bear, Bulwark Knight, Execute, Colossus, Idol of Growth

**Shadow Dancers** (60 cards)

- Signature: Dagger Throw x3, Shadow Step x3, Twirl x3, Acrobat x3, Slash x3, Dervish x3, Vanish x3, Echo x3, Spinning Blade x3, Bladeweaver x3, Veil Dance x3, Flurry x2, Trickster x2, Grand Finale x2, Mirage x2, Illusionist x2, Puppet Master x1, The Ultimate Trick x1, Shadow Dancer x1, Nyx, the Last Dance x1, Infinite Shadows x1
- Neutrals: Wild Boar, Feral Hound, Swiftblade, Scroll of Lore, Rite of Remembering, Crack of Thunder, War Drums, Shadow Lance, Banner of Courage, Frostbind, War Ogre, Soul Mirror

**Bone Horde** (60 cards)

- Signature: Clatter x3, Scrapper x3, Gnaw x3, Marauder x3, Gravedigger x3, Cairn x3, Bone Frenzy x3, Raider x3, Rattle x3, Skull Wall x3, Howl x3, Necromancer x2, Legion Call x2, Bone Horde x2, Warlord x2, Behemoth x2, Whisperer x1, Cataclysm x1, Overlord x1, The Bone King x1, Risen Army x1
- Neutrals: Village Militia, Wild Boar, Feral Hound, Vanguard Squire, War Drums, Scroll of Lore, Mana Bloom, Swiftblade, Banner of Courage, War Ogre, Shadow Lance, Relic of Restoration

**Grave Pact** (60 cards)

- Signature: Bloodrite x3, Blood Thirst x3, Sacrifice x3, Blood Imp x3, Leech x3, Blood Bond x3, Masochist x3, Ravager x3, Life Leech x3, Cultist x3, Hemorrhage x3, Dark Pact x2, Torment x2, Fiend x2, Bargain x2, Dreadknight x2, Mirror of Blood x1, Ascension x1, Lord of the Pact x1, Morticia Gravefall x1, Immortal Bargain x1
- Neutrals: Wild Boar, Feral Hound, Scroll of Lore, Rite of Remembering, Crack of Thunder, Frostbind, Shadow Lance, Banner of Courage, Execute, Soul Mirror, War Ogre, Idol of Growth

**Night Coven** (60 cards)

- Signature: Whisper x3, Hex x3, Curse x3, Familiar x3, Wither x3, Bog Hag x3, Doom x3, Nightmare x3, Raven x3, Scarecrow x3, Drain x3, Decay x2, Eldritch Horror x2, Transfix x2, Mirror Hex x2, Veil of Night x2, Apathy x1, Morwenna's Glare x1, Abyssal Gaze x1, The Hex Queen x1, Eternal Night x1
- Neutrals: Village Militia, Stone Golem, Wall Sentinel, Crack of Thunder, Scroll of Lore, Rite of Remembering, Sanctuary Light, Ironclad Bear, Bulwark Knight, Execute, Colossus, Frostbind

**Starforged** (60 cards)

- Signature: Spark x3, Meteor Shard x3, Star Acolyte x3, Meditate x3, Star Focus x3, Guardian x3, Sentinel x3, Comet x3, Gravitate x3, Starmage x3, Starfall x3, Prophet x2, Oracle x2, Celestial Chorus x2, Star Giant x2, Eclipse x2, Wanderer x1, Chorus of the Void x1, Megastar x1, Archon Stellara x1, Living Constellation x1
- Neutrals: Village Militia, Stone Golem, Wall Sentinel, Crack of Thunder, Scroll of Lore, Rite of Remembering, Sanctuary Light, Ironclad Bear, Bulwark Knight, Execute, Idol of Growth, Colossus

**Eternal Vigil** (60 cards)

- Signature: Bless x3, Guard x3, Prayer x3, Squire x3, Lights x3, Paladin x3, Smite x3, Monk x3, Shieldbearer x3, Hymn of Dawn x3, Crusader x3, Divine Shield x2, Lay on Hands x2, Avenger x2, Warden of Dawn x2, Sanctify x2, Archon of Dawn x1, Radiance x1, Saint x1, Ser Aldric x1, The Eternal Vigil x1
- Neutrals: Village Militia, Stone Golem, Crack of Thunder, Scroll of Lore, Rite of Remembering, Sanctuary Light, Wall Sentinel, Ironclad Bear, Bulwark Knight, Relic of Restoration, Titan of Ash, Execute

**Stormwrought** (60 cards)

- Signature: Arc x3, Bolt x3, Adept x3, Storm Charge x3, Emberwitch x3, Squall x3, Storm Rider x3, Gust x3, Sorcerer x3, Downpour x3, Cyclone x3, Mistweaver x2, Echoes x2, Stormcaller x2, Leviathan x2, Eye of the Storm x2, Tempest x1, Siren x1, Thunderhead x1, Zephyra x1, Boreas, Eye of the Storm x1
- Neutrals: Wild Boar, Feral Hound, Swiftblade, Scroll of Lore, Rite of Remembering, Crack of Thunder, Frostbind, Shadow Lance, Banner of Courage, Execute, War Ogre, Soul Mirror

