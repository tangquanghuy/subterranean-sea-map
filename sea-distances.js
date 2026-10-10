/* Voyage estimates use narrated sailing time, not painted positions. A fleet
   planning pace of 60 nm/day (roughly 2.5 kn averaged over a whole day)
   includes slow sailing, stops and detours. 'Month-plus' is modelled as 35
   elapsed days; all estimates are ranges, not surveyed geography. */
window.EARTHSEA_DISTANCES = {
  '01-01|01-03': {nauticalMiles:525, range:[420,630], estimated:true, days:7, qualifier:'约', vessel:'单船', source:'方位图·航线距离表；01-03-老鼠岛.md', basis:'7天 × 单船约75海里/天'},
  '01-01|01-08': {nauticalMiles:900, range:[675,1125], estimated:true, days:15, qualifier:'约', vessel:'迷航单船', source:'方位图·航线距离表；01-08-暗晶岛.md', basis:'15天 × 迷航约60海里/天；航行里程含绕航'},
  '01-01|01-02': {nauticalMiles:280, range:[180,400], estimated:true, duration:'数日', source:'方位图·航线距离表', basis:'数日按约4天、每天70海里估计'},
  '01-01|01-09': {nauticalMiles:300, range:[200,500], estimated:true, source:'方位图·南线第一站，无分段航时；南线整段月余', basis:'南线第一站暂分配约300海里；无原文分段里程'},
  '01-09|02-01': {nauticalMiles:1800, range:[1300,2400], estimated:true, source:'方位图·南线船队月余；第一站至天水岛无分段航时', basis:'珊瑚岛至天水岛整段约2100海里，减第一站暂分配300海里'},
  '01-01|02-01': {nauticalMiles:2100, range:[1600,2700], estimated:true, duration:'月余', vessel:'船队', source:'方位图·航线距离表；整段到天水岛', basis:'月余按约35天、船队平均60海里/天估计；含停靠与绕航'},
  '02-01|02-02': {nauticalMiles:225, range:[180,270], estimated:true, days:3, vessel:'单船', source:'方位图·航线距离表', basis:'3天 × 单船约75海里/天'},
  '02-02|03-04': {nauticalMiles:700, source:'方位图·航线距离表；03-04-葫芦岛.md，光明之地/希望岛北航'},
  '01-01|05-05': {nauticalMiles:650, range:[450,900], estimated:true, source:'方位图·东海域铁像岛航线〔推测〕；无原文距离', basis:'参照希望岛北航700海里作为远海航段量级；航路与里程均为推测'}
};
/* 门坐标外海→泡泡岛约50海里；68号旧坐标→深渊海沟5海里，
   两者不属于当前路网的固定岛屿端点。 */
