# 基于相似度的词云系统（TagCloud Similarity）

本项目是一个基于 **embedding 模型计算相似度**的专业级词云可视化系统，支持三种不同的词云布局算法，并提供完整的算法性能指标记录与分析功能。系统采用 **Vue 3 + Fabric.js** 构建，可应用于地理信息可视化、文本相似度分析、数据探索等场景。

---

## ✨ 核心特性

### 🎯 基于相似度的词云生成
- **Embedding 模型支持**：使用 Ollama 本地部署的 `dengcao/Qwen3-Embedding-0.6B:Q8_0` 模型计算文本相似度
- **相似度驱动布局**：根据中心地点与周边地点的语义相似度，智能调整标签的位置、大小和颜色
- **批量相似度计算**：支持批量计算多个地点的嵌入向量，提供进度反馈

### 🔄 三种词云布局算法

1. **多角度径向移位算法（Multi-Angle Radial）**
   - 按照地点标签真实方向角，在 ±15° 扇形范围内使用多角度径向移位算法从中心向外探测可放置位置
   - 结合阿基米德螺线搜索策略，在保持方向性的同时实现全局无压盖布局

2. **单角度径向移位算法（Single-Angle Radial）**
   - 直接按照地点标签真实方向角从中心向外径向移动
   - 直到移动到空闲区域进行摆放，算法简单高效

3. **阿基米德螺线算法（Archimedean Spiral）**
   - 使用 `d3-cloud` 库实现的经典阿基米德螺线算法
   - 适合传统词云布局需求，不依赖地理方位信息

### 📊 算法性能指标记录

系统自动记录并展示以下性能指标：

- **标签数量**：本轮渲染的标签总数
- **空间紧凑度 CI（Compactness Index）**：所有标签面积总和与最小外接矩形面积的比值
- **方向保持度 OR（Orientation Retention）**：
  - 平均方向偏移 MAE（Mean Absolute Error）
  - 最大方向偏移 MaxE（Maximum Error）
- **径向距离与相似度的相关性 RDSC（Radial Distance Similarity Correlation）**：采用皮尔逊相关系数（-1 到 1）
- **布局均匀度 LU（Layout Uniformity）**：将 360 度圆周等分为 36 个扇形区间，计算各区间内标签数量的变异系数（CV）
- **运行效率**：算法布局耗时（不包括数据准备和相似度计算）

### 🛠️ 算法切换与对比

- **实时算法切换**：在算法面板中可随时切换不同的布局算法
- **指标实时更新**：切换算法后重新生成词云，自动更新所有性能指标
- **批量测试功能**：支持批量生成测试用例，自动对比三种算法的性能表现

---

## 🛠 技术栈

- **构建工具**：Vite 5 + ESBuild
- **前端框架**：Vue 3 `<script setup>` + Pinia（状态管理）
- **UI 组件库**：Element Plus
- **可视化引擎**：Fabric.js Canvas
- **词云算法库**：d3-cloud
- **相似度计算**：Ollama API（本地部署的 embedding 模型）
- **地图能力**：高德地图 JSAPI 2.0
- **其他工具**：
  - Axios（HTTP 请求）
  - Lodash-es（工具函数）

---

## 📂 项目结构

```text
tagCloud_Similarity/
├── public/
│   ├── data/               # 数据文件（chinapoi.json、chinapoi.csv 等）
│   └── img/                # 图片资源
├── src/
│   ├── assets/styles/      # 全局样式 (SCSS)
│   ├── components/
│   │   ├── algorithm/      # AlgorithmPanel：算法选择与指标展示面板
│   │   ├── batchtest/      # BatchTestPanel：批量测试面板
│   │   ├── color/          # ColorPanel：配色面板
│   │   ├── content/        # PoiMap、PoiTable、PoiContent：地图、数据表、内容容器
│   │   ├── layout/         # HeaderBar、FooterBar、SideMenu：布局组件
│   │   ├── tagcloud/       # TagCloudCanvas：标签云画布
│   │   └── typeface/       # TypefacePanel：字体面板
│   ├── stores/
│   │   └── poiStore.js     # Pinia 状态管理（POI 数据、算法设置、指标数据等）
│   ├── utils/
│   │   ├── similarity.js   # 相似度计算工具（Ollama API 调用）
│   │   ├── tagCloudLayout.js  # 三种词云布局算法实现
│   │   ├── layoutMetrics.js    # 布局指标计算工具
│   │   ├── statistics.js       # 统计工具
│   │   └── batchTestUtils.js   # 批量测试工具
│   ├── App.vue
│   └── main.js
├── scripts/                # 数据转换脚本
├── doc/                    # 文档目录
├── vite.config.js
└── README.md
```

