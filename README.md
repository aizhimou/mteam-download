# mteam-download

一个 Cloudflare Worker 程序，提供一个 API 根据关键词搜索 [M-Team](https://kp.m-team.cc/) 中的资源，根据 [内置策略](#内置策略) 自动选择合适的种子，自动添加到 [qBittorrent](https://www.qbittorrent.org/) 任务中。

便于任何可以发起 API 请求的程序与其集成。

## 使用前提

- 有 [M-Team](https://kp.m-team.cc/) 的账号
- 有可以远程访问的 [qBittorrent](https://www.qbittorrent.org/) 客户端

## 使用说明

### 一键部署到 Cloudflare Worker
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aizhimou/mteam-download)

### 部署时要配置的环境变量
- mtApiKey: [M-Team](https://kp.m-team.cc/) 的密钥，在 控制台 -> 实验室 -> 存取令牌 中创建
- qbHost: 你自己的 [qBittorrent](https://www.qbittorrent.org/) 客户端 WebUI 地址
- qbUsername: [qBittorrent](https://www.qbittorrent.org/) 用户名
- qbPassword: [qBittorrent](https://www.qbittorrent.org/) 密码

### 内置策略

- `balanced`：综合平衡策略（默认值）。面向日常观影场景，优先选择 **1080p、WEB-DL、H.265/HEVC、合理文件体积、做种健康** 的资源，同时降低对 REMUX、HDR/DV、HFR/60fps、超大文件以及明显过度压缩资源的优先级。
- `mostSeeders`：选择 **做种数量最多** 的资源。Seeder 多通常意味着 swarm 更健康、下载更稳定，但不保证实际下载速度一定最快。
- `largestSize`：选择 **文件体积最大** 的资源。注意：最大文件不等于最高视频画质，体积也可能来自多音轨、无损音频或其它内容。
- `smallestSize`：选择 **文件体积最小** 的资源。适合只追求最短下载时间或最低存储占用的场景。
- `highestPixelDensity`：旧版兼容策略，根据“像素数量 / 文件体积”选择资源。**不再推荐使用**，因为它容易偏爱“高分辨率 + 极小体积”的过度压缩版本。

`balanced` 当前的设计目标不是判断“客观画质最高”，而是计算一个适合普通电脑/显示器观看的 suitability score。主要考虑：

- 分辨率：1080p 优先；4K 不会因为像素更多而自动获得最高分。
- 来源：WEB-DL 优先，其次普通 BluRay Encode；REMUX 对日常观看降权。
- 编码：H.265 / HEVC / x265 优先于 H.264 / AVC / x264。
- 文件体积：1080p 约 3–8 GB 为主要 sweet spot；过小可能压缩过重，过大则收益递减。
- HDR / DV / HFR / 60fps：对普通非 HDR 显示设备和日常电影观看只提供有限收益，因此轻微降权。
- Seeder：采用分段评分，体现边际递减；例如 50 个 Seeder 已经非常健康，不会因为 200 个 Seeder 就获得 4 倍优势。
- 明显低质量片源（如 CAM / TS / TC）会被显著降权。

为了兼容旧版本，代码仍接受原有 PascalCase 策略名称，例如 `MostSeeder`、`LargestSize`、`SmallestSize`、`HighestPixelDensity`。

### API 调用参数
- keyword: 搜索关键词
- category (optinal): qBittorrent 里的种子分类
- strategy (optinal): 选种策略，默认 `balanced`

### cURL 调用实例
```bash
curl -X "POST" "http://mteam-download.xxxx.workers.dev" \
     -H 'Content-Type: application/json; charset=utf-8' \
     -d $'{"keyword": "珍品 2019","category": "Movie","strategy": "balanced"}'
```

## iOS 快捷指令集成分享
[快捷指令文件](/shortcut/MTeamDownload.shortcut) 

安装后记得修改快捷指令中调用的 API 地址为你自己部署的 Cloudflare Worker 地址
![快捷指令调用API地址](/shortcut/IMG_9381.jpg)

