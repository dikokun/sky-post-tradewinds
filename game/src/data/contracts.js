// The twelve contracts of the Kaldera Reach. A contract is data: the mission engine
// reads its type and flies the same rules for all of them — cargo and passengers land
// at the destination, rings thread a course, drops and photos score a pass over a
// point, and the special rules (night, tide, storm, fragile) ride along as flags.
// Pay is in credits; rep is the reputation that opens the next rank.

export const CONTRACT_TYPES = {
  cargo: 'Cargo run', passenger: 'Passenger hop', rings: 'Ring course',
  drop: 'Supply drop', photo: 'Photo recon', medical: 'Med-evac', tour: 'Grand tour',
};

export const CONTRACTS = [
  { id: 'first-light', name: 'First Light Freight', type: 'cargo', from: 'nalu', to: 'motu',
    cargo: '40 kg of market ice', pay: 260, rep: 1, minRank: 0, timeOfDay: 'dawn', weather: 'calm',
    brief: 'Ice for the dawn market. Take off, find Motu, put her down gentle — melted cargo pays half.' },
  { id: 'honeymooners', name: 'The Honeymooners', type: 'passenger', from: 'nalu', to: 'seralune',
    cargo: 'Two passengers, one enormous suitcase', pay: 340, rep: 1, minRank: 0, timeOfDay: 'day', weather: 'calm', gentle: true,
    brief: 'Newlyweds for Lune Bay. Smooth hands — a hard landing loses the tip and the review.' },
  { id: 'ash-sample', name: 'Ash Sample Run', type: 'photo', from: 'nalu', to: 'vatu',
    cargo: 'A sampling drone and a nervous scientist', pay: 520, rep: 2, minRank: 1, timeOfDay: 'day', weather: 'ash',
    brief: 'One pass over the rim between 1,800 and 2,600 feet. The grey column eats engines — cross it fast.' },
  { id: 'night-med', name: 'Night Med-Evac', type: 'medical', from: 'karak', to: 'nalu',
    cargo: 'The lighthouse keeper, appendix suspected', pay: 780, rep: 3, minRank: 1, timeOfDay: 'night', weather: 'squall', timed: 600,
    brief: 'Night lift off the Perch, crosswind and all. The clock is the appendix. Fly it like you mean it.' },
  { id: 'cannery-rush', name: 'Cannery Rush', type: 'cargo', from: 'motu', to: 'nalu',
    cargo: '300 kg of fresh catch', pay: 480, rep: 2, minRank: 1, timeOfDay: 'day', weather: 'haze', timed: 480,
    brief: 'Beat the cannery whistle back to Port Sera. Fresh fish, short clock, no sightseeing.' },
  { id: 'ring-lagoon', name: 'Ring the Lagoon', type: 'rings', from: 'oru', to: 'oru', rings: 8,
    cargo: 'Eight rings over the lagoon', pay: 560, rep: 2, minRank: 1, timeOfDay: 'day', weather: 'calm',
    brief: 'Thread all eight rings over Oru lagoon, then land on the sand. The divers are judging your lines.' },
  { id: 'volcano-watch', name: 'Volcano Watch', type: 'photo', from: 'vatu', to: 'vatu',
    cargo: 'Three passes for the observatory cameras', pay: 640, rep: 2, minRank: 2, timeOfDay: 'dusk', weather: 'ash',
    brief: 'Three rim passes at dusk. Thermals will throw you upward — ride them, do not fight them.' },
  { id: 'collector', name: 'The Collector', type: 'passenger', from: 'nalu', to: 'fenwick',
    cargo: 'One collector of rare stamps', pay: 700, rep: 3, minRank: 2, timeOfDay: 'day', weather: 'calm', tide: true, gentle: true,
    brief: 'He insists on Folly Field. The tide is coming in — land before the strip goes under, and land soft.' },
  { id: 'storm-post', name: 'Storm Post', type: 'cargo', from: 'nalu', to: 'temara',
    cargo: 'Medical supplies for the research station', pay: 860, rep: 3, minRank: 2, timeOfDay: 'day', weather: 'squall',
    brief: 'A White Squall sits on Temara. Low visibility, downdrafts under the cloud. Low and slow, or not at all.' },
  { id: 'chapel-bells', name: 'Chapel Bells', type: 'cargo', from: 'seralune', to: 'temara',
    cargo: 'Two glass bells, packed in straw', pay: 820, rep: 3, minRank: 2, timeOfDay: 'dawn', weather: 'haze', gentle: true, fragile: true,
    brief: 'Glass bells for the station chapel. One hard landing and you are delivering gravel.' },
  { id: 'high-tide', name: 'High Tide Pickup', type: 'medical', from: 'fenwick', to: 'nalu',
    cargo: 'A surveyor with a broken leg', pay: 980, rep: 4, minRank: 3, timeOfDay: 'dusk', weather: 'squall', tide: true, timed: 600,
    brief: 'The Folly is sinking under the tide and the window shrinks by the minute. In, stopped, out.' },
  { id: 'long-way', name: 'The Long Way Home', type: 'tour', from: 'nalu', to: 'nalu',
    cargo: 'The full circuit — mail for every island', pay: 2400, rep: 6, minRank: 3, timeOfDay: 'dusk', weather: 'calm',
    brief: 'All eight islands, one tank of planning, home by sunset. The Reach, whole. This is the job.' },
];

export const contractById = (id) => CONTRACTS.find((c) => c.id === id);