---

## 🚀 快速开始

### 1. 环境准备

- **Node.js** ≥ 18（Vite 官方推荐版本）
- **Ollama**：需要本地安装并运行 Ollama，并下载 `dengcao/Qwen3-Embedding-0.6B:Q8_0` 模型

### 2. 安装 Ollama 和模型

```bash
# 安装 Ollama（根据操作系统选择）
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh
# Windows: 从 https://ollama.com/download 下载安装

# 拉取 embedding 模型
ollama pull dengcao/Qwen3-Embedding-0.6B:Q8_0

# 启动 Ollama 服务（默认端口 11434）
ollama serve
```

### 3. 安装项目依赖

```bash
npm install
```

### 4. 配置高德地图 Key（可选）

如果需要使用地图功能，请在 `src/components/content/PoiMap.vue` 中替换高德地图的 API Key。

### 5. 启动开发服务器

```bash
npm run dev
```

默认启动在 `http://localhost:5173`，支持 Vite HMR 热更新。

### 6. 生产构建

```bash
npm run build
npm run preview
```

---

## 🔧 核心模块说明

| 模块 | 功能摘要 |
| --- | --- |
| `src/utils/similarity.js` | 相似度计算核心模块，调用 Ollama API 获取文本嵌入向量，计算余弦相似度 |
| `src/utils/tagCloudLayout.js` | 三种词云布局算法的实现：多角度径向移位、单角度径向移位、阿基米德螺线 |
| `src/utils/layoutMetrics.js` | 布局指标计算工具，计算空间紧凑度、方向保持度、相关性、均匀度等指标 |
| `src/components/algorithm/AlgorithmPanel.vue` | 算法选择面板，支持算法切换和指标实时展示 |
| `src/components/batchtest/BatchTestPanel.vue` | 批量测试面板，支持自动生成测试用例并对比三种算法性能 |
| `src/components/tagcloud/TagCloudCanvas.vue` | 标签云画布组件，负责渲染词云并提供交互功能 |
| `src/stores/poiStore.js` | Pinia 状态管理，统一管理 POI 数据、算法设置、指标数据等 |

---

## 📊 算法指标详解

### 空间紧凑度 CI（Compactness Index）

衡量标签云的空间利用效率，计算公式为：

```
CI = 所有标签面积总和 / 最小外接矩形面积
```

- **值越大**：空间利用越充分，标签分布越紧凑
- **值越小**：标签分布越分散，空间浪费越多

### 方向保持度 OR（Orientation Retention）

衡量算法保持地理方向性的能力：

- **MAE（平均方向偏移）**：所有标签的真实方向角与摆放方向角的平均差值（锐角）
- **MaxE（最大方向偏移）**：所有标签中方向偏移的最大值

- **值越小**：方向保持越好，标签更接近真实地理方位
- **值越大**：方向偏移越大，可能影响地理信息的准确性

### 径向距离与相似度的相关性 RDSC

使用皮尔逊相关系数衡量径向距离与相似度的相关性：

- **值接近 1**：相似度高的标签距离中心更近，布局符合语义相似度
- **值接近 -1**：相似度高的标签距离中心更远（异常情况）
- **值接近 0**：径向距离与相似度无相关性

### 布局均匀度 LU（Layout Uniformity）

将 360 度圆周等分为 36 个扇形区间，计算各区间内标签数量的变异系数（CV）：

- **值越小**：标签在圆周方向分布越均匀
- **值越大**：标签分布越不均匀，可能出现某些方向标签密集、某些方向稀疏的情况

