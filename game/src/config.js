// Tuning constants for the flight model and the world. Distances in metres, speeds in
// metres per second inside the model (the HUD converts to knots and feet for the pilot).

export const WORLD = {
  size: 9000,          // the flyable square, centred on 0,0
  seaLevel: 0,
  ceiling: 1600,       // soft ceiling: drag rises hard above this
};

export const FLIGHT = {
  gravity: 9.81,
  stallMargin: 1.12,   // buffet begins at stall speed times this
  groundEffectHeight: 14,
  hardLandingSink: 4.2,    // m/s of descent at touchdown that starts costing airframe
  crashSink: 8.5,          // m/s of descent that ends the sortie
  crashSpeed: 34,          // m/s into terrain that ends the sortie
  waterLandingMaxSink: 3.4,
};

export const ECONOMY = {
  startCredits: 400,
  fuelPricePerLitre: 0.9,
  repairPricePerPoint: 6,
};
