/** Independent unrounded browser observations on the authenticated reference, 2026-11-02.
 * URL: https://www.elektro-rechner.ch/premium/sia2056-rechner.php
 * Expected totals were read from the provider's live lastResult after changing
 * its actual controls and calling its normal calc(), not from the edeco model.
 */
export const SIA_BROWSER_FIXTURES = [
  {
    "name": "office-default",
    "input": {},
    "expected": {
      "powerKW": 32.323899999999995,
      "energyKWh": 59069.59999999999,
      "powerDensity": 32.323899999999995,
      "energyDensity": 59.069599999999994,
      "standbyKW": 2.707019,
      "pvKWp": 0,
      "pvYearKWh": 0,
      "kcorAverage": 0.7,
      "yearGlzAverage": 0.8
    }
  },
  {
    "name": "office-low-kcor",
    "input": {
      "siaRefKcor": "min"
    },
    "expected": {
      "powerKW": 27.7062,
      "energyKWh": 59069.59999999999,
      "powerDensity": 27.7062,
      "energyDensity": 59.069599999999994,
      "standbyKW": 2.3203019999999994,
      "pvKWp": 0,
      "pvYearKWh": 0,
      "kcorAverage": 0.6,
      "yearGlzAverage": 0.8
    }
  },
  {
    "name": "office-energy-07",
    "input": {
      "siaRefGlz": "0.7"
    },
    "expected": {
      "powerKW": 32.323899999999995,
      "energyKWh": 51685.899999999994,
      "powerDensity": 32.323899999999995,
      "energyDensity": 51.6859,
      "standbyKW": 2.707019,
      "pvKWp": 0,
      "pvYearKWh": 0,
      "kcorAverage": 0.7,
      "yearGlzAverage": 0.7
    }
  },
  {
    "name": "mfh-large-devices",
    "input": {
      "siaBuilding": "mfh",
      "siaRefArea": "500",
      "siaClass_devices": "l",
      "siaClass_cooling": "keine"
    },
    "expected": {
      "powerKW": 9.525,
      "energyKWh": 21272.000000000004,
      "powerDensity": 19.05,
      "energyDensity": 42.544000000000004,
      "standbyKW": 1.3345850000000004,
      "pvKWp": 0,
      "pvYearKWh": 0,
      "kcorAverage": 1,
      "yearGlzAverage": 0.8
    }
  },
  {
    "name": "hotel-pv-tessin",
    "input": {
      "siaBuilding": "hotel",
      "siaRefArea": "250",
      "siaClass_devices": "s",
      "siaClass_processes": "s",
      "siaClass_lighting": "zw",
      "siaClass_general": "s",
      "siaClass_heating": "luft",
      "siaClass_ventilation": "zw",
      "siaClass_cooling": "bestand",
      "siaRefPVArea": "100",
      "siaRefPVDirection": "sued45",
      "siaRefShade": "0.75",
      "siaClimate": "tessin"
    },
    "expected": {
      "powerKW": 7.3803374999999996,
      "energyKWh": 6402.725,
      "powerDensity": 29.521349999999998,
      "energyDensity": 25.6109,
      "standbyKW": 0.4440761249999999,
      "pvKWp": 20,
      "pvYearKWh": 19598.04,
      "kcorAverage": 0.85,
      "yearGlzAverage": 0.7
    }
  },
  {
    "name": "office-food-two-zones",
    "input": {
      "siaRefArea": "500",
      "sia2Building": "retail-food",
      "sia2RefArea": "300",
      "sia2Class_devices": "m",
      "sia2Class_processes": "l",
      "sia2Class_lighting": "mg",
      "sia2Class_general": "l",
      "sia2Class_heating": "keine",
      "sia2Class_ventilation": "gw",
      "sia2Class_cooling": "gw"
    },
    "expected": {
      "powerKW": 40.58380999999999,
      "energyKWh": 133521.52,
      "powerDensity": 50.729762499999985,
      "energyDensity": 166.90189999999998,
      "standbyKW": 5.8859993500000005,
      "pvKWp": 0,
      "pvYearKWh": 0,
      "kcorAverage": 0.75625,
      "yearGlzAverage": 0.8
    }
  }
] as const;
