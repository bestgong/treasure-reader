// 简化版真实世界地图（大陆板块 SVG path）
// 来源：Natural Earth 110m 简化版，手工精简至适合童趣风格
// 坐标系：viewBox 0 0 1000 500，Robinson 投影近似
// 已解锁国家的位置以 percent 坐标标注在 worldMap 中

export const worldMapSVG = `
<svg viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" class="world-svg" aria-hidden="true">
  <defs>
    <linearGradient id="ocean-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8f4f8"/>
      <stop offset="100%" stop-color="#c4e0e8"/>
    </linearGradient>
    <radialGradient id="glow-red" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#e94560" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#ffb6b9" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffb6b9" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-gold" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#e9b949" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#f4d47a" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#f4d47a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="paper-tex" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#fdf6ec"/>
      <circle cx="4" cy="4" r="0.4" fill="#e5d5b8" opacity="0.4"/>
    </pattern>
  </defs>

  <!-- 海洋背景 -->
  <rect width="1000" height="500" fill="url(#ocean-grad)"/>

  <!-- 经纬网格（淡） -->
  <g stroke="#a0c4d0" stroke-width="0.4" opacity="0.35" fill="none">
    <line x1="0" y1="125" x2="1000" y2="125"/>
    <line x1="0" y1="250" x2="1000" y2="250"/>
    <line x1="0" y1="375" x2="1000" y2="375"/>
    <line x1="250" y1="0" x2="250" y2="500"/>
    <line x1="500" y1="0" x2="500" y2="500"/>
    <line x1="750" y1="0" x2="750" y2="500"/>
  </g>

  <!-- 大陆板块（手绘简化风） -->
  <g id="continents" fill="url(#paper-tex)" stroke="#8a7355" stroke-width="1.2" stroke-linejoin="round">
    <!-- 北美 -->
    <path d="M 60,110 Q 90,80 140,90 L 200,100 Q 240,110 260,140 L 250,180 Q 230,200 210,210 L 180,230 Q 150,240 130,230 L 100,220 Q 70,210 55,180 L 50,150 Z"/>
    <!-- 中美+加勒比 -->
    <path d="M 180,240 Q 210,245 230,260 L 240,285 Q 235,300 220,305 L 200,300 Q 185,285 180,260 Z"/>
    <!-- 南美 -->
    <path d="M 240,290 Q 275,285 305,310 L 320,360 Q 315,420 290,450 L 265,460 Q 250,440 245,410 L 240,370 Q 235,330 240,290 Z"/>
    <!-- 欧洲 -->
    <path d="M 465,120 Q 490,110 520,115 L 555,130 Q 570,150 560,175 L 540,195 Q 510,205 485,200 L 460,190 Q 445,170 455,145 Z"/>
    <!-- 北非 -->
    <path d="M 475,205 Q 520,200 560,215 L 595,240 Q 605,270 590,290 L 555,300 Q 520,300 490,285 L 465,265 Q 455,235 470,215 Z"/>
    <!-- 南非 -->
    <path d="M 495,300 Q 540,295 575,315 L 590,355 Q 585,395 560,420 L 530,420 Q 505,405 495,375 L 490,340 Z"/>
    <!-- 中东 -->
    <path d="M 570,205 Q 605,200 635,220 L 645,250 Q 635,275 605,280 L 580,265 Q 565,240 570,215 Z"/>
    <!-- 俄罗斯/北亚 -->
    <path d="M 560,90 Q 620,75 720,85 L 830,95 Q 870,110 875,135 L 860,155 Q 800,165 720,160 L 640,155 Q 590,150 565,135 Z"/>
    <!-- 东亚/中国 -->
    <path d="M 720,170 Q 780,165 830,180 L 855,215 Q 845,240 815,250 L 770,245 Q 730,235 715,210 Z"/>
    <!-- 印度次大陆 -->
    <path d="M 680,235 Q 715,235 730,260 L 725,290 Q 705,305 685,295 L 670,270 Z"/>
    <!-- 东南亚 -->
    <path d="M 780,265 Q 810,265 830,285 L 835,315 Q 815,325 795,315 L 780,290 Z"/>
    <!-- 日本群岛 -->
    <path d="M 862,190 Q 878,185 885,200 L 883,220 Q 872,230 865,215 Z"/>
    <path d="M 855,225 Q 866,225 870,240 L 863,255 Q 852,250 852,235 Z"/>
    <!-- 澳大利亚 -->
    <path d="M 810,355 Q 855,350 890,365 L 900,395 Q 885,415 850,415 L 815,410 Q 795,390 805,365 Z"/>
    <!-- 新西兰 -->
    <path d="M 915,420 Q 930,418 935,432 L 928,442 Q 918,438 915,425 Z"/>
    <!-- 英国爱尔兰 -->
    <path d="M 458,125 Q 470,120 475,135 L 470,155 Q 460,158 456,145 Z"/>
    <!-- 冰岛 -->
    <path d="M 435,100 Q 448,98 452,108 L 448,118 Q 438,116 436,108 Z" opacity="0.7"/>
    <!-- 马达加斯加 -->
    <path d="M 605,335 Q 618,335 622,360 L 615,380 Q 605,375 603,355 Z"/>
  </g>
</svg>
`;

// 已解锁国家的坐标（针对 viewBox 1000x500）
// 与 worldMap 的 x/y 百分比联动：svgX = x * 10, svgY = y * 5
export function pctToSVG(xPct, yPct) {
  return { x: xPct * 10, y: yPct * 5 };
}
