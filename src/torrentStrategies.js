// 分辨率映射表
const resolutionMap = {
  1: { width: 1920, height: 1080, desc: '1080p' },
  2: { width: 1920, height: 1080, desc: '1080i' },
  3: { width: 1280, height: 720, desc: '720p' },
  5: { width: 640, height: 480, desc: 'SD' },
  6: { width: 3840, height: 2160, desc: '4K' },
  7: { width: 7680, height: 4320, desc: '8K' }
};

// 最高像素密度的策略
export function highestPixelDensity(torrents) {
  let bestTorrent = null;
  let bestRatio = 0;

  for (const torrent of torrents) {
    const standard = parseInt(torrent.standard);
    const size = parseInt(torrent.size);
    
    if (resolutionMap[standard] && size > 0) {
      const resolution = resolutionMap[standard];
      const pixels = resolution.width * resolution.height;
      const ratio = (pixels / size).toFixed(6);
      
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestTorrent = torrent;
      }
    }
  }

  return bestTorrent;
}

// 最小文件体积的策略
export function smallestSize(torrents) {
  let bestTorrent = null;
  let smallestSize = Infinity;

  for (const torrent of torrents) {
    const size = parseInt(torrent.size);
    if (size > 0 && size < smallestSize) {
      smallestSize = size;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 最大文件体积的策略
export function largestSize(torrents) {
  let bestTorrent = null;
  let largestSize = 0;

  for (const torrent of torrents) {
    const size = parseInt(torrent.size);
    if (size > largestSize) {
      largestSize = size;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 最多做种数量的策略
export function mostSeeders(torrents) {
  let bestTorrent = null;
  let maxSeeders = 0;

  for (const torrent of torrents) {
    const seeders = parseInt(torrent.status?.seeders || 0);
    if (seeders > maxSeeders) {
      maxSeeders = seeders;
      bestTorrent = torrent;
    }
  }

  return bestTorrent;
}

// 默认策略选择器
export function selectBestTorrent(torrents, strategy = 'MostSeeder') {
  const strategies = {
    MostSeeder: mostSeeders,
    HighestPixelDensity: highestPixelDensity,
    SmallestSize: smallestSize,
    LargestSize: largestSize
  };

  const selectedStrategy = strategies[strategy] || strategies.MostSeeder;
  console.log('selectedStrategy', selectedStrategy);
  return selectedStrategy(torrents);
} 