// 通用响应头
const commonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

import { selectBestTorrent } from './torrentStrategies';

// 验证必要参数
function validateParams(keyword) {

  if (!keyword) {
    return {
      isValid: false,
      response: new Response(JSON.stringify({ 
        success: false, 
        message: '缺少必要参数 keyword' 
      }), {
        status: 400,
        headers: commonHeaders
      })
    };
  }
  return { isValid: true };
}

// 搜索M-Team种子
async function searchMTorrents(keyword, mtApiKey, mode) {
  const searchResponse = await fetch('https://api.m-team.cc/api/torrent/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': `${mtApiKey}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      keyword: keyword,
      mode: mode,
      pageNumber: "1",
      pageSize: "100"
    })
  });

  if (!searchResponse.ok) {
    if (searchResponse.status === 401) {
      throw new Error('M-Team API Key 无效或已过期');
    }
    throw new Error(`M-Team API请求失败: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.code !== "0") {
    throw new Error(`M-Team API错误: ${searchData.message}`);
  }

  return searchData.data.data;
}

// 获取下载令牌
async function getDownloadToken(torrentId, mtApiKey) {
  const tokenResponse = await fetch(`https://api.m-team.cc/api/torrent/genDlToken?id=${torrentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      'x-api-key': `${mtApiKey}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!tokenResponse.ok) {
    throw new Error(`获取下载令牌失败: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  if (tokenData.code !== "0") {
    throw new Error(`获取下载令牌错误: ${tokenData.message}`);
  }

  return tokenData.data;
}

// qBittorrent登录
async function qbLogin(qbHost, qbUsername, qbPassword) {
  const loginResponse = await fetch(`${qbHost}/api/v2/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `username=${qbUsername}&password=${qbPassword}`
  });

  if (!loginResponse.ok) {
    throw new Error(`qBittorrent登录失败: ${loginResponse.status}`);
  }

  const cookies = loginResponse.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('qBittorrent登录失败: 未获取到cookie');
  }

  return cookies;
}

// 添加种子到qBittorrent
async function addToQBittorrent(qbHost, downloadUrl, category, cookies) {
  const params = new URLSearchParams();
  params.append('urls', downloadUrl);
  params.append('category', category);
  params.append('autoTMM', true);

  const addResponse = await fetch(`${qbHost}/api/v2/torrents/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies
    },
    body: params
  });

  if (!addResponse.ok) {
    throw new Error(`添加种子到qBittorrent失败: ${addResponse.status}`);
  }

  return await addResponse.text();
}

// 主函数
export default {
  async fetch(request, env, ctx) {
    const mtApiKey = env.mtApiKey;
    const qbHost = env.qbHost;
    const qbUsername = env.qbUsername;
    const qbPassword = env.qbPassword;

    try {
      const { keyword, category, strategy } = await request.json();

      // 步骤1: 验证参数
      const validation = validateParams(keyword);
      if (!validation.isValid) {
        return validation.response;
      }

      // 步骤2: 搜索种子
      // 种子搜索类型
      let mode = 'normal';
      // 如果category包含'AV'，不区分大小写，则将 mode 设置为 adult
      if (category.toUpperCase().includes('AV')) {
        mode = 'adult';
      }
      const torrents = await searchMTorrents(keyword, mtApiKey, mode);
      if (!torrents || torrents.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: '暂无相关资源' 
        }), {
          headers: commonHeaders
        });
      }

      // 步骤3: 选择最佳种子
      const bestTorrent = selectBestTorrent(torrents, strategy);
      if (!bestTorrent) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: '未找到合适的种子资源' 
        }), {
          headers: commonHeaders
        });
      }

      // 步骤4: 获取下载令牌
      const downloadUrl = await getDownloadToken(bestTorrent.id, mtApiKey);

      // 步骤5: qBittorrent登录
      const cookies = await qbLogin(qbHost, qbUsername, qbPassword);

      // 步骤6: 添加种子
      await addToQBittorrent(qbHost, downloadUrl, category, cookies);

      // 步骤7: 返回结果
      return new Response(JSON.stringify({
        success: true,
        message: '种子添加成功',
        data: {
          torrentName: bestTorrent.name,
          torrentId: bestTorrent.id,
          size: ((bestTorrent.size) / 1024 / 1024 / 1024).toFixed(2)+' GB'
        }
      }), {
        headers: commonHeaders
      });

    } catch (error) {
      console.error('处理请求时出错:', error);
      
      return new Response(JSON.stringify({
        success: false,
        message: `处理失败: ${error.message}`
      }), {
        status: 500,
        headers: commonHeaders
      });
    }
  }
};