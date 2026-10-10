/* Positions on the illustrated V11 plate, NOT longitude/latitude. Initial-era
   artwork unchanged; later-era labels are badges, not painted terrain.
   Route mileage is stored independently in sea-distances.js.
   See source/V11-落点与航程核对.md for low-confidence identifications. */
// 41 user-adjusted anchors merged from the exported placement JSON; other anchors unchanged.
window.EARTHSEA_PLACEMENT = {
  anchors: {
    '01-01':[.500,.408], // central black tower / harbor
    '01-02':[0.1925,0.53385],
    '01-11':[0.20229,0.81104],
    '01-12':[0.64547,0.92171],
    '01-15':[0.89756,0.14072],
    '01-03':[0.49521,0.2939],
    '01-04':[0.52445,0.25916],
    '01-08':[0.11889,0.25001],
    '01-09':[.437,.580], // southern wooded island, tentative
    '01-10':[0.49688,0.55941],
    '01-16':[0.14045,0.3385],
    '01-17':[0.06797,0.32597],
    '01-18':[.083,.744], // western workshop-island candidate; tentative
    '02-01':[.552,.693], // two-curved rocky capes suggest crab outline; tentative
    '02-02':[0.43758,0.86064],
    '02-06':[0.5593,0.92106],
    '03-04':[.744,.599], // treed island north of Hope; nautical miles not to scale
    '03-05':[0.73775,0.77871],
    '03-06':[0.79955,0.80461],
    '02-04':[0.85144,0.40252],
    '02-05':[.912,.839], // southeast sea REGION, not an island
    '02-07':[0.44313,0.77554],
    '02-08':[0.6579,0.16316],
    '03-01':[0.38077,0.18477],
    '04-01':[0.8531,0.60547],
    '04-02':[0.87937,0.50206],
    '04-03':[0.76817,0.46981],
    '04-05':[0.29855,0.60449],
    '04-06':[0.17314,0.66793],
    '05-01':[0.81558,0.55088],
    '05-05':[.711,.376], // metal human figure, east of Coral
    '05-06':[.935,.773], // submerged REGION in eastern sea
    '05-10':[.894,.275], // large white palace island, regional attribution disputed
    '05-11':[.456,.356], // spell network entry point in the CENTER Coral Island city
    '06-06':[0.80468,0.85672],
    '07-04':[0.0888,0.44438],
    // Sea-story anchors only. Uncharted and other-realm badges are chart-edge symbols.
    '02-03':[.949,.884], // bright island: mist-sea symbolic hint, not a surveyed coast
    '04-04':[.803,.437], // linked to the sea-otter Angle; not a sailing destination
    '07-01':[.477,.880], // above Hope Island's dome, not at the giant pit
    '07-02':[.846,.864], // sea battle, mobile target; no fixed route
    '07-03':[.950,.736], // ocean/sky facility, exterior position uncharted
    '08-07':[.910,.956], // conceptual chart-edge, not a geographic position
    '07-07':[0.035,0.185], // ice-sea upper-left margin; symbolic sighting, not a navigable island
    '08-02':[0.08946,0.13011], // hand-adjusted ice-sea subnode
    '08-10':[0.73502,0.93127],
    '07-05':[0.09414,0.05936],
    '08-11':[0.16245,0.09486],
    '08-12':[0.14003,0.91145],
    /* Ships below are sighting icons at DIFFERENT painted hulls. Their coordinates
       are not their real positions and are never route endpoints. */
    '01-05':[.285,.264], // cargo ship northwest of center
    '01-06':[0.3213,0.34029],
    '03-08':[0.4431,0.16265],
    '03-09':[0.68334,0.50534],
    '05-12':[0.39637,0.95738],
    '08-06':[0.044,0.563], // painted small hull southwest of golden statue
    '01-07':[0.33958,0.42316],
    '01-13':[.767,.042], // far northeast ship
    '01-14':[.905,.632], // pin on large moving ship-city hull, not a tiny border boat
    '02-09':[0.60848,0.458],
    '02-10':[0.60649,0.32283],
    '02-11':[.687,.812], // ship on lower right edge
    '04-07':[.532,.792], // ship at lower middle
    '07-06':[0.27652,0.52807]
  },
  // These 23 anchors are illustrative. Later/cross-layer entries remain on the initial-era plate.
  tentative: ['01-06','01-11','01-12','01-15','02-02','02-06','03-01','03-04','03-05','03-06','03-08','03-09','04-05','04-06','05-01','05-10','05-11','05-12','06-06','07-04','07-07','08-06','08-10'],
  routes: [
    {id:'north',name:'老鼠岛探索航程',kind:'explore',stops:['01-01','01-03'],via:[[[.445,.280]]]},
    {id:'dark',name:'暗晶岛迷航',kind:'explore',stops:['01-01','01-08'],via:[[[.270,.290]]]},
    {id:'gold',name:'金雕像岛死寂航程',kind:'explore',stops:['01-01','01-02'],via:[[[.338,.442]]]},
    {id:'south',name:'南方远征航线',kind:'explore',stops:['01-01','01-09','02-01','02-02'],via:[[[.478,.490]],[[.520,.646]],[[.480,.786]]]},
    {id:'south-direct',name:'南下天水岛（船队航程）',kind:'explore',stops:['01-01','02-01'],via:[[[.512,.552]]]},
    {id:'gate',name:'希望岛北航葫芦岛',kind:'explore',stops:['02-02','03-04'],via:[[]]},
    {id:'east-metal',name:'东海域铁像岛航线',kind:'trade',stops:['01-01','05-05'],via:[[[.605,.365]]],inferred:true}
  ]
};












