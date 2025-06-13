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
- 最多做种数量 mostSeeders (默认值): 选相关资源里 **做种数量最多（理论上下载速度最快）**的那一个
- 最大文件体积 largestSize: 选相关资源里 **文件体积最大（码率最高）**的那一个
- 最小文件体积 smallestSize: 选相关资源里 **文件体积最小（码率最低）**的那一个
- 最高像素密度 highestPixelDensity: 选相关资源里 **像素数量/文件体积值最大（同分辨率下文件体积最小）**的那一个

### API 调用参数
- keyword: 搜索关键词
- category (optinal): qBittorrent 里的种子分类
- strategy (optinal): 选种策略

### cURL 调用实例
```bash
curl -X "POST" "http://mteam-download.xxxx.workers.dev" \
     -H 'Content-Type: application/json; charset=utf-8' \
     -d $'{"keyword": "珍品 2019","category": "Movie"}'
```

## iOS 快捷指令集成分享
[快捷指令文件](/shortcut/MTeamDownload.shortcut) 

安装后记得修改快捷指令中调用的 API 地址为你自己部署的 Cloudflare Worker 地址
![快捷指令调用API地址](/shortcut/IMG_9381.jpg)