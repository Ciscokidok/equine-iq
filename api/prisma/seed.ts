import { PrismaClient, Discipline } from '@prisma/client'

const prisma = new PrismaClient()

const stallions = [
  {
    name: 'Emerald van \'t Ruytershof',
    breed: 'Belgian Warmblood',
    discipline: Discipline.hunter_jumper,
    studFee: 3000,
    studLocation: 'Belgium',
    offspringCount: 180,
    offspringPerformanceSummary: 'Exceptional scope producer. Offspring competing at 1.40m–1.60m internationally. Known for careful, powerful jumping technique and good rideability.',
    pedigree: {
      sire: { name: 'Diamant de Semilly', breed: 'Selle Français' },
      dam: { name: 'Darling van \'t Ruytershof', breed: 'Belgian Warmblood' },
      sire_sire: { name: 'Le Tot de Semilly', breed: 'Selle Français' },
      sire_dam: { name: 'Aster', breed: 'Selle Français' },
      dam_sire: { name: 'Heartbreaker', breed: 'KWPN' },
      dam_dam: { name: 'Edeltrude', breed: 'Belgian Warmblood' },
    },
  },
  {
    name: 'Vitalis',
    breed: 'KWPN',
    discipline: Discipline.dressage,
    studFee: 4500,
    studLocation: 'Netherlands',
    offspringCount: 220,
    offspringPerformanceSummary: 'Top dressage sire. Offspring dominant in FEI young horse classes. Transmits expressive movement, strong hindquarter engagement, and an exceptional trot.',
    pedigree: {
      sire: { name: 'Voice', breed: 'KWPN' },
      dam: { name: 'Whistler', breed: 'KWPN' },
      sire_sire: { name: 'KWPN Vivaldi', breed: 'KWPN' },
      sire_dam: { name: 'Roxy', breed: 'KWPN' },
      dam_sire: { name: 'Krack C', breed: 'KWPN' },
      dam_dam: { name: 'Belinda', breed: 'KWPN' },
    },
  },
  {
    name: 'Hickstead',
    breed: 'Canadian Sport Horse',
    discipline: Discipline.hunter_jumper,
    studFee: null,
    studLocation: null,
    offspringCount: 42,
    offspringPerformanceSummary: 'Historical stallion (2000–2011). Legendary show jumper ridden by Eric Lamaze. Offspring carry exceptional scope and braveness. Used for pedigree depth testing.',
    pedigree: {
      sire: { name: 'Ontano van de Mispelaere', breed: 'Belgian Warmblood' },
      dam: { name: 'Dorina', breed: 'Holsteiner' },
      sire_sire: { name: 'Concorde', breed: 'KWPN' },
      dam_sire: { name: 'Calypso II', breed: 'Holsteiner' },
    },
  },
  {
    name: 'Totilas',
    breed: 'KWPN',
    discipline: Discipline.dressage,
    studFee: null,
    studLocation: 'Germany',
    offspringCount: 310,
    offspringPerformanceSummary: 'Historical record-breaking dressage stallion. First to score 90%+. Offspring show exceptional gaits but variable rideability. Heavy presence in modern KWPN pedigrees — monitor inbreeding when crossing with other Totilas descendants.',
    pedigree: {
      sire: { name: 'Gribaldi', breed: 'KWPN' },
      dam: { name: 'Lominka', breed: 'KWPN' },
      sire_sire: { name: 'Monarch', breed: 'KWPN' },
      sire_dam: { name: 'Ola', breed: 'KWPN' },
      dam_sire: { name: 'Michelangelo', breed: 'KWPN' },
      dam_dam: { name: 'Palminka', breed: 'KWPN' },
    },
  },
  {
    name: 'NRHA Gunner',
    breed: 'Quarter Horse',
    discipline: Discipline.reining,
    studFee: 2500,
    studLocation: 'Oklahoma, USA',
    offspringCount: 950,
    offspringPerformanceSummary: 'All-time leading reining sire. Offspring have earned over $34 million in NRHA competition. Known for transmitting natural stop, athleticism, and cow sense.',
    pedigree: {
      sire: { name: 'Colonels Smokin Gun', breed: 'Quarter Horse' },
      dam: { name: 'Playboys Lena', breed: 'Quarter Horse' },
      sire_sire: { name: 'Colonel Freckles', breed: 'Quarter Horse' },
      sire_dam: { name: 'Smokin Serena', breed: 'Quarter Horse' },
      dam_sire: { name: 'Dry Doc', breed: 'Quarter Horse' },
      dam_dam: { name: 'Playboys Miss Peppy', breed: 'Quarter Horse' },
    },
  },
  {
    name: 'Colonels Smokin Gun',
    breed: 'Quarter Horse',
    discipline: Discipline.reining,
    studFee: 1500,
    studLocation: 'Texas, USA',
    offspringCount: 420,
    offspringPerformanceSummary: 'NRHA Hall of Fame. Sire of NRHA Gunner. Offspring are consistent reining producers with excellent athleticism, trainability, and natural stop.',
    pedigree: {
      sire: { name: 'Colonel Freckles', breed: 'Quarter Horse' },
      dam: { name: 'Smokin Serena', breed: 'Quarter Horse' },
      sire_sire: { name: 'Jewel\'s Leo Bar', breed: 'Quarter Horse' },
      sire_dam: { name: 'Miss Freckles', breed: 'Quarter Horse' },
    },
  },
  // Warmblood / Sport Horse
  {
    name: 'Chacco-Blue',
    breed: 'Oldenburg',
    discipline: Discipline.hunter_jumper,
    studFee: 5000,
    studLocation: 'Germany',
    offspringCount: 280,
    offspringPerformanceSummary: 'One of the world\'s leading show jumping sires. Offspring compete at Grand Prix level globally. Transmits enormous scope, careful technique, and competitive mindset.',
    pedigree: {
      sire: { name: 'Chacco-Blue\'s sire', breed: 'Oldenburg' },
      dam: { name: 'Wendy', breed: 'Oldenburg' },
    },
  },
  {
    name: 'Franziskus',
    breed: 'Hanoverian',
    discipline: Discipline.dressage,
    studFee: 3800,
    studLocation: 'Germany',
    offspringCount: 190,
    offspringPerformanceSummary: 'Elite Hanoverian dressage sire. Offspring show excellent collection ability, expressive gaits, and willing temperament. Strong in FEI young horse classes.',
    pedigree: {
      sire: { name: 'Fidertanz', breed: 'Oldenburg' },
      dam: { name: 'Wencke', breed: 'Hanoverian' },
      sire_sire: { name: 'Fidermark', breed: 'Hanoverian' },
    },
  },
  {
    name: 'Glamourdale',
    breed: 'KWPN',
    discipline: Discipline.dressage,
    studFee: 5500,
    studLocation: 'Netherlands',
    offspringCount: 140,
    offspringPerformanceSummary: '2022 World Dressage Champion. Offspring show exceptional talent for piaffe/passage. Newer sire with rapidly growing book of mares.',
    pedigree: {
      sire: { name: 'Lord Leatherdale', breed: 'KWPN' },
      dam: { name: 'Fleur de Lis', breed: 'KWPN' },
      sire_sire: { name: 'Totilas', breed: 'KWPN' },
    },
  },
  {
    name: 'Eldorado van de Zeshoek',
    breed: 'Belgian Warmblood',
    discipline: Discipline.hunter_jumper,
    studFee: 3200,
    studLocation: 'Belgium',
    offspringCount: 210,
    offspringPerformanceSummary: 'Top BWP jumper sire. Offspring excel at 1.30m–1.50m. Known for producing careful, scopey horses with excellent front leg technique.',
    pedigree: {
      sire: { name: 'Toulon', breed: 'Hanoverian' },
      dam: { name: 'Odaline', breed: 'Belgian Warmblood' },
      sire_sire: { name: 'Argentinus', breed: 'Hanoverian' },
    },
  },
  {
    name: 'For Pleasure',
    breed: 'Hanoverian',
    discipline: Discipline.hunter_jumper,
    studFee: 2800,
    studLocation: 'Germany',
    offspringCount: 340,
    offspringPerformanceSummary: 'Olympic team gold medalist under Ludger Beerbaum. Prolific jumping sire. Offspring known for great scope, reliable temperament, and longevity.',
    pedigree: {
      sire: { name: 'Furioso II', breed: 'Hanoverian' },
      dam: { name: 'Freundin', breed: 'Hanoverian' },
    },
  },
  {
    name: 'Taloubet Z',
    breed: 'Zangersheide',
    discipline: Discipline.hunter_jumper,
    studFee: 4000,
    studLocation: 'Belgium',
    offspringCount: 160,
    offspringPerformanceSummary: 'World Cup winner ridden by Rodrigo Pessoa. Offspring strong at 1.45m+. Transmits natural ability and braveness.',
    pedigree: {
      sire: { name: 'Taloubet', breed: 'Selle Français' },
      dam: { name: 'Galoubet A', breed: 'Selle Français' },
    },
  },
  // Quarter Horse / Western
  {
    name: 'Docs Keepin Time',
    breed: 'Quarter Horse',
    discipline: Discipline.reining,
    studFee: 1800,
    studLocation: 'Nevada, USA',
    offspringCount: 380,
    offspringPerformanceSummary: 'NRHA multiple Futurity finalist sire. Offspring excel in reining and cow horse. Consistent producer of horses with natural stop and athleticism.',
    pedigree: {
      sire: { name: 'Hollywood Dun It', breed: 'Quarter Horse' },
      dam: { name: 'Miss Doc Bar', breed: 'Quarter Horse' },
    },
  },
  {
    name: 'Wimpys Little Step',
    breed: 'Quarter Horse',
    discipline: Discipline.reining,
    studFee: 2200,
    studLocation: 'Oklahoma, USA',
    offspringCount: 510,
    offspringPerformanceSummary: 'NRHA Hall of Fame. 3x World Champion offspring. Prolific sire of reining champions. Known for transmitting extreme athleticism and trainability.',
    pedigree: {
      sire: { name: 'Zippo Pine Bar', breed: 'Quarter Horse' },
      dam: { name: 'Little Wimpette', breed: 'Quarter Horse' },
    },
  },
  {
    name: 'Smart Chic Olena',
    breed: 'Quarter Horse',
    discipline: Discipline.cutting,
    studFee: 2000,
    studLocation: 'Texas, USA',
    offspringCount: 620,
    offspringPerformanceSummary: 'NRCHA Triple Crown Champion. Leading cutting and cow horse sire. Offspring dominate NCHA Futurity and Derby. Strong cow sense in offspring.',
    pedigree: {
      sire: { name: 'Smart Little Lena', breed: 'Quarter Horse' },
      dam: { name: 'Sugarplum Olena', breed: 'Quarter Horse' },
      sire_sire: { name: 'Doc O\'Lena', breed: 'Quarter Horse' },
    },
  },
  {
    name: 'Dual Rey',
    breed: 'Quarter Horse',
    discipline: Discipline.cutting,
    studFee: 2500,
    studLocation: 'Texas, USA',
    offspringCount: 480,
    offspringPerformanceSummary: 'NCHA Triple Crown Champion. #1 All-Time Leading Cutting Sire. Offspring have earned over $50 million. Exceptional producer of horse with cow sense.',
    pedigree: {
      sire: { name: 'Dual Pep', breed: 'Quarter Horse' },
      dam: { name: 'Nurse Rey', breed: 'Quarter Horse' },
      sire_sire: { name: 'Peppy San Badger', breed: 'Quarter Horse' },
    },
  },
  // Paint
  {
    name: 'Zippos Mr Good Bar',
    breed: 'Paint',
    discipline: Discipline.paint,
    studFee: 1200,
    studLocation: 'Tennessee, USA',
    offspringCount: 290,
    offspringPerformanceSummary: 'Leading APHA sire. World Champion offspring in multiple disciplines. Known for excellent conformation, kind temperament, and striking color.',
    pedigree: {
      sire: { name: 'Zippo Pine Bar', breed: 'Quarter Horse' },
      dam: { name: 'Miss Good Bar', breed: 'Paint' },
    },
  },
  {
    name: 'Certain Dream',
    breed: 'Paint',
    discipline: Discipline.paint,
    studFee: 1500,
    studLocation: 'Colorado, USA',
    offspringCount: 190,
    offspringPerformanceSummary: 'APHA World Champion halter sire. Offspring excel in halter, hunter under saddle, and western pleasure. Exceptional muscling and bone.',
    pedigree: {
      sire: { name: 'Sire of Certain Dream', breed: 'Quarter Horse' },
      dam: { name: 'Dam of Certain Dream', breed: 'Paint' },
    },
  },
  // Eventing
  {
    name: 'Lux Z',
    breed: 'Zangersheide',
    discipline: Discipline.eventing,
    studFee: 2800,
    studLocation: 'USA',
    offspringCount: 95,
    offspringPerformanceSummary: 'CCI4*-L competitor. Offspring showing promise across eventing disciplines. Transmits scope, braveness across country, and good rideability.',
    pedigree: {
      sire: { name: 'Lux', breed: 'Zangersheide' },
      dam: { name: 'Dam of Lux Z', breed: 'Zangersheide' },
    },
  },
  {
    name: 'Windfall',
    breed: 'Holsteiner',
    discipline: Discipline.eventing,
    studFee: 2200,
    studLocation: 'Kentucky, USA',
    offspringCount: 130,
    offspringPerformanceSummary: 'US Olympic team eventer. Offspring competing at Advanced and CCI4* level. Known for cross-country braveness and boldness.',
    pedigree: {
      sire: { name: 'Wolkentanz II', breed: 'Holsteiner' },
      dam: { name: 'Wannabe', breed: 'Holsteiner' },
    },
  },
]

async function main() {
  console.log('Seeding stallion catalog...')

  for (const s of stallions) {
    await prisma.horse.upsert({
      where: { id: s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-seed' },
      update: {},
      create: {
        id: s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-seed',
        name: s.name,
        sex: 'stallion',
        breed: s.breed,
        discipline: s.discipline,
        studFee: s.studFee ?? null,
        studLocation: s.studLocation ?? null,
        offspringCount: s.offspringCount,
        offspringPerformanceSummary: s.offspringPerformanceSummary,
        pedigree: s.pedigree,
        createdByUser: null,
      },
    })
  }

  console.log(`Seeded ${stallions.length} stallions.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
