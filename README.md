# 诡秘地海美术地图

三层地图：地海世界（`index.html`）、巨坑远征（`surface-expedition.html`）、全球地表（`surface.html`）；盾徽图鉴为 `crests.html`。

- 网站：https://tangquanghuy.github.io/subterranean-sea-map/
- GitHub Pages 首次部署：仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save**。随后推送到 `main` 会自动发布。
- 页面和图片维持原项目的 4K WebP 文件，未重新编码或压缩。`.nojekyll` 使 Pages 直接发布仓库根目录的静态网页。
- 直接打开 `index.html` 可浏览静态地图；宿主需通过 `earthsea_state` / `map_ready` 消息与页面交换 MVU 状态，才会显示玩家当前位置及实时剧情进度。

本仓库仅包含可直接部署的网页运行文件，不包含原项目中的美术母版、文档、测试或生产脚本。
