// 分辨率映射表
const resolutionMap = {
  1: { width: 1920, height: 1080, desc: '1080p' },
  2: { width: 1920, height: 1080, desc: '1080i' },
  3: { width: 1280, height: 720, desc: '720p' },
  5: { width: 640, height: 480, desc: 'SD' },
  6: { width: 3840, height: 2160, desc: '4K' },
  7: { width: 7680, height: 4320, desc: '8K' }
};

const BYTES_PER_GB = 1024 ** 3;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSizeGB(torrent) {
  return toNumber(torrent.size) / BYTES_PER_GB;
}

function getSeeders(torrent) {
  return toNumber(torrent.status?.seeders);
}

// Seeder 对下载体验的提升存在明显边际递减。
// 50 个以上通常已经足够健康，不再按数量线性加分。
function getSeederScore(seeders) {
  if (seeders <= 0) return -100;
  if (seeders === 1) return -30;
  if (seeders <= 4) return -15;
  if (seeders <= 9) return 0;
  if (seeders <= 19) return 10;
  if (seeders <= 49) return 20;
  return 25;
}

function getResolutionScore(standard) {
  switch (standard) {
    case 1: // 1080p
      return 30;
    case 2: // 1080i
      return 10;
    case 6: // 4K
      return 10;
    case 3: // 720p
      return -20;
    case 5: // SD
      return -50;
    case 7: // 8K
      return -20;
    default:
      return 0;
  }
}

function getSourceAndCodecScore(name) {
  let score = 0;

  // 来源：日常观看优先 WEB-DL，其次普通 BluRay Encode；REMUX 对非收藏场景性价比较低。
  if (/\bweb[ ._-]?dl\b/i.test(name)) score += 25;
  if (/\bblu[ ._-]?ray\b|\bbluray\b/i.test(name)) score += 15;
  if (/\bremux\b/i.test(name)) score -= 30;

  // 编码：HEVC/H.265 在同等主观画质下通常比 AVC/H.264 更节省体积。
  if (/\b(?:h[ ._-]?265|hevc|x265)\b/i.test(name)) score += 20;
  else if (/\b(?:h[ ._-]?264|avc|x264)\b/i.test(name)) score += 10;

  // 没有 HDR 设备时，这些规格不会带来明显收益；只做轻微惩罚，避免覆盖其它更重要因素。
  if (/\b(?:hdr10\+?|hdr|dovi|dolby[ ._-]?vision|dv)\b/i.test(name)) score -= 5;

  // HFR/60fps 往往显著增加码率，但普通电影观看场景通常不需要优先追求。
  if (/\b(?:hfr|60\s?fps|60fps)\b/i.test(name)) score -= 5;

  // 明显的低质量片源直接降权。
  if (/\b(?:cam|telesync|telecine)\b/i.test(name)) score -= 50;

  return score;
}

// 文件体积不是画质本身，但可以用来排除“过度压缩”和“明显规格过剩”的版本。
// 这里针对日常电影观看设置 sweet spot，并结合分辨率避免奖励 3GB 左右的 4K 极低码率版本。
function getSizeScore(sizeGB, standard) {
  if (sizeGB <= 0) return -50;

  if (standard === 1) { // 1080p
    if (sizeGB < 2) return -20;
    if (sizeGB < 3) return 5;
    if (sizeGB <= 8) return 25;
    if (sizeGB <= 12) return 15;
    if (sizeGB <= 20) return 0;
    return -20;
  }

  if (standard === 6) { // 4K
    if (sizeGB < 4) return -25;
    if (sizeGB < 5) return -10;
    if (sizeGB <= 12) return 10;
    if (sizeGB <= 20) return 5;
    return -15;
  }

  // 未知分辨率或其它类型采用较宽松的通用区间。
  if (sizeGB < 1.5) return -20;
  if (sizeGB <= 8) return 15;
  if (sizeGB <= 12) return 10;
  if (sizeGB <= 20) return 0;
  return -15;
}

// 面向“日常观看”的综合适配度评分：
// 1080p / WEB-DL / HEVC / 合理体积 / 健康做种优先。
// 这不是绝对画质评分，而是 suitability score。
export function calculateSuitabilityScore(torrent) {
  const standard = parseInt(torrent.standard, 10);
  const name = torrent.name || '';
  const sizeGB = getSizeGB(torrent);
  const seeders = getSeeders(torrent);

  return (
    getResolutionScore(standard) +
    getSourceAndCodecScore(name) +
    getSizeScore(sizeGB, standard) +
    getSeederScore(seeders)
  );
}

// 综合平衡策略。相同分数时优先更多做种；再次相同则选更小文件。
export function balanced(torrents) {
  let bestTorrent = null;
  let bestScore = -Infinity;

  for (const torrent of torrents) {
    const score = calculateSuitabilityScore(torrent);

    if (
      score > bestScore ||
      (score === bestScore && bestTorrent && getSeeders(torrent) > getSeeders(bestTorrent)) ||
      (score === bestScore && bestTorrent && getSeeders(torrent) === getSeeders(bestTorrent) && toNumber(torrent.size) < toNumber(bestTorrent.size))
    ) {
      bestScore = score;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 最高像素密度的旧策略。
// 保留兼容性，但不再推荐：它会偏爱“高分辨率 + 极小文件”的过度压缩版本。
export function highestPixelDensity(torrents) {
  let bestTorrent = null;
  let bestRatio = 0;

  for (const torrent of torrents) {
    const standard = parseInt(torrent.standard, 10);
    const size = toNumber(torrent.size);

    if (resolutionMap[standard] && size > 0) {
      const resolution = resolutionMap[standard];
      const pixels = resolution.width * resolution.height;
      const ratio = pixels / size;

      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestTorrent = torrent;
      }
    }
  }

  return bestTorrent;
}

// 最小文件体积的策略：适合只追求最短下载时间/最低空间占用的场景。
export function smallestSize(torrents) {
  let bestTorrent = null;
  let smallestSize = Infinity;

  for (const torrent of torrents) {
    const size = toNumber(torrent.size);
    if (size > 0 && size < smallestSize) {
      smallestSize = size;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 最大文件体积的策略：只代表最大文件，不等价于最高视频画质。
export function largestSize(torrents) {
  let bestTorrent = null;
  let largestSize = 0;

  for (const torrent of torrents) {
    const size = toNumber(torrent.size);
    if (size > largestSize) {
      largestSize = size;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 最多做种数量的策略：更准确地说是选择 swarm 最健康的资源，不保证绝对下载速度最快。
export function mostSeeders(torrents) {
  let bestTorrent = null;
  let maxSeeders = -1;

  for (const torrent of torrents) {
    const seeders = getSeeders(torrent);
    if (seeders > maxSeeders) {
      maxSeeders = seeders;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 默认策略选择器。
// 同时兼容 README 旧版的小写名称和代码中的旧版 PascalCase 名称。
export function selectBestTorrent(torrents, strategy = 'balanced') {
  const strategies = {
    balanced,
    bestMatch: balanced,
    Balanced: balanced,
    BestMatch: balanced,

    mostSeeders,
    MostSeeder: mostSeeders,
    MostSeeders: mostSeeders,

    smallestSize,
    SmallestSize: smallestSize,

    largestSize,
    LargestSize: largestSize,

    highestPixelDensity,
    HighestPixelDensity: highestPixelDensity
  };

  const selectedStrategy = strategies[strategy] || strategies.balanced;
  return selectedStrategy(torrents);
}
