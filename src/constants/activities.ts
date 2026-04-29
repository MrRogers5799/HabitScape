import { Cadence } from '../types';

export interface ActivityTemplate {
  id: string;
  activityName: string;
  skillId: string;
  baseXP: number;
  description: string;
  category: 'health' | 'fitness' | 'mental' | 'learning' | 'hobby' | 'productivity';
  defaultCadence?: Cadence;
  availableCadences: Cadence[];
}

// baseXP values are calibrated so that doing an activity at its defaultCadence
// yields roughly equal weekly XP across all cadences. Formula used during design:
// baseXP = originalBaseXP × (7 / timesPerWeek(defaultCadence))
// This means weekly activities have high per-session XP to compensate for fewer sessions.
export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [

  // ===== ATTACK =====
  // Real-world theme: combat sports, striking, competitive physical confrontation
  {
    id: 'martial-arts',
    activityName: 'Martial Arts Training',
    skillId: 'Attack',
    baseXP: 245,
    category: 'fitness',
    description: 'Boxing, kickboxing, or martial arts practice',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'sparring',
    activityName: 'Sparring Session',
    skillId: 'Attack',
    baseXP: 385,
    category: 'fitness',
    description: 'Competitive sparring or fight training',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'boxing',
    activityName: 'Boxing Training',
    skillId: 'Attack',
    baseXP: 235,
    category: 'fitness',
    description: 'Heavy bag, pad work, or boxing drills',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'team-sports',
    activityName: 'Team Sports',
    skillId: 'Attack',
    baseXP: 330,
    category: 'fitness',
    description: 'Soccer, basketball, hockey, or any competitive team sport',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },

  // ===== STRENGTH =====
  // Real-world theme: resistance training, raw power output
  {
    id: 'weight-lifting',
    activityName: 'Weight Lifting',
    skillId: 'Strength',
    baseXP: 235,
    category: 'fitness',
    description: 'Barbell or dumbbell resistance training',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'group-fitness',
    activityName: 'Group Fitness Class',
    skillId: 'Strength',
    baseXP: 385,
    category: 'fitness',
    description: 'CrossFit, bootcamp, or group training classes',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'strongman-training',
    activityName: 'Strongman Training',
    skillId: 'Strength',
    baseXP: 420,
    category: 'fitness',
    description: 'Heavy compound movements and strongman lifts',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'calisthenics',
    activityName: 'Calisthenics',
    skillId: 'Strength',
    baseXP: 160,
    category: 'fitness',
    description: 'Bodyweight training: push-ups, pull-ups, dips',
    defaultCadence: '4x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== DEFENSE =====
  // Real-world theme: resilience, mobility, protecting your body from injury
  {
    id: 'yoga',
    activityName: 'Yoga',
    skillId: 'Defense',
    baseXP: 185,
    category: 'fitness',
    description: 'Holistic practice for flexibility, balance, and resilience',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'pilates',
    activityName: 'Pilates',
    skillId: 'Defense',
    baseXP: 200,
    category: 'fitness',
    description: 'Core strengthening and injury prevention',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'stretching-routine',
    activityName: 'Stretching & Mobility',
    skillId: 'Defense',
    baseXP: 140,
    category: 'fitness',
    description: 'Dedicated flexibility and joint mobility work',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week'],
  },

  // ===== HITPOINTS =====
  // Real-world theme: foundational health habits, recovery, keeping your body running
  {
    id: 'sleep-8h',
    activityName: 'Sleep 8+ Hours',
    skillId: 'Hitpoints',
    baseXP: 85,
    category: 'health',
    description: 'Quality sleep for recovery and long-term health',
    defaultCadence: 'daily',
    availableCadences: ['daily'],
  },
  {
    id: 'hydration',
    activityName: 'Drink 8 Glasses Water (64 oz)',
    skillId: 'Hitpoints',
    baseXP: 50,
    category: 'health',
    description: 'Daily hydration goal — 8 cups / 64 oz of water',
    defaultCadence: 'daily',
    availableCadences: ['daily'],
  },
  {
    id: 'cold-shower',
    activityName: 'Cold Shower',
    skillId: 'Hitpoints',
    baseXP: 175,
    category: 'health',
    description: 'Cold exposure for recovery and mental toughness',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week'],
  },

  // ===== RANGED =====
  // Real-world theme: precision, accuracy, controlled distance — eye and hand coordination
  {
    id: 'archery',
    activityName: 'Archery',
    skillId: 'Ranged',
    baseXP: 595,
    category: 'hobby',
    description: 'Bow and arrow target practice',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'golf',
    activityName: 'Golf',
    skillId: 'Ranged',
    baseXP: 630,
    category: 'hobby',
    description: 'Golf round or driving range practice — precision and distance',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'photography',
    activityName: 'Photography',
    skillId: 'Ranged',
    baseXP: 265,
    category: 'hobby',
    description: 'Deliberate photography practice — framing, timing, and precision',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },

  // ===== PRAYER =====
  // Real-world theme: mindfulness, mental clarity, inner peace, spiritual practice
  {
    id: 'meditation',
    activityName: 'Meditation',
    skillId: 'Prayer',
    baseXP: 80,
    category: 'mental',
    description: 'Mindfulness and breathing exercises',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'journaling',
    activityName: 'Journaling',
    skillId: 'Prayer',
    baseXP: 90,
    category: 'mental',
    description: 'Reflection and mental health journaling',
    defaultCadence: '5x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'gratitude-practice',
    activityName: 'Gratitude Practice',
    skillId: 'Prayer',
    baseXP: 60,
    category: 'mental',
    description: 'Daily gratitude reflection',
    defaultCadence: 'daily',
    availableCadences: ['daily'],
  },
  {
    id: 'meditation-deep',
    activityName: 'Deep Meditation (30+ min)',
    skillId: 'Prayer',
    baseXP: 840,
    category: 'mental',
    description: 'Extended meditation or silent sitting session',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'breathwork',
    activityName: 'Breathwork',
    skillId: 'Prayer',
    baseXP: 70,
    category: 'mental',
    description: 'Wim Hof, box breathing, or structured breathwork session',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week'],
  },

  // ===== MAGIC =====
  // Real-world theme: expanding knowledge, intellectual growth, mental acuity
  {
    id: 'reading',
    activityName: 'Reading',
    skillId: 'Magic',
    baseXP: 165,
    category: 'learning',
    description: 'Books, long-form articles, or deep reading sessions',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'online-course',
    activityName: 'Online Course / Tutorial',
    skillId: 'Magic',
    baseXP: 315,
    category: 'learning',
    description: 'Structured online learning — courses, lectures, tutorials',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'learn-language',
    activityName: 'Language Learning',
    skillId: 'Magic',
    baseXP: 85,
    category: 'learning',
    description: 'Language study session — Duolingo, iTalki, or self-study',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week'],
  },
  {
    id: 'podcast-learning',
    activityName: 'Educational Podcast',
    skillId: 'Magic',
    baseXP: 150,
    category: 'learning',
    description: 'Listen to an educational or thought-provoking podcast',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== COOKING =====
  // Real-world theme: nutrition, preparing food, culinary skill
  {
    id: 'home-cooked-meal',
    activityName: 'Eat a Home Cooked Meal',
    skillId: 'Cooking',
    baseXP: 150,
    category: 'health',
    description: 'Cook and eat a meal at home instead of eating out',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week'],
  },
  {
    id: 'meal-prep',
    activityName: 'Meal Prep',
    skillId: 'Cooking',
    baseXP: 330,
    category: 'productivity',
    description: 'Batch cook and prepare meals for the week',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'cooking-advanced',
    activityName: 'New Recipe or Technique',
    skillId: 'Cooking',
    baseXP: 735,
    category: 'hobby',
    description: 'Try a new recipe or learn a new cooking method',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'baking',
    activityName: 'Baking',
    skillId: 'Cooking',
    baseXP: 630,
    category: 'hobby',
    description: 'Bread, pastries, or dessert baking from scratch',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== WOODCUTTING =====
  // Real-world theme: outdoor manual labor, working with nature
  {
    id: 'yardwork',
    activityName: 'Yard Work & Landscaping',
    skillId: 'Woodcutting',
    baseXP: 630,
    category: 'productivity',
    description: 'Mowing, raking, pruning, or general yard maintenance',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'chopping-wood',
    activityName: 'Chopping & Splitting Firewood',
    skillId: 'Woodcutting',
    baseXP: 700,
    category: 'fitness',
    description: 'Splitting logs — great full-body workout with a practical reward',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'trail-maintenance',
    activityName: 'Trail or Nature Volunteer Work',
    skillId: 'Woodcutting',
    baseXP: 2380,
    category: 'hobby',
    description: 'Volunteer trail clearing, conservation, or outdoor labor',
    defaultCadence: 'monthly',
    availableCadences: ['weekly', 'monthly'],
  },

  // ===== FLETCHING =====
  // Real-world theme: fine motor precision, deliberate creative craft
  {
    id: 'drawing',
    activityName: 'Drawing / Illustration',
    skillId: 'Fletching',
    baseXP: 175,
    category: 'hobby',
    description: 'Sketching, illustration, or deliberate drawing practice',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'music-practice',
    activityName: 'Music Practice',
    skillId: 'Fletching',
    baseXP: 160,
    category: 'hobby',
    description: 'Practice an instrument with focused, deliberate repetition',
    defaultCadence: '4x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'calligraphy',
    activityName: 'Calligraphy & Lettering',
    skillId: 'Fletching',
    baseXP: 245,
    category: 'hobby',
    description: 'Hand lettering, calligraphy, or penmanship practice',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'creative-writing',
    activityName: 'Creative Writing',
    skillId: 'Fletching',
    baseXP: 185,
    category: 'learning',
    description: 'Fiction, poetry, or storytelling — crafting words with intention',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== FISHING =====
  // Real-world theme: patience, stillness, outdoor relaxation
  {
    id: 'fishing',
    activityName: 'Fishing',
    skillId: 'Fishing',
    baseXP: 595,
    category: 'hobby',
    description: 'Cast a line — patience, focus, and time in nature',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'kayaking',
    activityName: 'Kayaking / Paddleboarding',
    skillId: 'Fishing',
    baseXP: 630,
    category: 'hobby',
    description: 'On-water paddle sport — calm, focused movement',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== FIREMAKING =====
  // Real-world theme: warmth, gathering, building a fire — building energy and momentum
  {
    id: 'camping',
    activityName: 'Camping Trip',
    skillId: 'Firemaking',
    baseXP: 2520,
    category: 'hobby',
    description: 'Overnight camping with campfire — disconnecting and recharging',
    defaultCadence: 'monthly',
    availableCadences: ['monthly'],
  },
  {
    id: 'bbq-cooking',
    activityName: 'BBQ & Outdoor Cooking',
    skillId: 'Firemaking',
    baseXP: 595,
    category: 'hobby',
    description: 'Grill or cook over open fire outdoors',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'sauna',
    activityName: 'Sauna Session',
    skillId: 'Firemaking',
    baseXP: 280,
    category: 'health',
    description: 'Heat therapy — sauna, steam room, or infrared session',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== CRAFTING =====
  // Real-world theme: creative making, art, handmade objects
  {
    id: 'knitting',
    activityName: 'Knitting / Sewing',
    skillId: 'Crafting',
    baseXP: 245,
    category: 'hobby',
    description: 'Knit, crochet, or sew textile projects',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'pottery',
    activityName: 'Pottery / Ceramics',
    skillId: 'Crafting',
    baseXP: 595,
    category: 'hobby',
    description: 'Pottery wheel, hand-building, or ceramic art',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'painting',
    activityName: 'Painting',
    skillId: 'Crafting',
    baseXP: 280,
    category: 'hobby',
    description: 'Acrylic, watercolor, oil painting, or mixed media art',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'jewelry-making',
    activityName: 'Jewelry Making',
    skillId: 'Crafting',
    baseXP: 525,
    category: 'hobby',
    description: 'Beading, wire work, or metal jewelry craft',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== SMITHING =====
  // Real-world theme: forging and building physical things with your hands
  {
    id: 'woodworking',
    activityName: 'Woodworking Project',
    skillId: 'Smithing',
    baseXP: 665,
    category: 'hobby',
    description: 'Build or craft something from wood',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'metalworking',
    activityName: 'Metalworking / Blacksmithing',
    skillId: 'Smithing',
    baseXP: 700,
    category: 'hobby',
    description: 'Forge, weld, or shape metal into something useful',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'leatherworking',
    activityName: 'Leatherworking',
    skillId: 'Smithing',
    baseXP: 630,
    category: 'hobby',
    description: 'Craft leather goods — belts, wallets, bags',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== MINING =====
  // Real-world theme: digging deep, sustained effort on hard problems, focus
  {
    id: 'deep-work',
    activityName: 'Deep Work Session',
    skillId: 'Mining',
    baseXP: 235,
    category: 'productivity',
    description: 'Uninterrupted 90-minute focused work on a hard problem',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'research-deep-dive',
    activityName: 'Research Deep Dive',
    skillId: 'Mining',
    baseXP: 595,
    category: 'learning',
    description: 'Thoroughly research and document a topic you want to master',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'geocaching',
    activityName: 'Geocaching',
    skillId: 'Mining',
    baseXP: 525,
    category: 'hobby',
    description: 'Hunt for hidden caches outdoors using GPS',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== HERBLORE =====
  // Real-world theme: natural health, nutrition knowledge, wellness routines
  {
    id: 'supplement-routine',
    activityName: 'Daily Supplement Routine',
    skillId: 'Herblore',
    baseXP: 55,
    category: 'health',
    description: 'Consistent vitamin, mineral, or supplement intake',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week'],
  },
  {
    id: 'smoothie-routine',
    activityName: 'Healthy Smoothie / Juice',
    skillId: 'Herblore',
    baseXP: 150,
    category: 'health',
    description: 'Prepare a nutritious whole-food smoothie or fresh juice',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week'],
  },
  {
    id: 'tea-routine',
    activityName: 'Herbal Tea Routine',
    skillId: 'Herblore',
    baseXP: 55,
    category: 'health',
    description: 'Intentional herbal tea preparation and drinking',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week'],
  },
  {
    id: 'herbal-study',
    activityName: 'Herbalism Study',
    skillId: 'Herblore',
    baseXP: 560,
    category: 'learning',
    description: 'Study plants, nutrition, or natural remedies',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== AGILITY =====
  // Real-world theme: cardio, endurance, fluid movement
  {
    id: 'running',
    activityName: 'Running',
    skillId: 'Agility',
    baseXP: 210,
    category: 'fitness',
    description: 'Outdoor or treadmill running for cardio endurance',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'walk-hike',
    activityName: 'Walk or Hike',
    skillId: 'Agility',
    baseXP: 200,
    category: 'fitness',
    description: 'Outdoor walking or hiking — low barrier, high benefit',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'cycling',
    activityName: 'Cycling',
    skillId: 'Agility',
    baseXP: 210,
    category: 'fitness',
    description: 'Road cycling, mountain biking, or stationary bike',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'swimming',
    activityName: 'Swimming',
    skillId: 'Agility',
    baseXP: 220,
    category: 'fitness',
    description: 'Lap swimming or open water — full body cardio',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'dancing',
    activityName: 'Dancing',
    skillId: 'Agility',
    baseXP: 280,
    category: 'hobby',
    description: 'Dance class or freestyle — coordination and cardio',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },

  // ===== THIEVING =====
  // Real-world theme: cleverness, strategy, problem-solving under pressure
  {
    id: 'puzzle-games',
    activityName: 'Puzzle Games',
    skillId: 'Thieving',
    baseXP: 165,
    category: 'learning',
    description: 'Sudoku, crossword, logic puzzles — strategic brain training',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'chess',
    activityName: 'Chess',
    skillId: 'Thieving',
    baseXP: 185,
    category: 'learning',
    description: 'Chess games or study — deep strategic thinking',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'memory-training',
    activityName: 'Memory Training',
    skillId: 'Thieving',
    baseXP: 75,
    category: 'learning',
    description: 'Memory palace, spaced repetition, or memorization practice',
    defaultCadence: 'daily',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week'],
  },
  {
    id: 'escape-room',
    activityName: 'Escape Room',
    skillId: 'Thieving',
    baseXP: 2520,
    category: 'hobby',
    description: 'Escape room challenge — teamwork, pressure, and problem-solving',
    defaultCadence: 'monthly',
    availableCadences: ['weekly', 'monthly'],
  },

  // ===== SLAYER =====
  // Real-world theme: conquering difficult challenges, overcoming fears, pushing limits
  {
    id: 'parkour',
    activityName: 'Parkour Training',
    skillId: 'Slayer',
    baseXP: 330,
    category: 'fitness',
    description: 'Parkour and movement training — overcoming physical obstacles',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'rock-climbing',
    activityName: 'Rock Climbing',
    skillId: 'Slayer',
    baseXP: 330,
    category: 'fitness',
    description: 'Indoor or outdoor climbing — conquer the route',
    defaultCadence: '2x/week',
    availableCadences: ['3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'hiit',
    activityName: 'HIIT Training',
    skillId: 'Slayer',
    baseXP: 235,
    category: 'fitness',
    description: 'High-intensity intervals — push past your comfort zone',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'comfort-zone-challenge',
    activityName: 'Comfort Zone Challenge',
    skillId: 'Slayer',
    baseXP: 595,
    category: 'mental',
    description: 'Do one thing that makes you uncomfortable — public speaking, cold approach, etc.',
    defaultCadence: 'weekly',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },

  // ===== FARMING =====
  // Real-world theme: cultivating growth, patience, tending living things
  {
    id: 'vegetable-garden',
    activityName: 'Vegetable Garden',
    skillId: 'Farming',
    baseXP: 210,
    category: 'hobby',
    description: 'Tend your vegetable or fruit garden — planting, watering, harvesting',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'herb-garden',
    activityName: 'Herb Garden',
    skillId: 'Farming',
    baseXP: 280,
    category: 'hobby',
    description: 'Grow and maintain herbs — culinary, medicinal, or aromatic',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'composting',
    activityName: 'Composting',
    skillId: 'Farming',
    baseXP: 230,
    category: 'productivity',
    description: 'Maintain a compost system — turning, feeding, managing',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'house-plants',
    activityName: 'Caring for House Plants',
    skillId: 'Farming',
    baseXP: 140,
    category: 'hobby',
    description: 'Water, prune, and tend your indoor plant collection',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'bird-watching',
    activityName: 'Bird Watching',
    skillId: 'Farming',
    baseXP: 455,
    category: 'hobby',
    description: 'Patient nature observation — identifying birds and wildlife',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== RUNECRAFTING =====
  // Real-world theme: building systems, writing code, creating structured things from scratch
  {
    id: 'programming',
    activityName: 'Programming / Coding',
    skillId: 'Runecrafting',
    baseXP: 235,
    category: 'learning',
    description: 'Write code or build a programming project',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'problem-solving',
    activityName: 'Coding Challenges',
    skillId: 'Runecrafting',
    baseXP: 200,
    category: 'learning',
    description: 'LeetCode, Codewars, or competitive programming problems',
    defaultCadence: '3x/week',
    availableCadences: ['daily', '6x/week', '5x/week', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'blogging',
    activityName: 'Writing / Blogging',
    skillId: 'Runecrafting',
    baseXP: 280,
    category: 'learning',
    description: 'Write and publish — blog posts, essays, technical writing',
    defaultCadence: '2x/week',
    availableCadences: ['daily', '4x/week', '3x/week', '2x/week', 'weekly'],
  },
  {
    id: 'system-building',
    activityName: 'Build a System or Workflow',
    skillId: 'Runecrafting',
    baseXP: 630,
    category: 'productivity',
    description: 'Design a productivity system, automation, or structured workflow',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },

  // ===== CONSTRUCTION =====
  // Real-world theme: building and improving your physical environment
  {
    id: 'home-improvement',
    activityName: 'Home Improvement Project',
    skillId: 'Construction',
    baseXP: 665,
    category: 'productivity',
    description: 'DIY home repair, renovation, or improvement task',
    defaultCadence: 'weekly',
    availableCadences: ['2x/week', 'weekly', 'monthly'],
  },
  {
    id: 'organization',
    activityName: 'Organize / Declutter',
    skillId: 'Construction',
    baseXP: 525,
    category: 'productivity',
    description: 'Declutter and organize a space in your home',
    defaultCadence: 'weekly',
    availableCadences: ['weekly', 'monthly'],
  },
  {
    id: 'furniture-building',
    activityName: 'Furniture Building / Assembly',
    skillId: 'Construction',
    baseXP: 2800,
    category: 'hobby',
    description: 'Build or assemble furniture — hands-on construction',
    defaultCadence: 'monthly',
    availableCadences: ['weekly', 'monthly'],
  },
];

export function getActivityTemplate(id: string): ActivityTemplate | undefined {
  return ACTIVITY_TEMPLATES.find(activity => activity.id === id);
}

export function getActivitiesForSkill(skillId: string): ActivityTemplate[] {
  return ACTIVITY_TEMPLATES.filter(activity => activity.skillId === skillId);
}

export function getDefaultCadence(activityId: string): string {
  const template = getActivityTemplate(activityId);
  return template?.defaultCadence || 'weekly';
}

/**
 * Default activities assigned to new users at signup.
 * Chosen to be universal — low barrier, no special equipment,
 * and meaningful for almost anyone starting a self-improvement journey.
 */
export const DEFAULT_USER_ACTIVITIES = [
  'weight-lifting',   // Strength
  'sleep-8h',         // Hitpoints
  'hydration',        // Hitpoints
  'walk-hike',        // Agility
  'reading',          // Magic
  'meditation',       // Prayer
  'meal-prep',        // Cooking
];