---

## 🧪 批量测试功能

系统提供批量测试功能，可以：

1. **自动生成测试用例**：根据城市坐标和半径自动生成多个测试用例
2. **多算法对比**：对每个测试用例分别使用三种算法生成词云
3. **指标记录**：自动记录每个测试用例的各项性能指标
4. **结果导出**：支持将测试结果导出为 CSV 文件，便于后续分析

**注意**：批量测试需要计算相似度和生成词云，耗时较长，请耐心等待。

---

## 📝 使用流程

1. **选择中心地点**：在地图上选择或搜索一个中心地点
2. **设置搜索半径**：确定要包含的周边地点范围
3. **计算相似度**：系统自动调用 Ollama API 计算中心地点与周边地点的语义相似度
4. **选择布局算法**：在算法面板中选择一种布局算法（多角度径向移位/单角度径向移位/阿基米德螺线）
5. **生成词云**：点击"运行生成标签云"按钮，系统自动生成词云并计算性能指标
6. **查看指标**：在算法面板中查看各项性能指标
7. **切换算法对比**：可以切换不同算法，对比性能差异
8. **样式定制**：调整字体、配色等视觉参数，实时预览效果

---

## ⚙️ 配置说明

### Ollama API 配置

默认配置在 `src/utils/similarity.js` 中：

```javascript
const OLLAMA_API_URL = 'http://localhost:11434/api/embeddings';
const EMBEDDING_MODEL = 'dengcao/Qwen3-Embedding-0.6B:Q8_0';
```

如需修改 API 地址或模型，请编辑该文件。

### 算法参数调整

算法相关参数在 `src/utils/tagCloudLayout.js` 中：

- **多角度径向移位算法**：
  - `sectorHalfAngle`：扇形半角（默认 15°）
  - `radiusIncrement`：每圈半径增量（默认 8）
  - `angleStep`：角度步进（默认 10°）

- **单角度径向移位算法**：
  - `radiusIncrement`：半径步长（默认 5）

---

## 🐛 常见问题

### 1. Ollama API 连接失败

**问题**：提示 "Ollama API 请求失败"

**解决方案**：
- 确保 Ollama 服务正在运行：`ollama serve`
- 检查 API 地址是否正确（默认 `http://localhost:11434`）
- 确认模型已下载：`ollama list`

### 2. 相似度计算速度慢

**问题**：计算相似度耗时过长

**解决方案**：
- 减少周边地点数量（缩小搜索半径）
- 检查 Ollama 服务性能
- 考虑使用更快的 embedding 模型

### 3. 词云生成失败

**问题**：点击生成词云后无响应或报错

**解决方案**：
- 检查浏览器控制台错误信息
- 确认数据格式正确
- 检查算法参数设置

---

## 🔄 版本更新

### 当前版本特性

- ✅ 基于 embedding 模型的相似度计算
- ✅ 三种词云布局算法支持
- ✅ 完整的性能指标记录与分析
- ✅ 算法实时切换功能
- ✅ 批量测试与对比功能
- ✅ 可视化界面与交互功能

### 未来规划

- **功能扩展**：
  - 支持更多 embedding 模型（OpenAI、Hugging Face 等）
  - 更多词云布局算法
  - 指标数据的可视化图表展示
  - 算法参数的自定义配置

- **性能优化**：
  - Web Workers 支持，提升大规模数据处理性能
  - 相似度计算的缓存机制
  - 算法并行执行优化

- **用户体验**：
  - 更多预设配色方案
  - 交互式教程和帮助系统
  - 多语言支持

---

## 📜 许可

本项目仅供学习与研究使用。

---

## 👥 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

---

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**：提交问题或功能请求
- **Email**：1937983507@qq.com

---

## 🙏 致谢

- 感谢 [Ollama](https://ollama.com/) 提供本地 embedding 模型支持
- 感谢 [d3-cloud](https://github.com/jasondavies/d3-cloud) 提供词云算法库
- 感谢 [Fabric.js](https://github.com/fabricjs/fabric.js) 提供强大的 Canvas 操作能力
