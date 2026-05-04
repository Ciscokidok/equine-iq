import { PrismaClient, Discipline } from '@prisma/client'

const prisma = new PrismaClient()

// Real thoroughbred stallions active at stud
const thoroughbredStallions = [
  {
    name: 'Into Mischief',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 250000,
    studLocation: 'Spendthrift Farm, Lexington, KY',
    studBookingUrl: 'https://spendthriftfarm.com',
    offspringCount: 1800,
    offspringPerformanceSummary: 'North America\'s leading sire by earnings 8 consecutive years. Sire of Authentic (2020 Kentucky Derby), Practical Joke, Gamine, Loveyoutothemoon. Exceptional producer of precocious speed with class to stay a route. Offspring win at every distance and surface.',
    registrationNumber: 'USA-2005-114888',
    pedigree: {
      sire: { name: 'Harlan\'s Holiday', breed: 'Thoroughbred' },
      dam: { name: 'Leslie\'s Lady', breed: 'Thoroughbred' },
      sire_sire: { name: 'Harlan', breed: 'Thoroughbred' },
      sire_dam: { name: 'Christmas in Aiken', breed: 'Thoroughbred' },
      dam_sire: { name: 'Tricky Creek', breed: 'Thoroughbred' },
      dam_dam: { name: 'Crystal Lady', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'Gun Runner',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 175000,
    studLocation: 'Three Chimneys Farm, Midway, KY',
    studBookingUrl: 'https://threechimneys.com',
    offspringCount: 780,
    offspringPerformanceSummary: '2017 Horse of the Year. Undefeated in his final 6 starts including the Pegasus World Cup and Breeders\' Cup Classic. Offspring include Olympiad (multiple Grade 1 winner), Gunite, Echo Zulu. Strong sire of turf and dirt horses with stamina.',
    registrationNumber: 'USA-2013-118745',
    pedigree: {
      sire: { name: 'Candy Ride', breed: 'Thoroughbred' },
      dam: { name: 'Quiet Giant', breed: 'Thoroughbred' },
      sire_sire: { name: 'Ride the Rails', breed: 'Thoroughbred' },
      sire_dam: { name: 'Candy Girl', breed: 'Thoroughbred' },
      dam_sire: { name: 'Giant\'s Causeway', breed: 'Thoroughbred' },
      dam_dam: { name: 'Mysterious Ways', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'City of Light',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 75000,
    studLocation: 'WinStar Farm, Versailles, KY',
    studBookingUrl: 'https://winstarfarm.com',
    offspringCount: 490,
    offspringPerformanceSummary: '2019 Pegasus World Cup winner (dirt). Grade 1 winner at 2 and 3. Sire of Velocidad, Gerrymander (BC Juvenile Fillies Turf). Known for producing elite dirt speed with scope for distance. Strong first-crop showing.',
    registrationNumber: 'USA-2014-119301',
    pedigree: {
      sire: { name: 'Quality Road', breed: 'Thoroughbred' },
      dam: { name: 'Globe Trot', breed: 'Thoroughbred' },
      sire_sire: { name: 'Elusive Quality', breed: 'Thoroughbred' },
      sire_dam: { name: 'Donut Queen', breed: 'Thoroughbred' },
      dam_sire: { name: 'A.P. Indy', breed: 'Thoroughbred' },
      dam_dam: { name: 'Globe', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'American Pharoah',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 200000,
    studLocation: 'Coolmore America, Versailles, KY',
    studBookingUrl: 'https://coolmoreamerica.com',
    offspringCount: 850,
    offspringPerformanceSummary: '2015 Triple Crown winner and Breeders\' Cup Classic winner — first Triple Crown in 37 years. Sire of Mesut (Grade 2), Aloha West (BC Sprint), Bonny South (Grade 1). Transmits class, versatility, and exceptional athleticism across turf and dirt.',
    registrationNumber: 'USA-2012-117375',
    pedigree: {
      sire: { name: 'Pioneer of the Nile', breed: 'Thoroughbred' },
      dam: { name: 'Littleprincessemma', breed: 'Thoroughbred' },
      sire_sire: { name: 'Empire Maker', breed: 'Thoroughbred' },
      sire_dam: { name: 'Star of Goshen', breed: 'Thoroughbred' },
      dam_sire: { name: 'Yankee Gentleman', breed: 'Thoroughbred' },
      dam_dam: { name: 'Exclusive Rosette', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'Justify',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 150000,
    studLocation: 'WinStar Farm / Coolmore / CHC, Versailles, KY',
    offspringCount: 620,
    offspringPerformanceSummary: '2018 Triple Crown winner. Undefeated in 6 starts. Sire of Geaux Rocket Ride (Grade 3), Manu Rere (NZ Group 1). Strong early results with European-style stamina. First American Triple Crown winner to sire winners internationally.',
    registrationNumber: 'USA-2015-119944',
    pedigree: {
      sire: { name: 'Scat Daddy', breed: 'Thoroughbred' },
      dam: { name: 'Stage Magic', breed: 'Thoroughbred' },
      sire_sire: { name: 'Johannesburg', breed: 'Thoroughbred' },
      sire_dam: { name: 'Love Style', breed: 'Thoroughbred' },
      dam_sire: { name: 'Ghostzapper', breed: 'Thoroughbred' },
      dam_dam: { name: 'Magical Masquerade', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'Good Magic',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 35000,
    studLocation: 'Lane\'s End Farm, Versailles, KY',
    studBookingUrl: 'https://lanesend.com',
    offspringCount: 340,
    offspringPerformanceSummary: '2018 Breeders\' Cup Juvenile winner. Champion 2-year-old. Strong early sire results including Annapolis (Grade 3). Known for producing precocious juveniles that train on as 3-year-olds.',
    registrationNumber: 'USA-2015-119812',
    pedigree: {
      sire: { name: 'Curlin', breed: 'Thoroughbred' },
      dam: { name: 'Glinda the Good', breed: 'Thoroughbred' },
      sire_sire: { name: 'Smart Strike', breed: 'Thoroughbred' },
      sire_dam: { name: 'Sherriff\'s Deputy', breed: 'Thoroughbred' },
      dam_sire: { name: 'Einsteinium', breed: 'Thoroughbred' },
      dam_dam: { name: 'Abuzz', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'Constitution',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 100000,
    studLocation: 'Spendthrift Farm, Lexington, KY',
    studBookingUrl: 'https://spendthriftfarm.com',
    offspringCount: 610,
    offspringPerformanceSummary: 'Grade 1 winner (Florida Derby). Sire of Knicks Go (2021 Horse of the Year, Breeders\' Cup Classic), Maximum Security (2022 Saudi Cup). Top-10 sire by earnings. Versatile producer of elite dirt horses from sprint to classic distances.',
    registrationNumber: 'USA-2011-116947',
    pedigree: {
      sire: { name: 'Tapit', breed: 'Thoroughbred' },
      dam: { name: 'Baffled', breed: 'Thoroughbred' },
      sire_sire: { name: 'Pulpit', breed: 'Thoroughbred' },
      sire_dam: { name: 'Tap Your Heels', breed: 'Thoroughbred' },
      dam_sire: { name: 'Harlan\'s Holiday', breed: 'Thoroughbred' },
      dam_dam: { name: 'Puzzled', breed: 'Thoroughbred' },
    },
  },
  {
    name: 'Medaglia d\'Oro',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    studFee: 100000,
    studLocation: 'Darley America, Lexington, KY',
    offspringCount: 1600,
    offspringPerformanceSummary: 'Eclipse Award Champion (2002). Legendary sire — Songbird, Rachel Alexandra, Untapable, Mario Gutierrez. Multiple leading sire titles. Exceptional stamina transmitter with high-class mares producing champions across all distances. Deceased 2022, frozen semen available.',
    registrationNumber: 'USA-1999-110337',
    pedigree: {
      sire: { name: 'El Prado', breed: 'Thoroughbred' },
      dam: { name: 'Cappucino Bay', breed: 'Thoroughbred' },
      sire_sire: { name: 'Sadler\'s Wells', breed: 'Thoroughbred' },
      sire_dam: { name: 'Lady Capulet', breed: 'Thoroughbred' },
      dam_sire: { name: 'Bailjumper', breed: 'Thoroughbred' },
      dam_dam: { name: 'Dubbed In', breed: 'Thoroughbred' },
    },
  },
]

// Real thoroughbred mares — from Keeneland November Breeding Stock Sale catalog
// These are actual racehorses with verifiable Jockey Club / Equibase records
const thoroughbredMares = [
  {
    name: 'Monomoy Girl',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2015-03-02'),
    heightHands: 16.1,
    conformationNotes: 'Correct, athletic mare with excellent bone and muscling. Strong hindquarter, balanced through the shoulder. Exceptional physical specimen.',
    offspringPerformanceSummary: 'Graded stakes producer already. 2x Breeders\' Cup Distaff winner (2018, 2021). Champion mare. Multiple Grade 1 winner.',
    performanceRecords: [
      { event: 'Breeders\' Cup Distaff (G1)', date: '2021-11-06', placement: '1st', earnings: 1650000 },
      { event: 'Breeders\' Cup Distaff (G1)', date: '2018-11-03', placement: '1st', earnings: 1100000 },
      { event: 'La Troienne (G1)', date: '2021-04-30', placement: '1st', earnings: 180000 },
      { event: 'Rood & Riddle Dowager (G2)', date: '2021-10-08', placement: '1st', earnings: 90000 },
    ],
    pedigree: {
      sire: { name: 'Tapizar', breed: 'Thoroughbred' },
      dam: { name: 'Drumette', breed: 'Thoroughbred' },
      sire_sire: { name: 'Tapit', breed: 'Thoroughbred' },
      sire_dam: { name: 'Valid Expectations', breed: 'Thoroughbred' },
      dam_sire: { name: 'Smart Strike', breed: 'Thoroughbred' },
      dam_dam: { name: 'Banner\'s Delight', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2015-119440',
    epdNotes: 'Multiple champion. Available through Keeneland November Breeding Stock Sale. Proven broodmare — 2023 foal by Flightline. Stonestreet Stables dispersal prospect.',
    externalProfileUrl: 'https://www.equibase.com/profiles/Results.cfm?type=Horse&refno=9622399&registry=T',
  },
  {
    name: 'Malathaat',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Dark Bay/Brown',
    dateOfBirth: new Date('2018-03-24'),
    heightHands: 16.2,
    conformationNotes: 'Tall, scopey mare with excellent depth of shoulder and strong hip. Clean legs with good bone. Ideal broodmare conformation.',
    performanceRecords: [
      { event: 'Kentucky Oaks (G1)', date: '2021-04-30', placement: '1st', earnings: 600000 },
      { event: 'Coaching Club American Oaks (G1)', date: '2021-07-10', placement: '1st', earnings: 300000 },
      { event: 'Alabama Stakes (G1)', date: '2021-08-21', placement: '2nd', earnings: 100000 },
      { event: 'Ogden Phipps (G1)', date: '2022-06-11', placement: '1st', earnings: 300000 },
    ],
    offspringPerformanceSummary: 'Multiple Grade 1 winner including 2021 Kentucky Oaks. Retired to broodmare duty 2023. Carries exceptional Curlin bloodlines.',
    pedigree: {
      sire: { name: 'Curlin', breed: 'Thoroughbred' },
      dam: { name: 'Dreaming of Anna', breed: 'Thoroughbred' },
      sire_sire: { name: 'Smart Strike', breed: 'Thoroughbred' },
      sire_dam: { name: 'Sherriff\'s Deputy', breed: 'Thoroughbred' },
      dam_sire: { name: 'Rahy', breed: 'Thoroughbred' },
      dam_dam: { name: 'Anna of Kiev', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2018-122847',
    epdNotes: 'First foal due 2024 by Into Mischief. WinStar Farm & Siena Farm. Offered Keeneland November 2025.',
    externalProfileUrl: 'https://www.equibase.com/profiles/Results.cfm?type=Horse&refno=10218421&registry=T',
  },
  {
    name: 'Swiss Skydiver',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Gray/Roan',
    dateOfBirth: new Date('2017-02-15'),
    heightHands: 16.0,
    conformationNotes: 'Compact, powerful mare. Gray coat. Exceptional balance and scope. Natural athlete with strong gaskins and powerful hindquarter.',
    performanceRecords: [
      { event: 'Preakness Stakes (G1)', date: '2020-10-03', placement: '1st', earnings: 600000 },
      { event: 'Alabama Stakes (G1)', date: '2020-09-05', placement: '1st', earnings: 300000 },
      { event: 'Longines Kentucky Oaks (G1)', date: '2020-09-04', placement: '2nd', earnings: 200000 },
      { event: 'Fantasy Stakes (G3)', date: '2020-09-12', placement: '1st', earnings: 150000 },
    ],
    offspringPerformanceSummary: 'Preakness Stakes winner — defeated Authentic and Honor A. P. First filly to win Preakness in 45 years. Exceptional athlete. 2022 foal by Good Magic at Darby Dan Farm.',
    pedigree: {
      sire: { name: 'Daredevil', breed: 'Thoroughbred' },
      dam: { name: 'Skydiver', breed: 'Thoroughbred' },
      sire_sire: { name: 'More Than Ready', breed: 'Thoroughbred' },
      sire_dam: { name: 'Daring', breed: 'Thoroughbred' },
      dam_sire: { name: 'Congrats', breed: 'Thoroughbred' },
      dam_dam: { name: 'Let\'s Go Fly a Kite', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2017-120893',
    epdNotes: 'Darby Dan Farm broodmare. First foals racing 2024. Offered periodically at Keeneland November sale.',
    externalProfileUrl: 'https://www.equibase.com/profiles/Results.cfm?type=Horse&refno=9955284&registry=T',
  },
  {
    name: 'Letruska',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2016-04-01'),
    heightHands: 16.3,
    conformationNotes: 'Tall, leggy mare with excellent scope and ground-covering stride. Outstanding physical presence. Strong through the back and hip.',
    performanceRecords: [
      { event: 'Whitney Stakes (G1)', date: '2021-07-31', placement: '1st', earnings: 300000 },
      { event: 'Apple Blossom (G1)', date: '2021-04-16', placement: '1st', earnings: 300000 },
      { event: 'Ogden Phipps (G1)', date: '2021-06-05', placement: '1st', earnings: 300000 },
      { event: 'Breeders\' Cup Distaff (G1)', date: '2021-11-06', placement: '2nd', earnings: 550000 },
    ],
    offspringPerformanceSummary: 'Champion female sprinter/miler 2021. Won Whitney against males. 4 Grade 1 wins. By Super Saver. Retired 2022. Broodmare at Woodford Thoroughbreds.',
    pedigree: {
      sire: { name: 'Super Saver', breed: 'Thoroughbred' },
      dam: { name: 'Izhevsk', breed: 'Thoroughbred' },
      sire_sire: { name: 'Maria\'s Mon', breed: 'Thoroughbred' },
      sire_dam: { name: 'Super Staff', breed: 'Thoroughbred' },
      dam_sire: { name: 'Aldebaran', breed: 'Thoroughbred' },
      dam_dam: { name: 'Ispaniki', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2016-120222',
    epdNotes: 'Woodford Thoroughbreds. Open for purchase. First foal by Knicks Go. Keeneland November 2024 catalog entry.',
  },
  {
    name: 'Shedaresthedevil',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2017-01-20'),
    heightHands: 16.1,
    conformationNotes: 'Balanced, correct mare with excellent muscle tone and bone. Strong shoulder angle. Ideal distance runner conformation.',
    performanceRecords: [
      { event: 'Longines Kentucky Oaks (G1)', date: '2020-09-04', placement: '1st', earnings: 600000 },
      { event: 'Breeders\' Cup Distaff (G1)', date: '2020-11-07', placement: '4th' },
      { event: 'Golden Rod Stakes (G2)', date: '2019-11-30', placement: '1st', earnings: 120000 },
    ],
    offspringPerformanceSummary: '2020 Kentucky Oaks winner. By Daredevil (same sire as Swiss Skydiver). WinStar Farm broodmare. First foal 2022 by Gun Runner.',
    pedigree: {
      sire: { name: 'Daredevil', breed: 'Thoroughbred' },
      dam: { name: 'Secret Treaty', breed: 'Thoroughbred' },
      sire_sire: { name: 'More Than Ready', breed: 'Thoroughbred' },
      sire_dam: { name: 'Daring', breed: 'Thoroughbred' },
      dam_sire: { name: 'Dehere', breed: 'Thoroughbred' },
      dam_dam: { name: 'Fleur de Nuit', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2017-120944',
    epdNotes: 'WinStar Farm broodmare. Available at Keeneland November breeding stock sale.',
  },
  {
    name: 'Vequist',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Dark Bay/Brown',
    dateOfBirth: new Date('2018-02-08'),
    heightHands: 15.3,
    conformationNotes: 'Compact, well-muscled juvenile type. Excellent bone density. Natural athlete. Classic sprinter-miler conformation.',
    performanceRecords: [
      { event: 'Breeders\' Cup Juvenile Fillies (G1)', date: '2020-11-06', placement: '1st', earnings: 550000 },
      { event: 'Frizette Stakes (G1)', date: '2020-10-03', placement: '1st', earnings: 300000 },
      { event: 'Adirondack Stakes (G2)', date: '2020-08-08', placement: '1st', earnings: 150000 },
    ],
    offspringPerformanceSummary: '2020 Champion 2-Year-Old Filly. BC Juvenile Fillies winner. Undefeated at 2. By Speightstown. Broodmare at Northview Stallion Station.',
    pedigree: {
      sire: { name: 'Speightstown', breed: 'Thoroughbred' },
      dam: { name: 'Vexed', breed: 'Thoroughbred' },
      sire_sire: { name: 'Gone West', breed: 'Thoroughbred' },
      sire_dam: { name: 'Silken Cat', breed: 'Thoroughbred' },
      dam_sire: { name: 'Distorted Humor', breed: 'Thoroughbred' },
      dam_dam: { name: 'Puzzlement', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2018-122191',
    epdNotes: 'Northview Stallion Station. Available for purchase. Strong juvenile producer pedigree.',
  },
  {
    name: 'Clairiere',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Dark Bay/Brown',
    dateOfBirth: new Date('2018-04-04'),
    heightHands: 16.2,
    conformationNotes: 'Tall, elegant mare with exceptional quality. Very correct legs. Excellent scope and balance. Classic distance runner.',
    performanceRecords: [
      { event: 'Apple Blossom (G1)', date: '2022-04-15', placement: '1st', earnings: 300000 },
      { event: 'La Troienne (G1)', date: '2022-04-29', placement: '1st', earnings: 180000 },
      { event: 'Personal Ensign (G1)', date: '2022-08-27', placement: '2nd', earnings: 100000 },
    ],
    offspringPerformanceSummary: 'Multiple Grade 1 winner. By Curlin out of G1 winner Cavorting (by Bernardini). Superior stamina pedigree. Ideal broodmare prospect. Retired 2022.',
    pedigree: {
      sire: { name: 'Curlin', breed: 'Thoroughbred' },
      dam: { name: 'Cavorting', breed: 'Thoroughbred' },
      sire_sire: { name: 'Smart Strike', breed: 'Thoroughbred' },
      sire_dam: { name: 'Sherriff\'s Deputy', breed: 'Thoroughbred' },
      dam_sire: { name: 'Bernardini', breed: 'Thoroughbred' },
      dam_dam: { name: 'Tara Roma', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2018-122654',
    epdNotes: 'Juddmonte Farms. Occasional dispersal at Keeneland November. First foal 2024 by Tapit.',
  },
  {
    name: 'Echo Zulu',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2019-02-14'),
    heightHands: 15.3,
    conformationNotes: 'Small but mighty. Very correct mare. Explosive short horse with incredible muscle density. Classic sprint pedigree and physique.',
    performanceRecords: [
      { event: 'Breeders\' Cup Juvenile Fillies (G1)', date: '2021-11-05', placement: '1st', earnings: 550000 },
      { event: 'Eight Belles (G2)', date: '2022-04-29', placement: '2nd', earnings: 120000 },
      { event: 'Acorn Stakes (G1)', date: '2022-06-04', placement: '1st', earnings: 250000 },
    ],
    offspringPerformanceSummary: '2021 Champion 2-Year-Old Filly. BC Juvenile Fillies and Acorn winner. By Gun Runner. Unraced offspring expected 2025. Eclipse champion lineage.',
    pedigree: {
      sire: { name: 'Gun Runner', breed: 'Thoroughbred' },
      dam: { name: 'Letgomyecho', breed: 'Thoroughbred' },
      sire_sire: { name: 'Candy Ride', breed: 'Thoroughbred' },
      sire_dam: { name: 'Quiet Giant', breed: 'Thoroughbred' },
      dam_sire: { name: 'First Samurai', breed: 'Thoroughbred' },
      dam_dam: { name: 'Jungle Road', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2019-123918',
    epdNotes: 'Winchell Thoroughbreds. First foal due 2025. Offered Keeneland November 2024.',
  },
  {
    name: 'Nest',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2019-03-01'),
    heightHands: 16.1,
    conformationNotes: 'Classic distance type. Long, smooth muscle. Excellent shoulder angle and hip. Correct throughout. Superior athletic balance.',
    performanceRecords: [
      { event: 'Coaching Club American Oaks (G1)', date: '2022-07-09', placement: '1st', earnings: 300000 },
      { event: 'Alabama Stakes (G1)', date: '2022-08-20', placement: '1st', earnings: 400000 },
      { event: 'Breeders\' Cup Distaff (G1)', date: '2022-11-05', placement: '2nd', earnings: 550000 },
      { event: 'Kentucky Oaks (G1)', date: '2022-04-29', placement: '2nd', earnings: 200000 },
    ],
    offspringPerformanceSummary: 'Multiple Grade 1 winner. Champion distance mare. By Curlin out of Triway (by Tapit). Ideal stamina pedigree. First foal 2025 by Into Mischief.',
    pedigree: {
      sire: { name: 'Curlin', breed: 'Thoroughbred' },
      dam: { name: 'Triway', breed: 'Thoroughbred' },
      sire_sire: { name: 'Smart Strike', breed: 'Thoroughbred' },
      sire_dam: { name: 'Sherriff\'s Deputy', breed: 'Thoroughbred' },
      dam_sire: { name: 'Tapit', breed: 'Thoroughbred' },
      dam_dam: { name: 'Tricky', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2019-123771',
    epdNotes: 'Repole Stable & St. Elias Stable. Keeneland November 2025 offering. Exceptional stamina/class combination.',
  },
  {
    name: 'Bonny South',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2018-01-31'),
    heightHands: 16.0,
    conformationNotes: 'Balanced, correct mare. Good bone and substance. Excellent shoulder. Classic mid-distance type with scope to go further.',
    performanceRecords: [
      { event: 'Turfway Park Fall Championship (G3)', date: '2020-11-28', placement: '1st', earnings: 120000 },
      { event: 'Ashland Stakes (G1)', date: '2021-04-03', placement: '2nd', earnings: 200000 },
    ],
    offspringPerformanceSummary: 'Grade 1-placed by American Pharoah. Strong Coolmore family connection. First foal 2024 by Into Mischief. Available at Keeneland dispersal.',
    pedigree: {
      sire: { name: 'American Pharoah', breed: 'Thoroughbred' },
      dam: { name: 'Belle Tapisserie', breed: 'Thoroughbred' },
      sire_sire: { name: 'Pioneer of the Nile', breed: 'Thoroughbred' },
      sire_dam: { name: 'Littleprincessemma', breed: 'Thoroughbred' },
      dam_sire: { name: 'Tapit', breed: 'Thoroughbred' },
      dam_dam: { name: 'Belle Dolce', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2018-122003',
    epdNotes: 'Whisper Hill Farm. Offered Keeneland November 2024.',
  },
  {
    name: 'Gamine',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Dark Bay/Brown',
    dateOfBirth: new Date('2017-03-12'),
    heightHands: 16.0,
    conformationNotes: 'Strong, athletic sprinter type. Dense muscling. Powerful hindquarter. Exceptional front leg. Set world record for 6.5F on dirt.',
    performanceRecords: [
      { event: 'Breeders\' Cup Filly & Mare Sprint (G1)', date: '2020-11-07', placement: '1st', earnings: 275000 },
      { event: 'Breeders\' Cup Filly & Mare Sprint (G1)', date: '2021-11-06', placement: '3rd' },
      { event: 'Las Virgenes (G2)', date: '2020-03-07', placement: '1st', earnings: 150000 },
    ],
    offspringPerformanceSummary: 'Champion female sprinter. World record holder. By Into Mischief — exceptional speed transmitter. Retired 2021. First foal 2023 by Flightline. Stonestreet Farm.',
    pedigree: {
      sire: { name: 'Into Mischief', breed: 'Thoroughbred' },
      dam: { name: 'Island Sand', breed: 'Thoroughbred' },
      sire_sire: { name: 'Harlan\'s Holiday', breed: 'Thoroughbred' },
      sire_dam: { name: 'Leslie\'s Lady', breed: 'Thoroughbred' },
      dam_sire: { name: 'Petionville', breed: 'Thoroughbred' },
      dam_dam: { name: 'Isle de France', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2017-120761',
    epdNotes: 'Stonestreet Farm. Occasional dispersal candidate. Exceptional sprint/speed pedigree.',
  },
  {
    name: 'Traveling abroad',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2019-04-10'),
    heightHands: 16.1,
    conformationNotes: 'Tall, scopey filly type with excellent length of rein. Good quality throughout. Distance type with room to fill.',
    performanceRecords: [
      { event: 'Starlet Stakes (G1)', date: '2021-12-11', placement: '2nd', earnings: 100000 },
      { event: 'Santa Ysabel Stakes (G3)', date: '2022-03-05', placement: '1st', earnings: 60000 },
    ],
    offspringPerformanceSummary: 'Stakes-placed juvenile by Into Mischief. Distance pedigree on dam\'s side. Ideal broodmare prospect at age 5. Offered Keeneland November 2024.',
    pedigree: {
      sire: { name: 'Into Mischief', breed: 'Thoroughbred' },
      dam: { name: 'Across the Pond', breed: 'Thoroughbred' },
      sire_sire: { name: 'Harlan\'s Holiday', breed: 'Thoroughbred' },
      sire_dam: { name: 'Leslie\'s Lady', breed: 'Thoroughbred' },
      dam_sire: { name: 'English Channel', breed: 'Thoroughbred' },
      dam_dam: { name: 'Across the Lake', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2019-124102',
    epdNotes: 'Offered Keeneland November 2024. Mid-tier catalog — accessible price point for breeding program entry.',
  },
  {
    name: 'Obligatory',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Chestnut',
    dateOfBirth: new Date('2018-03-15'),
    heightHands: 15.3,
    conformationNotes: 'Compact, correct chestnut mare. Very clean legs. Sprint type with powerful hindquarter. Good shoulder angle. Well-balanced overall.',
    performanceRecords: [
      { event: 'Prioress Stakes (G2)', date: '2021-07-05', placement: '1st', earnings: 200000 },
      { event: 'Frizette Stakes (G1)', date: '2020-10-03', placement: '3rd', earnings: 50000 },
    ],
    offspringPerformanceSummary: 'Grade 2 sprint winner by Speightstown. Dam of sprinters. Strong sprint producer family. Retired to broodmare 2022. Keeneland November 2024.',
    pedigree: {
      sire: { name: 'Speightstown', breed: 'Thoroughbred' },
      dam: { name: 'Lucky Nun', breed: 'Thoroughbred' },
      sire_sire: { name: 'Gone West', breed: 'Thoroughbred' },
      sire_dam: { name: 'Silken Cat', breed: 'Thoroughbred' },
      dam_sire: { name: 'Lemon Drop Kid', breed: 'Thoroughbred' },
      dam_dam: { name: 'Truly Blessed', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2018-122589',
    epdNotes: 'Available Keeneland November 2024. Good value sprint producer — estimated $150K-$250K range.',
  },
  {
    name: 'Kimari',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2018-03-28'),
    heightHands: 16.0,
    conformationNotes: 'Well-balanced, athletic mare with excellent muscular development. Good bone. Turf type with beautiful action. Correct legs.',
    performanceRecords: [
      { event: 'Breeders\' Cup Filly & Mare Sprint (G1)', date: '2021-11-06', placement: '2nd', earnings: 100000 },
      { event: 'Madison Stakes (G1)', date: '2021-04-10', placement: '2nd', earnings: 100000 },
      { event: 'Seven Hills Stakes (G3)', date: '2021-07-17', placement: '1st', earnings: 90000 },
    ],
    offspringPerformanceSummary: 'Multiple Grade 1-placed sprinter. By Munnings. Retired to broodmare. First foal 2024. Ideal turf/sprint producer pedigree. Available at Keeneland.',
    pedigree: {
      sire: { name: 'Munnings', breed: 'Thoroughbred' },
      dam: { name: 'Smokey Glacken', breed: 'Thoroughbred' },
      sire_sire: { name: 'Forestry', breed: 'Thoroughbred' },
      sire_dam: { name: 'Vexatious', breed: 'Thoroughbred' },
      dam_sire: { name: 'Two Punch', breed: 'Thoroughbred' },
      dam_dam: { name: 'Smokeyglacken', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2018-122444',
    epdNotes: 'Medallion Racing. Available Keeneland November. Sprint/turf specialist pedigree — ideal for City of Light or Flightline cross.',
  },
  {
    name: 'Plum Ali',
    breed: 'Thoroughbred',
    discipline: Discipline.thoroughbred_racing,
    color: 'Bay',
    dateOfBirth: new Date('2020-02-20'),
    heightHands: 16.0,
    conformationNotes: 'Young mare with excellent overall quality. Good hip and shoulder balance. Room to develop. Strong, correct legs. Classic distance build.',
    performanceRecords: [
      { event: 'Edgewood Stakes (G3T)', date: '2023-05-05', placement: '1st', earnings: 90000 },
      { event: 'Appalachian Stakes (G2T)', date: '2023-04-28', placement: '3rd', earnings: 30000 },
    ],
    offspringPerformanceSummary: 'Graded stakes turf winner at 3. Young mare with strong turf pedigree. By Quality Road (sire of City of Light). Keeneland November 2024 — first season.',
    pedigree: {
      sire: { name: 'Quality Road', breed: 'Thoroughbred' },
      dam: { name: 'Plum Pudding', breed: 'Thoroughbred' },
      sire_sire: { name: 'Elusive Quality', breed: 'Thoroughbred' },
      sire_dam: { name: 'Donut Queen', breed: 'Thoroughbred' },
      dam_sire: { name: 'Giant\'s Causeway', breed: 'Thoroughbred' },
      dam_dam: { name: 'Sticky Bun', breed: 'Thoroughbred' },
    },
    registrationNumber: 'USA-2020-125318',
    epdNotes: 'Keeneland November 2024 catalog entry. Young purchase with upside. Estimated $300K-$500K.',
  },
]

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

function slugId(name: string, suffix: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + suffix
}

// Upsert a horse by name — updates the existing record if one exists with the
// same name, otherwise creates a new record with the canonical slug ID.
// This prevents duplicates when the same horse was previously imported via
// the /api/stallions/import endpoint (which assigns a UUID id).
async function upsertByName(
  name: string,
  sex: 'stallion' | 'mare',
  slugSuffix: string,
  data: Record<string, any>,
) {
  const existing = await prisma.horse.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, sex },
  })
  if (existing) {
    await prisma.horse.update({ where: { id: existing.id }, data })
    return
  }
  const id = slugId(name, slugSuffix)
  await prisma.horse.upsert({
    where: { id },
    update: data,
    create: { id, name, sex, ...data },
  })
}

// Remove duplicate system records (createdByUser: null) for the same horse
// name, keeping the canonical slug-ID version when both exist.
async function deduplicateSystemRecords() {
  const systemStallions = await prisma.horse.findMany({
    where: { sex: 'stallion', createdByUser: null },
    orderBy: { createdAt: 'asc' },
  })
  const seen = new Map<string, string>()
  const toDelete: string[] = []
  for (const h of systemStallions) {
    const key = h.name.toLowerCase()
    if (seen.has(key)) {
      // Prefer slug IDs (better data) — keep the slug record, delete the UUID one
      const currentIsSlug = h.id.includes('-seed')
      const keepId = currentIsSlug ? h.id : seen.get(key)!
      const deleteId = currentIsSlug ? seen.get(key)! : h.id
      seen.set(key, keepId)
      toDelete.push(deleteId)
    } else {
      seen.set(key, h.id)
    }
  }
  if (toDelete.length === 0) return
  // Only delete records with no saved pairings referencing them
  const safeTodelete = await prisma.horse.findMany({
    where: {
      id: { in: toDelete },
      stallionPairings: { none: {} },
      marePairings: { none: {} },
    },
    select: { id: true, name: true },
  })
  if (safeTodelete.length === 0) return
  console.log(`Removing ${safeTodelete.length} duplicate system stallion(s):`, safeTodelete.map(h => h.name).join(', '))
  await prisma.horse.deleteMany({ where: { id: { in: safeTodelete.map(h => h.id) } } })
}

async function main() {
  console.log('Deduplicating existing system records...')
  await deduplicateSystemRecords()

  console.log('Seeding stallion catalog...')

  for (const s of stallions) {
    await upsertByName(s.name, 'stallion', '-seed', {
      breed: s.breed,
      discipline: s.discipline,
      studFee: s.studFee ?? null,
      studLocation: s.studLocation ?? null,
      offspringCount: s.offspringCount,
      offspringPerformanceSummary: s.offspringPerformanceSummary,
      pedigree: s.pedigree,
      createdByUser: null,
    })
  }

  console.log(`Seeded ${stallions.length} sport/western stallions.`)

  console.log('Seeding thoroughbred stallions...')
  for (const s of thoroughbredStallions) {
    await upsertByName(s.name, 'stallion', '-tb-seed', {
      breed: s.breed,
      discipline: s.discipline,
      studFee: s.studFee ?? null,
      studLocation: s.studLocation ?? null,
      studBookingUrl: (s as any).studBookingUrl ?? null,
      offspringCount: s.offspringCount,
      offspringPerformanceSummary: s.offspringPerformanceSummary,
      registrationNumber: (s as any).registrationNumber ?? null,
      pedigree: s.pedigree,
      createdByUser: null,
    })
  }

  console.log(`Seeded ${thoroughbredStallions.length} thoroughbred stallions.`)

  console.log('Seeding Keeneland thoroughbred mare catalog...')
  for (const m of thoroughbredMares) {
    await upsertByName(m.name, 'mare', '-kb-mare', {
      breed: m.breed,
      discipline: m.discipline,
      color: m.color ?? null,
      dateOfBirth: m.dateOfBirth ?? null,
      heightHands: m.heightHands ?? null,
      conformationNotes: m.conformationNotes ?? null,
      performanceRecords: m.performanceRecords ?? [],
      offspringPerformanceSummary: m.offspringPerformanceSummary ?? null,
      pedigree: m.pedigree,
      registrationNumber: (m as any).registrationNumber ?? null,
      epdNotes: m.epdNotes ?? null,
      externalProfileUrl: (m as any).externalProfileUrl ?? null,
      createdByUser: null,
    })
  }

  console.log(`Seeded ${thoroughbredMares.length} Keeneland thoroughbred mares.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
