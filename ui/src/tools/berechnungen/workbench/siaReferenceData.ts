/** Dated numerical reference facts from the authenticated calculator; not an independently verified normative dataset.
 * URL: https://www.elektro-rechner.ch/premium/sia2056-rechner.php
 * Captured 2026-11-02. SHA-256 of captured inline source: c7ccba4d9bf25ab42459b51424a63a148199a969c450fb0a17df7577cfe63792
 * Null values are intentional source gaps and must never be replaced or interpolated.
 */
export const SIA_REFERENCE_SOURCE = {url:'https://www.elektro-rechner.ch/premium/sia2056-rechner.php',captured:'2026-11-02',sha256:'c7ccba4d9bf25ab42459b51424a63a148199a969c450fb0a17df7577cfe63792',qualification:'Veröffentlichte Anbieterwerte; Normzuordnung und Nutzungszuordnung projektspezifisch prüfen'} as const;
export interface SIAReferenceGroup { p:Record<string,number|null>; e:Record<string,number|null>; sb?:Record<string,number|null> }
export const SIA_REFERENCE_GROUPS:Readonly<Record<string,Readonly<Record<string,SIAReferenceGroup>>>> = {
 "devices": {
  "Wohnen MFH": {
   "p": {
    "s": 2.81,
    "m": 5.652,
    "l": 9.776
   },
   "sb": {
    "s": 0.554,
    "m": 1.1,
    "l": 2.2
   },
   "e": {
    "s": 9.968,
    "m": 19.981,
    "l": 36.937
   }
  },
  "Wohnen EFH": {
   "p": {
    "s": 2.383,
    "m": 4.793,
    "l": 8.313
   },
   "sb": {
    "s": 0.503,
    "m": 1,
    "l": 2
   },
   "e": {
    "s": 8.672,
    "m": 17.381,
    "l": 32.241
   }
  },
  "Hotel": {
   "p": {
    "s": 1.312,
    "m": 2.116,
    "l": 4.014
   },
   "sb": {
    "s": 0.722,
    "m": 1.466,
    "l": 3.178
   },
   "e": {
    "s": 9.194,
    "m": 16.134,
    "l": 32.362
   }
  },
  "Büro": {
   "p": {
    "s": 2.599,
    "m": 5.303,
    "l": 12.164
   },
   "sb": {
    "s": 0.496,
    "m": 0.984,
    "l": 3.01
   },
   "e": {
    "s": 8.041,
    "m": 20.561,
    "l": 54.239
   }
  },
  "Schule": {
   "p": {
    "s": 0.549,
    "m": 1.156,
    "l": 2.608
   },
   "sb": {
    "s": 0.287,
    "m": 0.563,
    "l": 1.203
   },
   "e": {
    "s": 3.149,
    "m": 6.292,
    "l": 13.613
   }
  },
  "Hochschule": {
   "p": {
    "s": 2.841,
    "m": 6.396,
    "l": 15.668
   },
   "sb": {
    "s": 0.46,
    "m": 0.89,
    "l": 2.32
   },
   "e": {
    "s": 9.478,
    "m": 19.474,
    "l": 47.133
   }
  },
  "Verkauf": {
   "p": {
    "s": 0.416,
    "m": 0.888,
    "l": 2.038
   },
   "sb": {
    "s": 0.277,
    "m": 0.55,
    "l": 1.17
   },
   "e": {
    "s": 2.95,
    "m": 6.076,
    "l": 13.473
   }
  },
  "Verkauf (Food)": {
   "p": {
    "s": 0.416,
    "m": 0.888,
    "l": null
   },
   "sb": {
    "s": 0.277,
    "m": 0.55,
    "l": null
   },
   "e": {
    "s": 2.95,
    "m": 6.076,
    "l": null
   }
  },
  "Restaurant": {
   "p": {
    "s": 0.396,
    "m": 0.786,
    "l": 1.844
   },
   "sb": {
    "s": 0.286,
    "m": 0.286,
    "l": 1.232
   },
   "e": {
    "s": 2.821,
    "m": 5.613,
    "l": 12.549
   }
  },
  "Versammlung": {
   "p": {
    "s": 0.34,
    "m": 0.688,
    "l": 1.544
   },
   "sb": {
    "s": 0.276,
    "m": 0.55,
    "l": 1.15
   },
   "e": {
    "s": 2.602,
    "m": 5.214,
    "l": 11.205
   }
  },
  "Spital": {
   "p": {
    "s": 0.813,
    "m": 1.397,
    "l": 2.801
   },
   "sb": {
    "s": 0.479,
    "m": 0.966,
    "l": 2.13
   },
   "e": {
    "s": 5.89,
    "m": 10.758,
    "l": 22.419
   }
  },
  "Industrie": {
   "p": {
    "s": 0.897,
    "m": 1.949,
    "l": 4.835
   },
   "sb": {
    "s": 0.318,
    "m": 0.63,
    "l": 1.487
   },
   "e": {
    "s": 4.157,
    "m": 8.445,
    "l": 20.238
   }
  },
  "Lager": {
   "p": {
    "s": 0.337,
    "m": 0.671,
    "l": 1.446
   },
   "sb": {
    "s": 0.26,
    "m": 0.52,
    "l": 1.085
   },
   "e": {
    "s": 2.499,
    "m": 4.989,
    "l": 10.541
   }
  },
  "Sportbauten": {
   "p": {
    "s": 0.328,
    "m": 0.726,
    "l": 1.624
   },
   "sb": {
    "s": 0.256,
    "m": 0.511,
    "l": 1.021
   },
   "e": {
    "s": 2.333,
    "m": 4.747,
    "l": 9.716
   }
  },
  "Hallenbad": {
   "p": {
    "s": 0.668,
    "m": 1.287,
    "l": 2.381
   },
   "sb": {
    "s": 0.268,
    "m": 0.529,
    "l": 1.081
   },
   "e": {
    "s": 3.492,
    "m": 6.807,
    "l": 13.199
   }
  },
  "Parkhaus": {
   "p": {
    "s": 0.264,
    "m": 0.525,
    "l": 1.075
   },
   "sb": {
    "s": 0.253,
    "m": 0.505,
    "l": 1.021
   },
   "e": {
    "s": 2.245,
    "m": 4.48,
    "l": 9.096
   }
  }
 },
 "processes": {
  "Wohnen MFH": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Wohnen EFH": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Hotel": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Büro": {
   "p": {
    "s": 1,
    "m": 1.5,
    "l": 2
   },
   "sb": {
    "s": 1,
    "m": 1.5,
    "l": 2
   },
   "e": {
    "s": 8.76,
    "m": 13.14,
    "l": 17.52
   }
  },
  "Schule": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Hochschule": {
   "p": {
    "s": 1,
    "m": 1.5,
    "l": 2
   },
   "sb": {
    "s": 1,
    "m": 1.5,
    "l": 2
   },
   "e": {
    "s": 8.76,
    "m": 13.14,
    "l": 17.52
   }
  },
  "Verkauf": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Verkauf (Food)": {
   "p": {
    "s": 50.4,
    "m": 63,
    "l": 75.6
   },
   "sb": {
    "s": 10.56,
    "m": 13.2,
    "l": 15.84
   },
   "e": {
    "s": 251.07,
    "m": 313.84,
    "l": 376.6
   }
  },
  "Restaurant": {
   "p": {
    "s": 15.6,
    "m": 21,
    "l": 25.4
   },
   "sb": {
    "s": 2.04,
    "m": 2.7,
    "l": 3.26
   },
   "e": {
    "s": 52.8,
    "m": 70.73,
    "l": 85.51
   }
  },
  "Versammlung": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Spital": {
   "p": {
    "s": 0.5,
    "m": 1.5,
    "l": 2
   },
   "sb": {
    "s": 0.05,
    "m": 0.15,
    "l": 0.2
   },
   "e": {
    "s": 1.42,
    "m": 4.26,
    "l": 5.68
   }
  },
  "Industrie": {
   "p": {
    "s": 3.5,
    "m": 6.5,
    "l": 13
   },
   "sb": {
    "s": 0.7,
    "m": 1.3,
    "l": 2.6
   },
   "e": {
    "s": 13.3,
    "m": 24.38,
    "l": 48.76
   }
  },
  "Lager": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Sportbauten": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  },
  "Hallenbad": {
   "p": {
    "s": 30,
    "m": 60,
    "l": 90
   },
   "sb": {
    "s": 3,
    "m": 6,
    "l": 9
   },
   "e": {
    "s": 180.45,
    "m": 360.9,
    "l": 541.35
   }
  },
  "Parkhaus": {
   "p": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "sb": {
    "s": 0,
    "m": 0,
    "l": 0
   },
   "e": {
    "s": 0,
    "m": 0,
    "l": 0
   }
  }
 },
 "lighting": {
  "Wohnen MFH": {
   "p": {
    "gw": 4.387,
    "mg": 3.464,
    "zw": 2.827
   },
   "sb": {
    "gw": 0.132,
    "mg": 0.069,
    "zw": 0.028
   },
   "e": {
    "gw": 4.569,
    "mg": 3.298,
    "zw": 2.026
   }
  },
  "Wohnen EFH": {
   "p": {
    "gw": 7.09,
    "mg": 5.632,
    "zw": 4.623
   },
   "sb": {
    "gw": 0.213,
    "mg": 0.113,
    "zw": 0.046
   },
   "e": {
    "gw": 7.764,
    "mg": 5.29,
    "zw": 2.816
   }
  },
  "Hotel": {
   "p": {
    "gw": 4.464,
    "mg": 3.525,
    "zw": 2.877
   },
   "sb": {
    "gw": 0.134,
    "mg": 0.07,
    "zw": 0.029
   },
   "e": {
    "gw": 4.575,
    "mg": 3.345,
    "zw": 2.114
   }
  },
  "Büro": {
   "p": {
    "gw": 8.78,
    "mg": 6.964,
    "zw": 5.71
   },
   "sb": {
    "gw": 0.263,
    "mg": 0.139,
    "zw": 0.057
   },
   "e": {
    "gw": 12.389,
    "mg": 7.573,
    "zw": 2.757
   }
  },
  "Schule": {
   "p": {
    "gw": 8.048,
    "mg": 6.373,
    "zw": 5.216
   },
   "sb": {
    "gw": 0.241,
    "mg": 0.127,
    "zw": 0.052
   },
   "e": {
    "gw": 10.605,
    "mg": 6.418,
    "zw": 2.23
   }
  },
  "Hochschule": {
   "p": {
    "gw": 7.667,
    "mg": 6.071,
    "zw": 4.969
   },
   "sb": {
    "gw": 0.23,
    "mg": 0.121,
    "zw": 0.05
   },
   "e": {
    "gw": 11.281,
    "mg": 7.185,
    "zw": 3.089
   }
  },
  "Verkauf": {
   "p": {
    "gw": 10.906,
    "mg": 8.622,
    "zw": 7.047
   },
   "sb": {
    "gw": 0.327,
    "mg": 0.172,
    "zw": 0.07
   },
   "e": {
    "gw": 38.459,
    "mg": 31.044,
    "zw": 23.628
   }
  },
  "Verkauf (Food)": {
   "p": {
    "gw": 10.906,
    "mg": 8.622,
    "zw": 7.047
   },
   "sb": {
    "gw": 0.327,
    "mg": 0.172,
    "zw": 0.07
   },
   "e": {
    "gw": 38.529,
    "mg": 31.08,
    "zw": 23.632
   }
  },
  "Restaurant": {
   "p": {
    "gw": 6.099,
    "mg": 4.835,
    "zw": 3.961
   },
   "sb": {
    "gw": 0.183,
    "mg": 0.097,
    "zw": 0.04
   },
   "e": {
    "gw": 13.27,
    "mg": 9.048,
    "zw": 4.826
   }
  },
  "Versammlung": {
   "p": {
    "gw": 7.671,
    "mg": 6.082,
    "zw": 4.984
   },
   "sb": {
    "gw": 0.23,
    "mg": 0.122,
    "zw": 0.05
   },
   "e": {
    "gw": 20.337,
    "mg": 15.151,
    "zw": 9.966
   }
  },
  "Spital": {
   "p": {
    "gw": 7.999,
    "mg": 6.324,
    "zw": 5.168
   },
   "sb": {
    "gw": 0.24,
    "mg": 0.126,
    "zw": 0.052
   },
   "e": {
    "gw": 16.879,
    "mg": 11.442,
    "zw": 6.004
   }
  },
  "Industrie": {
   "p": {
    "gw": 8.705,
    "mg": 6.905,
    "zw": 5.661
   },
   "sb": {
    "gw": 0.261,
    "mg": 0.138,
    "zw": 0.057
   },
   "e": {
    "gw": 16.758,
    "mg": 10.777,
    "zw": 4.795
   }
  },
  "Lager": {
   "p": {
    "gw": 6.564,
    "mg": 5.222,
    "zw": 4.293
   },
   "sb": {
    "gw": 0.197,
    "mg": 0.104,
    "zw": 0.043
   },
   "e": {
    "gw": 22.987,
    "mg": 15.518,
    "zw": 8.049
   }
  },
  "Sportbauten": {
   "p": {
    "gw": 8.806,
    "mg": 6.966,
    "zw": 5.696
   },
   "sb": {
    "gw": 0.264,
    "mg": 0.139,
    "zw": 0.057
   },
   "e": {
    "gw": 17.292,
    "mg": 11.531,
    "zw": 5.77
   }
  },
  "Hallenbad": {
   "p": {
    "gw": 6.696,
    "mg": 5.3,
    "zw": 4.337
   },
   "sb": {
    "gw": 0.201,
    "mg": 0.106,
    "zw": 0.043
   },
   "e": {
    "gw": 14.905,
    "mg": 9.559,
    "zw": 4.212
   }
  },
  "Parkhaus": {
   "p": {
    "gw": 1.573,
    "mg": 1.259,
    "zw": 1.042
   },
   "sb": {
    "gw": 0.047,
    "mg": 0.025,
    "zw": 0.01
   },
   "e": {
    "gw": 2.459,
    "mg": 1.596,
    "zw": 0.732
   }
  }
 },
 "general": {
  "Wohnen MFH": {
   "p": {
    "s": 0.207,
    "m": 0.374,
    "l": 0.691
   },
   "sb": {
    "s": 0.097,
    "m": 0.164,
    "l": 0.231
   },
   "e": {
    "s": 0.887,
    "m": 1.905,
    "l": 3.593
   }
  },
  "Wohnen EFH": {
   "p": {
    "s": 0.167,
    "m": 0.234,
    "l": 0.301
   },
   "sb": {
    "s": 0.167,
    "m": 0.234,
    "l": 0.301
   },
   "e": {
    "s": 1.464,
    "m": 2.051,
    "l": 2.639
   }
  },
  "Hotel": {
   "p": {
    "s": 4.659,
    "m": 6.177,
    "l": 8.025
   },
   "sb": {
    "s": 0.525,
    "m": 0.864,
    "l": 1.203
   },
   "e": {
    "s": 4.883,
    "m": 8.928,
    "l": 14.438
   }
  },
  "Büro": {
   "p": {
    "s": 4.327,
    "m": 5.541,
    "l": 6.981
   },
   "sb": {
    "s": 0.253,
    "m": 0.361,
    "l": 0.479
   },
   "e": {
    "s": 2.439,
    "m": 4.131,
    "l": 6.894
   }
  },
  "Schule": {
   "p": {
    "s": 4.287,
    "m": 5.464,
    "l": 6.811
   },
   "sb": {
    "s": 0.243,
    "m": 0.351,
    "l": 0.469
   },
   "e": {
    "s": 2.32,
    "m": 3.847,
    "l": 6.206
   }
  },
  "Hochschule": {
   "p": {
    "s": 4.591,
    "m": 6.065,
    "l": 7.8
   },
   "sb": {
    "s": 0.493,
    "m": 0.832,
    "l": 1.17
   },
   "e": {
    "s": 4.569,
    "m": 8.41,
    "l": 13.426
   }
  },
  "Verkauf": {
   "p": {
    "s": 4.629,
    "m": 6.046,
    "l": 7.615
   },
   "sb": {
    "s": 0.478,
    "m": 0.816,
    "l": 1.155
   },
   "e": {
    "s": 4.678,
    "m": 8.488,
    "l": 13.041
   }
  },
  "Verkauf (Food)": {
   "p": {
    "s": 4.629,
    "m": 6.046,
    "l": 7.615
   },
   "sb": {
    "s": 0.478,
    "m": 0.816,
    "l": 1.155
   },
   "e": {
    "s": 4.678,
    "m": 8.488,
    "l": 13.041
   }
  },
  "Restaurant": {
   "p": {
    "s": 4.867,
    "m": 6.604,
    "l": 9.011
   },
   "sb": {
    "s": 0.553,
    "m": 0.891,
    "l": 1.229
   },
   "e": {
    "s": 5.313,
    "m": 10.339,
    "l": 18.271
   }
  },
  "Versammlung": {
   "p": {
    "s": 4.407,
    "m": 5.694,
    "l": 7.321
   },
   "sb": {
    "s": 0.273,
    "m": 0.381,
    "l": 0.499
   },
   "e": {
    "s": 2.676,
    "m": 4.697,
    "l": 8.271
   }
  },
  "Spital": {
   "p": {
    "s": 4.787,
    "m": 6.381,
    "l": 8.416
   },
   "sb": {
    "s": 0.531,
    "m": 0.878,
    "l": 1.227
   },
   "e": {
    "s": 5.218,
    "m": 9.84,
    "l": 16.429
   }
  },
  "Industrie": {
   "p": {
    "s": 4.618,
    "m": 6.061,
    "l": 7.839
   },
   "sb": {
    "s": 0.483,
    "m": 0.742,
    "l": 1.011
   },
   "e": {
    "s": 4.521,
    "m": 7.88,
    "l": 12.79
   }
  },
  "Lager": {
   "p": {
    "s": 0.167,
    "m": 0.234,
    "l": 0.301
   },
   "sb": {
    "s": 0.167,
    "m": 0.234,
    "l": 0.301
   },
   "e": {
    "s": 1.464,
    "m": 2.051,
    "l": 2.639
   }
  },
  "Sportbauten": {
   "p": {
    "s": 4.302,
    "m": 5.479,
    "l": 6.826
   },
   "sb": {
    "s": 0.258,
    "m": 0.366,
    "l": 0.484
   },
   "e": {
    "s": 2.452,
    "m": 3.979,
    "l": 6.337
   }
  },
  "Hallenbad": {
   "p": {
    "s": 4.632,
    "m": 6.044,
    "l": 7.616
   },
   "sb": {
    "s": 0.483,
    "m": 0.826,
    "l": 1.169
   },
   "e": {
    "s": 4.719,
    "m": 8.531,
    "l": 13.087
   }
  },
  "Parkhaus": {
   "p": {
    "s": 0.313,
    "m": 0.579,
    "l": 0.998
   },
   "sb": {
    "s": 0.221,
    "m": 0.368,
    "l": 0.505
   },
   "e": {
    "s": 2.032,
    "m": 3.852,
    "l": 6.305
   }
  }
 },
 "heating": {
  "Wohnen MFH": {
   "p": {
    "sole": 4.268,
    "luft": 6.046,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 8.288,
    "luft": 11.742,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Wohnen EFH": {
   "p": {
    "sole": 5.385,
    "luft": 7.629,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 10.576,
    "luft": 14.983,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Hotel": {
   "p": {
    "sole": 4.163,
    "luft": 5.898,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 10.587,
    "luft": 14.998,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Büro": {
   "p": {
    "sole": 4.348,
    "luft": 6.159,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 3.294,
    "luft": 4.667,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Schule": {
   "p": {
    "sole": 4.672,
    "luft": 6.619,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 5.023,
    "luft": 7.116,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Hochschule": {
   "p": {
    "sole": 4.249,
    "luft": 6.02,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 3.978,
    "luft": 5.635,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Verkauf": {
   "p": {
    "sole": 2.725,
    "luft": 3.86,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 1.755,
    "luft": 2.486,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Verkauf (Food)": {
   "p": {
    "sole": 2.664,
    "luft": 3.774,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 1.683,
    "luft": 2.385,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Restaurant": {
   "p": {
    "sole": 4.06,
    "luft": 5.751,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 19.946,
    "luft": 28.258,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Versammlung": {
   "p": {
    "sole": 4.719,
    "luft": 6.685,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 3.506,
    "luft": 4.967,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Spital": {
   "p": {
    "sole": 4.444,
    "luft": 6.296,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 9.968,
    "luft": 14.121,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Industrie": {
   "p": {
    "sole": 4.781,
    "luft": 6.772,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 3.248,
    "luft": 4.601,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Lager": {
   "p": {
    "sole": 4.8,
    "luft": 6.8,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 2.216,
    "luft": 3.139,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Sportbauten": {
   "p": {
    "sole": 4.654,
    "luft": 6.594,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 16.99,
    "luft": 24.069,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Hallenbad": {
   "p": {
    "sole": 5.631,
    "luft": 7.977,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 33.624,
    "luft": 47.633,
    "oel": 0.8,
    "keine": 0
   }
  },
  "Parkhaus": {
   "p": {
    "sole": 1.682,
    "luft": 2.383,
    "oel": 0.32,
    "keine": 0
   },
   "e": {
    "sole": 0.266,
    "luft": 0.377,
    "oel": 0.8,
    "keine": 0
   }
  }
 },
 "ventilation": {
  "Wohnen MFH": {
   "p": {
    "gw": 0.245,
    "zw": 0.145,
    "keine": 0
   },
   "e": {
    "gw": 1.481,
    "zw": 0.656,
    "keine": 0
   }
  },
  "Wohnen EFH": {
   "p": {
    "gw": 0.165,
    "zw": 0.098,
    "keine": 0
   },
   "e": {
    "gw": 0.971,
    "zw": 0.423,
    "keine": 0
   }
  },
  "Hotel": {
   "p": {
    "gw": 1.748,
    "zw": 1.085,
    "keine": 0
   },
   "e": {
    "gw": 5.384,
    "zw": 2.493,
    "keine": 0
   }
  },
  "Büro": {
   "p": {
    "gw": 1.795,
    "zw": 1.12,
    "keine": 0
   },
   "e": {
    "gw": 3.934,
    "zw": 1.51,
    "keine": 0
   }
  },
  "Schule": {
   "p": {
    "gw": 2.041,
    "zw": 1.294,
    "keine": 0
   },
   "e": {
    "gw": 3.452,
    "zw": 1.635,
    "keine": 0
   }
  },
  "Hochschule": {
   "p": {
    "gw": 3.034,
    "zw": 1.903,
    "keine": 0
   },
   "e": {
    "gw": 4.913,
    "zw": 2.548,
    "keine": 0
   }
  },
  "Verkauf": {
   "p": {
    "gw": 1.7,
    "zw": 1.058,
    "keine": 0
   },
   "e": {
    "gw": 5.825,
    "zw": 1.5,
    "keine": 0
   }
  },
  "Verkauf (Food)": {
   "p": {
    "gw": 1.697,
    "zw": 1.056,
    "keine": 0
   },
   "e": {
    "gw": 5.816,
    "zw": 1.498,
    "keine": 0
   }
  },
  "Restaurant": {
   "p": {
    "gw": 6.604,
    "zw": 4.123,
    "keine": 0
   },
   "e": {
    "gw": 11.331,
    "zw": 6.723,
    "keine": 0
   }
  },
  "Versammlung": {
   "p": {
    "gw": 4.454,
    "zw": 2.78,
    "keine": 0
   },
   "e": {
    "gw": 10.485,
    "zw": 6.177,
    "keine": 0
   }
  },
  "Spital": {
   "p": {
    "gw": 1.833,
    "zw": 1.142,
    "keine": 0
   },
   "e": {
    "gw": 6.777,
    "zw": 3.707,
    "keine": 0
   }
  },
  "Industrie": {
   "p": {
    "gw": 3.691,
    "zw": 2.306,
    "keine": 0
   },
   "e": {
    "gw": 7.554,
    "zw": 3.829,
    "keine": 0
   }
  },
  "Lager": {
   "p": {
    "gw": 0.642,
    "zw": 0.405,
    "keine": 0
   },
   "e": {
    "gw": 2.625,
    "zw": 0.971,
    "keine": 0
   }
  },
  "Sportbauten": {
   "p": {
    "gw": 1.967,
    "zw": 1.212,
    "keine": 0
   },
   "e": {
    "gw": 4.588,
    "zw": 2.19,
    "keine": 0
   }
  },
  "Hallenbad": {
   "p": {
    "gw": 1.626,
    "zw": 1.003,
    "keine": 0
   },
   "e": {
    "gw": 4.814,
    "zw": 2.245,
    "keine": 0
   }
  },
  "Parkhaus": {
   "p": {
    "gw": 0.567,
    "zw": 0.338,
    "keine": 0
   },
   "e": {
    "gw": 2.112,
    "zw": 0.671,
    "keine": 0
   }
  }
 },
 "cooling": {
  "Wohnen MFH": {
   "p": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   },
   "e": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   }
  },
  "Wohnen EFH": {
   "p": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   },
   "e": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   }
  },
  "Hotel": {
   "p": {
    "bestand": 18.9,
    "gw": 13.15,
    "zw": 9.85,
    "keine": 0
   },
   "e": {
    "bestand": 2.905,
    "gw": 7.735,
    "zw": 7.665,
    "keine": 0
   }
  },
  "Büro": {
   "p": {
    "bestand": 26.37,
    "gw": 18.91,
    "zw": 13.66,
    "keine": 0
   },
   "e": {
    "bestand": 14.115,
    "gw": 16.388,
    "zw": 10.686,
    "keine": 0
   }
  },
  "Schule": {
   "p": {
    "bestand": 28.08,
    "gw": 21.57,
    "zw": 17.97,
    "keine": 0
   },
   "e": {
    "bestand": 3.139,
    "gw": 9.528,
    "zw": 9.553,
    "keine": 0
   }
  },
  "Hochschule": {
   "p": {
    "bestand": 31.37,
    "gw": 24.11,
    "zw": 18.71,
    "keine": 0
   },
   "e": {
    "bestand": 12.81,
    "gw": 16.788,
    "zw": 14.781,
    "keine": 0
   }
  },
  "Verkauf": {
   "p": {
    "bestand": 29.5,
    "gw": 25.95,
    "zw": 16.6,
    "keine": 0
   },
   "e": {
    "bestand": 22.165,
    "gw": 53.825,
    "zw": 31.68,
    "keine": 0
   }
  },
  "Verkauf (Food)": {
   "p": {
    "bestand": 1.9,
    "gw": 1.35,
    "zw": 1,
    "keine": 0
   },
   "e": {
    "bestand": 0.385,
    "gw": 0.665,
    "zw": 0.54,
    "keine": 0
   }
  },
  "Restaurant": {
   "p": {
    "bestand": 41.9,
    "gw": 36.25,
    "zw": 29.2,
    "keine": 0
   },
   "e": {
    "bestand": 19.035,
    "gw": 38.425,
    "zw": 42.25,
    "keine": 0
   }
  },
  "Versammlung": {
   "p": {
    "bestand": 32.7,
    "gw": 25.15,
    "zw": 20.2,
    "keine": 0
   },
   "e": {
    "bestand": 4.625,
    "gw": 13.545,
    "zw": 19.02,
    "keine": 0
   }
  },
  "Spital": {
   "p": {
    "bestand": 26.2,
    "gw": 19.95,
    "zw": 15.1,
    "keine": 0
   },
   "e": {
    "bestand": 8.505,
    "gw": 16.42,
    "zw": 15.035,
    "keine": 0
   }
  },
  "Industrie": {
   "p": {
    "bestand": 27.7,
    "gw": 20.25,
    "zw": 13.1,
    "keine": 0
   },
   "e": {
    "bestand": 3.655,
    "gw": 8.555,
    "zw": 7.5,
    "keine": 0
   }
  },
  "Lager": {
   "p": {
    "bestand": 1.9,
    "gw": 1.35,
    "zw": 1,
    "keine": 0
   },
   "e": {
    "bestand": 0.385,
    "gw": 0.665,
    "zw": 0.54,
    "keine": 0
   }
  },
  "Sportbauten": {
   "p": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   },
   "e": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   }
  },
  "Hallenbad": {
   "p": {
    "bestand": 1.9,
    "gw": 1.35,
    "zw": 1,
    "keine": 0
   },
   "e": {
    "bestand": 0.385,
    "gw": 0.665,
    "zw": 0.54,
    "keine": 0
   }
  },
  "Parkhaus": {
   "p": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   },
   "e": {
    "bestand": 0,
    "gw": 0,
    "zw": 0,
    "keine": 0
   }
  }
 }
};
export const SIA_REFERENCE_KCOR:Readonly<Record<string,{min:number;mid:number;max:number;siaKat:string}>> = {
 "Wohnen MFH": {
  "min": 1,
  "mid": 1,
  "max": 1,
  "siaKat": "I – Wohnen MFH"
 },
 "Wohnen EFH": {
  "min": 1,
  "mid": 1,
  "max": 1,
  "siaKat": "II – Wohnen EFH"
 },
 "Büro": {
  "min": 0.6,
  "mid": 0.7,
  "max": 0.8,
  "siaKat": "III – Verwaltung"
 },
 "Hotel": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "analog VII – Versammlung"
 },
 "Schule": {
  "min": 0.7,
  "mid": 0.8,
  "max": 0.9,
  "siaKat": "IV – Schule"
 },
 "Hochschule": {
  "min": 0.7,
  "mid": 0.8,
  "max": 0.9,
  "siaKat": "analog IV – Schule"
 },
 "Verkauf": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "V – Verkauf"
 },
 "Verkauf (Food)": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "analog V – Verkauf"
 },
 "Restaurant": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "VI – Restaurant"
 },
 "Versammlung": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "VII – Versammlungslokal"
 },
 "Spital": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "VIII – Spital"
 },
 "Industrie": {
  "min": 1,
  "mid": 1,
  "max": 1,
  "siaKat": "IX – Industrie"
 },
 "Lager": {
  "min": 0.7,
  "mid": 0.8,
  "max": 0.9,
  "siaKat": "X – Lager"
 },
 "Sportbauten": {
  "min": 0.7,
  "mid": 0.8,
  "max": 0.9,
  "siaKat": "XI – Sportbaute"
 },
 "Hallenbad": {
  "min": 0.8,
  "mid": 0.85,
  "max": 0.9,
  "siaKat": "XII – Hallenbad"
 },
 "Parkhaus": {
  "min": 0.7,
  "mid": 0.8,
  "max": 0.9,
  "siaKat": "analog X – Lager"
 }
};
export const SIA_REFERENCE_GLZ:Readonly<Record<string,number>> = {
 "Wohnen MFH": 0.8,
 "Wohnen EFH": 0.8,
 "Hotel": 0.7,
 "Büro": 0.8,
 "Schule": 0.7,
 "Hochschule": 0.7,
 "Verkauf": 0.8,
 "Verkauf (Food)": 0.8,
 "Restaurant": 0.8,
 "Versammlung": 0.8,
 "Spital": 0.8,
 "Industrie": 0.8,
 "Lager": 0.8,
 "Sportbauten": 0.7,
 "Hallenbad": 0.8,
 "Parkhaus": 0.8
};
export const SIA_REFERENCE_PV:Readonly<Record<string,number>> = {
 "sued30": 1.17,
 "sued45": 1.155,
 "sued90": 0.85,
 "sosw30": 1.1,
 "ow30": 0.95,
 "flach15sued": 1.105
};
export const SIA_REFERENCE_CLIMATE:Readonly<Record<string,number>> = {
 "mittelland": 1104.26,
 "juranordfuss": 1059,
 "alpen": 991,
 "tessin": 1414,
 "wallis": 1441,
 "graubuenden": 1188
};
