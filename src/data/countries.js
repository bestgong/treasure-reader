// 国家注册表：每新增一本《寻宝记》只需在这里 import 并注册
import { japanData } from './japan.js';
import { greeceData } from './greece.js';

// 未来扩展示例：
// import { egyptData } from './egypt.js';
// import { usaData } from './usa.js';

export const countries = {
  japan: japanData,
  greece: greeceData,
  // egypt: egyptData,     // 解锁条件：用户购买后
  // usa: usaData,
};

// 世界地图上所有可显示的国家位置（用经纬度近似的相对坐标，左上为 0,0）
// 即使没买的国家也会在地图上以"待解锁"状态显示
export const worldMap = [
  { id: 'usa',     name: '美国',   nameEn: 'USA',     flag: '🇺🇸', x: 18, y: 38, available: false },
  { id: 'mexico',  name: '墨西哥', nameEn: 'Mexico',  flag: '🇲🇽', x: 20, y: 50, available: false },
  { id: 'brazil',  name: '巴西',   nameEn: 'Brazil',  flag: '🇧🇷', x: 32, y: 65, available: false },
  { id: 'uk',      name: '英国',   nameEn: 'UK',      flag: '🇬🇧', x: 47, y: 32, available: false },
  { id: 'france',  name: '法国',   nameEn: 'France',  flag: '🇫🇷', x: 49, y: 38, available: false },
  { id: 'germany', name: '德国',   nameEn: 'Germany', flag: '🇩🇪', x: 51, y: 35, available: false },
  { id: 'italy',   name: '意大利', nameEn: 'Italy',   flag: '🇮🇹', x: 52, y: 42, available: false },
  { id: 'spain',   name: '西班牙', nameEn: 'Spain',   flag: '🇪🇸', x: 46, y: 43, available: false },
  { id: 'greece',  name: '希腊',   nameEn: 'Greece',  flag: '🇬🇷', x: 55, y: 44, available: true  },
  { id: 'egypt',   name: '埃及',   nameEn: 'Egypt',   flag: '🇪🇬', x: 57, y: 48, available: false },
  { id: 'turkey',  name: '土耳其', nameEn: 'Turkey',  flag: '🇹🇷', x: 58, y: 42, available: false },
  { id: 'india',   name: '印度',   nameEn: 'India',   flag: '🇮🇳', x: 68, y: 50, available: false },
  { id: 'china',   name: '中国',   nameEn: 'China',   flag: '🇨🇳', x: 76, y: 42, available: false },
  { id: 'japan',   name: '日本',   nameEn: 'Japan',   flag: '🇯🇵', x: 84, y: 41, available: true  },
  { id: 'thailand',name: '泰国',   nameEn: 'Thailand',flag: '🇹🇭', x: 75, y: 53, available: false },
  { id: 'australia',name:'澳大利亚',nameEn:'Australia',flag: '🇦🇺', x: 84, y: 70, available: false },
  { id: 'russia',  name: '俄罗斯', nameEn: 'Russia',  flag: '🇷🇺', x: 65, y: 28, available: false },
];

// 系列主角图鉴（跨国家累积）
export const seriesCharacters = [
  { id: 'buka', name: '布卡', emoji: '🧒', desc: '13 岁寻宝王，蓝色刺猬头，叔叔是知本教授', unlockBy: 'japan' },
  { id: 'fengbaba', name: '峰巴巴', emoji: '🦹', desc: '系列主要反派，专门盗取文物', unlockBy: 'japan' },
  { id: 'fukunan', name: '金福男', emoji: '👦', desc: '韩裔日本人，日本篇的小伙伴', unlockBy: 'japan' },
  { id: 'koharu', name: '小燕子', emoji: '🥷', desc: '京之花的忍者保镖', unlockBy: 'japan' },
  { id: 'mike', name: '麦克', emoji: '👦', desc: '布卡的劲敌兼好朋友，智商 180', unlockBy: 'greece' },
  { id: 'maoprof', name: '毛教授', emoji: '👨‍🏫', desc: '日本考古学家', unlockBy: 'japan' },
  { id: 'hailing', name: '海铃', emoji: '👧', desc: '威廉博士的女儿，希腊文化研究所小研究员', unlockBy: 'greece' },
  { id: 'william', name: '威廉博士', emoji: '👨‍🔬', desc: '古文物鉴定专家', unlockBy: 'greece' },
  { id: 'paolo', name: '保罗爷爷', emoji: '👴', desc: '雅典老博物馆员，熟知老城区每条小巷', unlockBy: 'greece' },
];

// 国宝收集册
export const treasureGallery = [
  { id: 'japan', name: '七支刀', icon: '🗡️', country: '日本', desc: '1600 年前韩国百济赠给日本的国宝' },
  { id: 'egypt', name: '法老黄金面具', icon: '👑', country: '埃及', desc: '待解锁——购买《埃及寻宝记》' },
  { id: 'greece', name: '黄金双耳瓶', icon: '🏺', country: '希腊', desc: '画着海克力斯十二项功绩的国宝级双耳陶瓶' },
  { id: 'usa', name: '印第安神秘宝藏', icon: '🪶', country: '美国', desc: '待解锁——购买《美国寻宝记》' },
];
