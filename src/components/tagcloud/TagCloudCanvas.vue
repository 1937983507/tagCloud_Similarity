<template>
  <aside class="tagcloud-panel">
    <header class="panel-head">
      <div class="toolbar-left">
        <el-button-group>
          <el-button id="runTagCloudBtn" type="primary" data-intro-target="runTagCloudBtn" @click="handleRenderCloud">运行生成标签云</el-button>
          <el-button @click="switchResolution('coarse')">粗略显示</el-button>
          <el-button @click="switchResolution('fine')">精细显示</el-button>
        </el-button-group>
        <div class="toolbar-options">
          <el-dropdown @command="handleExportCommand">
            <el-button>
              导出图片<el-icon style="margin-left:4px"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="svg">导出SVG</el-dropdown-item>
                <el-dropdown-item command="png">导出PNG</el-dropdown-item>
                <el-dropdown-item command="jpeg">导出JPEG</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div class="label-count">
            <span>标签数量: </span>
            <span class="label-count-number">{{ renderedLabelCount }}</span>
          </div>
          <!-- 相似度计算进度条 -->
          <div v-if="similarityProgress > 0 && similarityProgress < 100" class="similarity-progress">
            <el-progress
              :percentage="similarityProgress"
              :stroke-width="16"
              :show-text="true"
              :text-inside="true"
              :format="percentage => '计算相似度: ' + percentage + '%'"
              class="similarity-progress-bar"
            />
          </div>
        </div>
      </div>
    </header>
    <div class="canvas-wrapper" ref="wrapperRef">
      <canvas
        :key="canvasKey"
        ref="canvasRef"
        :width="canvasWidth"
        :height="canvasHeight"
      ></canvas>
      <div v-if="!allowRenderCloud || poiStore.visibleList.length === 0" class="empty-cloud-hint">
        <div class="hint-content">
          <div class="hint-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="hint-text">
            <p class="hint-title">{{ allowRenderCloud ? '数据筛选中' : '准备生成标签云' }}</p>
            <p class="hint-desc">
              {{ allowRenderCloud ? '请在地图上绘制筛选区域' : '请先在地图上绘制筛选区域，然后点击"运行生成标签云"按钮' }}
            </p>
          </div>
        </div>
      </div>
      
      <!-- 距离图例 -->
      <div class="distance-legend">
        <p class="legend-title">{{ poiStore.fontSettings.language === 'en' ? 'Semantic Similarity' : '语义相似度' }}</p>
        <div class="legend-colors-wrapper">
          <div class="legend-colors" ref="legendColorsRef">
            <div
              v-for="(color, index) in poiStore.colorSettings.palette"
              :key="`legend-${index}`"
              class="legend-color-item"
              :style="{ background: color }"
              @mouseenter="handleLegendHover(color)"
              @mouseleave="handleLegendLeave"
            ></div>
          </div>
          <!-- 在色块下面一行显示相似度标签 -->
          <div v-if="allowRenderCloud && colorBoundaries.length > 0 && maxSimilarity !== undefined && minSimilarity !== undefined" class="legend-boundaries">
            <span class="legend-boundary-label legend-start">{{ formatSimilarity(maxSimilarity) }}</span>
            <span
              v-for="(boundary, index) in colorBoundaries"
              :key="`boundary-${index}`"
              class="legend-boundary-label legend-middle"
              :style="{ left: `${((index + 1) * 100) / paletteCount}%` }"
            >
              {{ formatSimilarity(boundary) }}
            </span>
            <span
              v-if="minSimilarity !== undefined"
              class="legend-boundary-label legend-max-distance"
            >
              {{ formatSimilarity(minSimilarity) }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- 交互工具栏 -->
      <div class="canvas-toolbar">
        <el-button
          circle
          size="small"
          :icon="RefreshLeft"
          @click="returnToCenter"
          title="返回中心点"
        />
        <el-button
          circle
          size="small"
          :icon="FullScreen"
          @click="returnToScale"
          title="返回原始缩放"
        />
        <el-button
          circle
          size="small"
          :icon="Rank"
          :type="isPanning ? 'primary' : 'default'"
          @click="togglePanning"
          title="漫游"
        />
        <el-button
          circle
          size="small"
          :icon="ZoomIn"
          @click="zoomIn"
          title="放大"
        />
        <el-button
          circle
          size="small"
          :icon="ZoomOut"
          @click="zoomOut"
          title="缩小"
        />
      </div>
      
      <!-- POI信息窗口 -->
      <div v-if="selectedPoi" class="poi-info-window">
        <div class="info-window-header">
          <span class="info-window-title">地名信息</span>
          <el-button
            text
            circle
            size="small"
            @click="closePoiInfo"
            class="close-btn"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <div class="info-window-content">
          <div class="info-item">
            <span class="info-label">名称：</span>
            <span class="info-value">{{ getPoiDisplayName(selectedPoi) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">城市：</span>
            <span class="info-value">{{ selectedPoi.city || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">排名：</span>
            <span class="info-value">{{ selectedPoi.rank || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">经度：</span>
            <span class="info-value">{{ selectedPoi.lng?.toFixed(6) || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">纬度：</span>
            <span class="info-value">{{ selectedPoi.lat?.toFixed(6) || '未知' }}</span>
          </div>
          <div v-if="selectedPoi.distance !== undefined" class="info-item">
            <span class="info-label">距离中心：</span>
            <span class="info-value">{{ (selectedPoi.distance / 1000).toFixed(2) }} km</span>
          </div>
          <div v-if="selectedPoi.time" class="info-item">
            <span class="info-label">通行时间：</span>
            <span class="info-value">{{ selectedPoi.time }} 分钟</span>
          </div>
        </div>
      </div>
    </div>
    <!-- 导出图片设置对话框 -->
    <el-dialog v-model="exportDialogVisible" title="导出图片设置" width="350px" :close-on-click-modal="false">
      <template v-if="exportFormat !== 'svg'">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
          <span style="width:60px;">宽度(px)</span>
          <el-input-number v-model="exportWidth" :min="1" :max="4000" :step="10" size="small" @change="onExportWidthChange" style="width:130px;"/>
        </div>
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
          <span style="width:60px;">高度(px)</span>
          <el-input-number v-model="exportHeight" :min="1" :max="4000" :step="10" size="small" @change="onExportHeightChange" style="width:130px;"/>
        </div>
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
          <el-checkbox v-model="lockAspectRatio" size="small">锁定比例</el-checkbox>
        </div>
      </template>
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
        <el-checkbox v-model="includeLegend" size="small">包含距离图例</el-checkbox>
      </div>
      <template #footer>
        <el-button @click="exportDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleExportConfirm">确认导出</el-button>
      </template>
    </el-dialog>
  </aside>
</template>

<script setup>
import { Canvas, Text, Textbox, Point } from 'fabric';
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  computed,
} from 'vue';
import { usePoiStore } from '@/stores/poiStore';
import { cityNameToPinyin } from '@/utils/cityNameToPinyin';
import { recordTagCloudGeneration } from '@/utils/statistics';
import { calculateSimilarities, getSimilarityLevel } from '@/utils/similarity';
import { layoutTagCloud, measureText } from '@/utils/tagCloudLayout';
import { calculateLayoutMetrics } from '@/utils/layoutMetrics';
import AMapLoader from '@amap/amap-jsapi-loader';
import introJs from 'intro.js';
import 'intro.js/minified/introjs.min.css';
import {
  RefreshLeft,
  FullScreen,
  Rank,
  ZoomIn,
  ZoomOut,
  Close,
  ArrowDown,
} from '@element-plus/icons-vue';

const canvasRef = ref(null);
const wrapperRef = ref(null);
const legendColorsRef = ref(null);
const poiStore = usePoiStore();

// 导出相关变量
const exportDialogVisible = ref(false);
const exportWidth = ref(800);
const exportHeight = ref(600);
const exportFormat = ref('png');
const lockAspectRatio = ref(true);
const includeLegend = ref(true); // 默认包含图例
const origWidth = ref(800);
const origHeight = ref(600);
let _aspectRatio = 1;

let canvasInstance;
let resolutionScale = 1;
let resizeObserver;
let isRendering = false; // 标记是否正在渲染
let isPanning = ref(true); // 是否启用漫游（默认开启）
let vpt = [1, 0, 0, 1, 0, 0]; // viewport transform
let originalCenterX = 0;
let originalCenterY = 0;
const maxDistance = ref(0); // 最大距离（米）- 使用ref以便响应式更新（保留用于其他用途）
const maxSimilarity = ref(undefined); // 最大相似度 - 使用ref以便响应式更新
const minSimilarity = ref(undefined); // 最小相似度 - 使用ref以便响应式更新
let poisPyramid = []; // POI数据金字塔
let tagCloudScale = 0; // 当前显示层级
const pyramidUpdateTrigger = ref(0); // 用于触发computed更新的触发器
const paletteCount = computed(() => poiStore.colorSettings.palette.length || 1);
let amapGlobal = null; // 高德地图全局对象
let drivingInstance = null; // 高德地图驾车路径规划实例

// POI阈值常量
const POI_THRESHOLD = 100; // 首次渲染约100个POI

// 相似度缓存（避免重复计算）
let similarityCache = new Map(); // key: centerPoiId, value: { centerPoi, poisWithSimilarity }

const allowRenderCloud = ref(false);
const canvasWidth = ref(900);
const canvasHeight = ref(900);
const canvasKey = ref(0); // 用于强制重新渲染canvas
const isClearing = ref(false); // 标记是否正在清除，用于防止watch触发重新渲染
const renderedLabelCount = ref(0); // 当前最终渲染完成的标签数量
const selectedPoi = ref(null); // 当前选中的POI信息
const similarityProgress = ref(0); // 相似度计算进度（0-100）


let secondIntroStarted = false;

// 计算各个色块之间的分界点相似度值
const calculateColorBoundaries = () => {
  // 访问触发器以确保响应式
  pyramidUpdateTrigger.value;
  
  if (!allowRenderCloud.value || !poiStore.visibleList.length || poisPyramid.length === 0) {
    return [];
  }
  
  const sourceList = poiStore.visibleList;
  const currentData = poisPyramid[tagCloudScale] || poisPyramid[0] || sourceList;
  if (!currentData || currentData.length === 0) {
    return [];
  }
  
  // 过滤出有相似度数据的POI（排除中心地点）
  const poisWithSimilarity = currentData.filter(
    poi => poi.similarity !== undefined && poi.similarity !== null
  );
  
  if (poisWithSimilarity.length === 0) {
    return [];
  }
  
  const colorSettings = poiStore.colorSettings;
  const colorNum = colorSettings.discreteCount || colorSettings.palette.length;
  const discreteMethod = colorSettings.discreteMethod || 'quantile';
  
  // 获取所有POI的相似度值
  const entriesWithSimilarity = poisWithSimilarity.map((poi) => {
    return { poi, similarity: poi.similarity };
  });
  
  // 按相似度降序排序（相似度高的在前）
  entriesWithSimilarity.sort((a, b) => b.similarity - a.similarity);
  
  const similarities = entriesWithSimilarity.map(entry => entry.similarity);
  if (similarities.length === 0) return [];
  
  // 更新最大和最小相似度（用于图例显示）
  maxSimilarity.value = Math.max(...similarities);
  minSimilarity.value = Math.min(...similarities);
  
  // 预先计算颜色分类所需的公共值
  let colorCache = {};
  if (discreteMethod === 'equal' || discreteMethod === 'geometric') {
    colorCache.minValue = Math.min(...similarities);
    colorCache.maxValue = Math.max(...similarities);
    if (discreteMethod === 'geometric') {
      colorCache.ratio = Math.pow(colorCache.maxValue / colorCache.minValue, 1 / colorNum);
    } else {
      colorCache.range = colorCache.maxValue - colorCache.minValue;
      colorCache.interval = colorCache.range / colorNum;
    }
  } else if (discreteMethod === 'stddev') {
    colorCache.mean = similarities.reduce((acc, curr) => acc + curr, 0) / similarities.length;
    colorCache.stdDev = Math.sqrt(
      similarities.reduce((acc, curr) => acc + Math.pow(curr - colorCache.mean, 2), 0) /
        similarities.length,
    );
    colorCache.stdDevInterval = colorCache.stdDev / colorNum;
    colorCache.halfColorNum = Math.floor(colorNum / 2);
  } else if (discreteMethod === 'jenks') {
    const values = [...similarities].sort((a, b) => a - b);
    colorCache.jenksBreaks = calculateJenks(values, colorNum);
  }
  
  // 为每个entry计算classIndex
  const entriesWithClass = entriesWithSimilarity.map((entry, index) => {
    let classIndex = 0;
    
    if (discreteMethod === 'quantile') {
      const percentile = (index + 1) / entriesWithSimilarity.length;
      classIndex = Math.ceil(colorNum * percentile) - 1;
    } else {
      // calculateClassIndexOptimized期望entry有distance属性，这里改为similarity
      const entryForClass = { distance: entry.similarity }; // 复用distance字段名
      classIndex = calculateClassIndexOptimized(
        entryForClass,
        index,
        entriesWithSimilarity.length,
        colorNum,
        discreteMethod,
        colorCache,
      );
    }
    return { ...entry, classIndex };
  });
  
  // 计算每个色块的最小相似度值（作为分界点），不包含最后一个色块
  // 注意：相似度高的用前面的颜色，相似度低的用后面的颜色
  // 所以分界点应该是每个等级的最小相似度（即该等级的下界）
  const boundaries = [];
  for (let i = 0; i < colorNum - 1; i++) {
    const entriesInClass = entriesWithClass.filter(e => e.classIndex === i);
    if (entriesInClass.length > 0) {
      // 获取该等级的最小相似度（作为下界）
      const minSim = Math.min(...entriesInClass.map(e => e.similarity));
      boundaries.push(minSim);
    } else {
      // 如果没有数据，使用前一个分界点或最大值
      boundaries.push(i > 0 ? boundaries[i - 1] : maxSimilarity.value);
    }
  }
  
  // 按相似度降序排序边界（从高到低）
  boundaries.sort((a, b) => b - a);
  
  return boundaries;
};

// 格式化距离数值，根据数值大小智能调整小数位数以避免重叠
const formatDistance = (distanceInMeters) => {
  const distanceInKm = distanceInMeters / 1000;
  
  // 如果距离 >= 100km，显示整数（0位小数）
  if (distanceInKm >= 100) {
    return Math.round(distanceInKm).toString();
  }
  // 如果距离 >= 10km，显示1位小数
  if (distanceInKm >= 10) {
    return distanceInKm.toFixed(1);
  }
  // 如果距离 < 10km，显示1位小数（保持一致性）
  return distanceInKm.toFixed(1);
};

// 格式化相似度数值，显示为百分比或小数
const formatSimilarity = (similarity) => {
  if (similarity === undefined || similarity === null) {
    return '0.00';
  }
  // 相似度通常在-1到1之间，显示为3位小数
  return similarity.toFixed(3);
};

// 各个色块之间的分界点相似度值
const colorBoundaries = computed(() => {
  // 访问触发器以确保响应式
  pyramidUpdateTrigger.value;
  // 访问相似度值以确保响应式
  maxSimilarity.value;
  minSimilarity.value;
  return calculateColorBoundaries();
});

// 根据语言获取POI显示名称
const getPoiDisplayName = (poi) => {
  const language = poiStore.fontSettings.language || 'zh';
  if (language === 'en') {
    // 优先使用英文名，如果不存在则转换为拼音
    if (poi.name_en && poi.name_en.trim()) {
      return poi.name_en;
    }
    return cityNameToPinyin(poi.name);
  }
  return poi.name;
};

const initCanvas = () => {
  if (!canvasRef.value) return; // 确保canvas元素存在
  
  if (canvasInstance) {
    // 保存当前的viewport transform
    vpt = canvasInstance.viewportTransform;
    canvasInstance.dispose();
  }
  canvasInstance = new Canvas(canvasRef.value, {
    backgroundColor: poiStore.colorSettings.background,
    selection: false,
    defaultCursor: isPanning.value ? 'grab' : 'default',
  });
  
  // 如果漫游已开启，立即设置鼠标样式
  if (isPanning.value) {
    canvasInstance.defaultCursor = 'grab';
  }
  canvasInstance.setWidth(canvasWidth.value);
  canvasInstance.setHeight(canvasHeight.value);
  
  // 恢复viewport transform
  if (vpt) {
    canvasInstance.setViewportTransform(vpt);
  }
  
  // 设置鼠标交互
  setupCanvasInteractions();
};

// 监听背景色变化，立即更新canvas
watch(
  () => poiStore.colorSettings.background,
  (newColor) => {
    if (canvasInstance && newColor) {
      // Fabric.js v6 中直接设置 backgroundColor 属性
      canvasInstance.backgroundColor = newColor;
      canvasInstance.renderAll();
    }
  },
  { immediate: false }
);

// 初始化canvas尺寸（只执行一次，固定大小）
const initCanvasSize = () => {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  // 使用容器的初始尺寸，固定canvas大小
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);
  canvasWidth.value = width;
  canvasHeight.value = height;
};

const getDataFilterButtonElement = () => {
  return (
    document.querySelector('[data-intro-target="dataFilterBtn"]') ||
    document.querySelector('.map-head .dropdown-btn') ||
    document.querySelector('.map-head .el-dropdown-link')
  );
};

const getRunTagCloudButtonElement = () => {
  return (
    document.querySelector('[data-intro-target="runTagCloudBtn"]') ||
    document.querySelector('#runTagCloudBtn') ||
    document.querySelector('.tagcloud-panel .panel-head .el-button--primary')
  );
};

const startDrawGuideIntro = () => {
  if (secondIntroStarted) return;
  secondIntroStarted = true;

  const attemptStart = (retries = 8) => {
    const dataFilterBtn = getDataFilterButtonElement();
    const runBtn = getRunTagCloudButtonElement();

    if (dataFilterBtn && runBtn) {
      try {
        const intro = introJs.tour();
        intro.addSteps([
          {
            element: dataFilterBtn,
            intro:
              '<div style="line-height:1.6;"><strong style="font-size:16px;color:#1f2333;">数据筛选</strong><br/><span style="color:#64748b;">您需要在此对点数据进行筛选操作。点击下拉菜单选择圆形、矩形或多边形筛选方式。</span></div>',
          },
          {
            element: runBtn,
            intro:
              '<div style="line-height:1.6;"><strong style="font-size:16px;color:#1f2333;">运行生成标签云</strong><br/><span style="color:#64748b;">完成数据筛选之后，点击此按钮生成标签云。</span></div>',
          },
        ]);
        intro.setOptions({
          nextLabel: '下一步 →',
          prevLabel: '← 上一步',
          skipLabel: '跳过',
          doneLabel: '完成',
          showStepNumbers: true,
          showProgress: true,
          disableInteraction: false,
          tooltipClass: 'customTooltipClass',
          highlightClass: 'customHighlightClass',
          exitOnOverlayClick: true,
          exitOnEsc: true,
          keyboardNavigation: true,
          tooltipRenderAsHtml: true,
        });
        intro.onComplete(() => {
          secondIntroStarted = false;
        });
        intro.onExit(() => {
          secondIntroStarted = false;
        });
        intro.start();
      } catch (error) {
        console.error('[TagCloudCanvas] 二次引导启动失败', error);
        secondIntroStarted = false;
      }
      return;
    }

    if (retries > 0) {
      setTimeout(() => attemptStart(retries - 1), 200);
    } else {
      console.warn('[TagCloudCanvas] 未找到绘制引导元素');
      secondIntroStarted = false;
    }
  };

  nextTick(() => {
    setTimeout(() => attemptStart(), 120);
  });
};

// 渲染标签云主函数
const renderCloud = async (shouldInitPyramid = false) => {
  if (isRendering) {
    console.warn('正在渲染中，跳过本次请求');
    return;
  }

  if (!canvasInstance || !allowRenderCloud.value) {
    return;
  }

  const sourceList = poiStore.visibleList;
  if (!sourceList || sourceList.length === 0) {
    console.warn('没有可渲染的POI数据');
    return;
  }

  isRendering = true;
  similarityProgress.value = 0;

  try {
    // 获取中心位置
    // 优先使用绘制覆盖物的中心点（如果是圆形则使用圆心，矩形/多边形使用中心点）
    // 如果没有绘制覆盖物信息，则使用POI列表的几何中心
    let center;
    if (poiStore.selectionCenter) {
      // 使用绘制覆盖物的中心点（圆形圆心、矩形中心、多边形中心等）
      center = {
        lng: poiStore.selectionCenter.lng,
        lat: poiStore.selectionCenter.lat,
      };
      console.log('使用绘制覆盖物的中心点:', center);
    } else {
      // 兜底：使用POI列表的几何中心
      center = computeCenter(sourceList);
      console.log('使用POI列表的几何中心:', center);
    }
    
    // 找到距离中心最近的POI作为中心地点
    let centerPoi = null;
    let minDistance = Infinity;
    for (const poi of sourceList) {
      const distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
      if (distance < minDistance) {
        minDistance = distance;
        centerPoi = poi;
      }
    }

    if (!centerPoi) {
      console.error('无法找到中心地点');
      isRendering = false;
      return;
    }

    console.log('中心地点:', centerPoi.name);

    // 获取周边地点（排除中心地点本身）
    const surroundingPois = sourceList.filter(poi => poi.id !== centerPoi.id);

    if (surroundingPois.length === 0) {
      console.warn('没有周边地点可渲染');
      isRendering = false;
      return;
    }

    // 检查相似度缓存
    let poisWithSimilarity;
    const cacheKey = centerPoi.id;
    
    if (similarityCache.has(cacheKey) && !shouldInitPyramid) {
      // 复用缓存的相似度数据
      console.log('复用缓存的相似度数据');
      const cached = similarityCache.get(cacheKey);
      // 检查缓存的数据是否仍然有效（通过比较周边POI数量）
      if (cached.surroundingPoisCount === surroundingPois.length) {
        poisWithSimilarity = cached.poisWithSimilarity;
      } else {
        // 缓存失效，重新计算
        console.log('缓存失效，重新计算相似度');
        poisWithSimilarity = await calculateSimilarities(
          centerPoi, 
          surroundingPois,
          (current, total) => {
            similarityProgress.value = Math.round((current / total) * 100);
          }
        );
        similarityCache.set(cacheKey, {
          centerPoi,
          poisWithSimilarity,
          surroundingPoisCount: surroundingPois.length,
        });
        similarityProgress.value = 0; // 计算完成，重置进度
      }
    } else {
      // 首次计算或强制重新计算
      console.log('开始计算相似度...');
      poisWithSimilarity = await calculateSimilarities(
        centerPoi, 
        surroundingPois,
        (current, total) => {
          similarityProgress.value = Math.round((current / total) * 100);
        }
      );
      similarityCache.set(cacheKey, {
        centerPoi,
        poisWithSimilarity,
        surroundingPoisCount: surroundingPois.length,
      });
      similarityProgress.value = 0; // 计算完成，重置进度
    }

    // 按相似度排序（相似度高的在前）
    const sortedPois = [...poisWithSimilarity].sort(downSimilarity);

    // 如果需要初始化金字塔，重新构建
    if (shouldInitPyramid) {
      // 将中心地点也加入数据中（放在最前面）
      const allPois = [centerPoi, ...sortedPois];
      initPoisPyramid(allPois);
    }

    // 获取当前层级的POI数据
    const currentData = poisPyramid[tagCloudScale] || poisPyramid[0] || sortedPois;
    
    // 过滤出当前层级中已计算相似度的POI（排除中心地点）
    const poisToRender = currentData.filter(poi => poi.similarity !== undefined || poi.id === centerPoi.id);

    // 基于当前尺度下的标签进行相似度分级和样式分配
    const fontSizes = poiStore.fontSettings.fontSizes;
    const palette = poiStore.colorSettings.palette;
    const levelCount = Math.min(fontSizes.length, palette.length);

    // 获取当前尺度下所有POI的相似度值（排除中心地点）
    const similarities = poisToRender
      .filter(poi => poi.id !== centerPoi.id && poi.similarity !== undefined)
      .map(poi => poi.similarity || 0);
    
    if (similarities.length === 0) {
      console.warn('当前尺度下没有相似度数据');
      isRendering = false;
      return;
    }

    // 计算相似度的最小值和最大值（用于分级）
    const localMinSimilarity = Math.min(...similarities);
    const localMaxSimilarity = Math.max(...similarities);
    const similarityRange = localMaxSimilarity - localMinSimilarity;

    // 为当前尺度下的POI分配字号和颜色
    // 计算中心标签字号（比第1级字号大20%）
    const firstLevelFontSize = fontSizes && fontSizes.length > 0 ? fontSizes[0] : 64;
    const centerFontSize = firstLevelFontSize * 1.2; // 比第1级大20%（不乘以resolutionScale，因为会在绘制时统一处理）
    
    const poisWithStyle = poisToRender.map((poi) => {
      if (poi.id === centerPoi.id) {
        // 中心地点使用特殊样式（与drawCenter函数中的样式一致）
        return {
          ...poi,
          fontSize: centerFontSize,
          fontColor: 'rgb(255, 255, 255)', // 白色
          similarityLevel: 0,
          isCenter: true, // 标记为中心标签
        };
      }

      const similarity = poi.similarity || 0;
      
      // 将相似度映射到等级（相似度大的等级高，字号大）
      // 相似度范围归一化到 [0, 1]，然后映射到等级
      const normalizedSimilarity = similarityRange > 0 
        ? (similarity - localMinSimilarity) / similarityRange 
        : 0;
      
      // 相似度大的等级高（反向映射，因为fontSizes数组是从大到小）
      const level = Math.floor(normalizedSimilarity * (levelCount - 1));
      const finalLevel = Math.min(level, levelCount - 1);
      
      // 字号：相似度大的用大字号（fontSizes数组索引越大，字号越小，所以需要反转）
      const fontSizeIndex = levelCount - 1 - finalLevel;
      const fontSize = fontSizes[fontSizeIndex] || fontSizes[0];
      
      // 颜色：相似度高的用1级颜色（palette[0]），相似度低的用5级颜色（palette[4]）
      // 需要反转：相似度高的等级应该是0，相似度低的等级应该是levelCount-1
      const colorIndex = levelCount - 1 - finalLevel;
      const fontColor = palette[colorIndex] || palette[0];
      
      return {
        ...poi,
        fontSize: fontSize,
        fontColor: fontColor,
        similarityLevel: finalLevel,
      };
    });

    // 计算最大距离（保留用于其他用途）
    const distances = poisToRender.map(poi => {
      if (poi.id === centerPoi.id) return 0;
      return calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
    });
    maxDistance.value = Math.max(...distances, 0);
    
    // 计算最大和最小相似度（用于图例）- 使用上面已经计算好的 similarities
    if (similarities.length > 0) {
      maxSimilarity.value = Math.max(...similarities);
      minSimilarity.value = Math.min(...similarities);
    } else {
      maxSimilarity.value = undefined;
      minSimilarity.value = undefined;
    }

    // 清空canvas
    canvasInstance.clear();
    canvasInstance.backgroundColor = poiStore.colorSettings.background;
    canvasInstance.renderAll();

    // 计算canvas中心点
    const centerX = canvasWidth.value / 2;
    const centerY = canvasHeight.value / 2;

    // 获取当前选择的布局算法
    const layoutAlgorithm = poiStore.algorithmSettings?.layoutAlgorithm || 'multi-angle-radial';
    
    // 创建POI ID到样式的映射（用于快速查找）
    const poiStyleMap = new Map();
    poisWithStyle.forEach(poi => {
      poiStyleMap.set(poi.id, poi);
    });

    // 根据算法类型准备POI数据和中心标签处理
    let poisForLayout;
    let centerLabelRect = null;
    
    if (layoutAlgorithm === 'archimedean-spiral') {
      // d3-cloud 算法：将中心标签也纳入布局，不单独绘制
      // 确保中心标签被包含在布局中
      const centerPoiStyled = poiStyleMap.get(centerPoi.id);
      if (!centerPoiStyled) {
        console.warn('中心标签不在样式映射中，使用默认样式');
      }
      
      // 从 poisToRender 中获取所有POI（可能不包含中心标签）
      const poisFromRender = poisToRender.map(poi => {
        const styledPoi = poiStyleMap.get(poi.id) || poi;
        return styledPoi;
      });
      
      // 检查中心标签是否已经在列表中
      const hasCenterPoi = poisFromRender.some(p => p.id === centerPoi.id);
      if (hasCenterPoi) {
        poisForLayout = poisFromRender;
      } else {
        // 如果中心标签不在列表中，添加到最前面（确保大号字体优先布局）
        if (centerPoiStyled) {
          poisForLayout = [centerPoiStyled, ...poisFromRender];
        } else {
          // 如果样式映射中没有中心标签，使用原始 centerPoi 并应用样式
          const fontSizes = poiStore.fontSettings.fontSizes;
          const firstLevelFontSize = fontSizes && fontSizes.length > 0 ? fontSizes[0] : 64;
          const centerFontSize = firstLevelFontSize * 1.2; // 比第1级大20%（不乘以resolutionScale，因为会在绘制时统一处理）
          const centerPoiWithStyle = {
            ...centerPoi,
            fontSize: centerFontSize,
            fontColor: 'rgb(255, 255, 255)', // 白色，与drawCenter一致
            similarityLevel: 0,
            isCenter: true, // 标记为中心标签
          };
          poisForLayout = [centerPoiWithStyle, ...poisFromRender];
        }
      }
      
      console.log(`d3-cloud 布局：准备 ${poisForLayout.length} 个标签，中心标签ID: ${centerPoi.id}，是否包含: ${poisForLayout.some(p => p.id === centerPoi.id)}`);
      // d3-cloud 不需要 centerLabelRect，因为中心标签也在布局中
    } else {
      // 其他算法：单独绘制中心标签，排除中心标签进行布局
      centerLabelRect = drawCenter(centerX, centerY, centerPoi);
      poisForLayout = poisToRender
        .filter(poi => poi.id !== centerPoi.id)
        .map(poi => {
          // 从样式映射中获取样式信息
          const styledPoi = poiStyleMap.get(poi.id) || poi;
          return styledPoi;
        });
    }
    
    // 调用布局函数（d3-cloud 返回 Promise，其他算法返回数组）
    // 记录布局开始时间
    const layoutStartTime = performance.now();
    
    const layoutResult = layoutTagCloud(
      poisForLayout,
      center,
      centerX,
      centerY,
      poiStore.fontSettings,
      getPoiDisplayName,
      centerLabelRect, // 传递中心标签矩形（非d3-cloud算法使用）
      layoutAlgorithm // 传递算法类型
    );
    
    // 处理异步布局（d3-cloud）或同步布局（其他算法）
    const layoutResults = await (layoutResult instanceof Promise ? layoutResult : Promise.resolve(layoutResult));
    
    // 记录布局结束时间
    const layoutEndTime = performance.now();
    const layoutTime = layoutEndTime - layoutStartTime;

    // 在canvas上绘制标签
    layoutResults.forEach((result) => {
      const poi = result.poi;
      // 从样式映射中获取颜色和字号
      const styledPoi = poiStyleMap.get(poi.id) || poi;
      
      // 判断是否为中心标签
      const isCenterLabel = poi.id === centerPoi.id || styledPoi.isCenter;
      
      // 中心标签使用特殊样式（与drawCenter函数中的样式一致）
      const textObj = new Textbox(result.text, {
        left: result.x,
        top: result.y,
        fill: isCenterLabel ? 'rgb(255, 255, 255)' : (styledPoi.fontColor || poiStore.colorSettings.palette[0]),
        fontSize: result.fontSize * resolutionScale,
        fontFamily: isCenterLabel ? 'Comic Sans' : poiStore.fontSettings.fontFamily,
        fontWeight: isCenterLabel ? 1000 : poiStore.fontSettings.fontWeight,
        strokeWidth: isCenterLabel ? 5 : 0,
        stroke: isCenterLabel ? 'rgba(255,255,255,0.7)' : undefined,
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: true,
      });

      // 存储POI信息，用于点击交互
      textObj.poiId = poi.id;
      textObj.distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);

      canvasInstance.add(textObj);
    });

    canvasInstance.renderAll();
    renderedLabelCount.value = layoutResults.length;

    // 触发金字塔更新，确保距离标签能正确显示
    pyramidUpdateTrigger.value++;

    // 计算布局指标
    const metrics = calculateLayoutMetrics(
      layoutResults,
      center,
      centerX,
      centerY,
      layoutTime
    );
    
    // 将指标存储到store
    poiStore.setLayoutMetrics(metrics);

    // 记录统计信息
    if (shouldInitPyramid) {
      recordTagCloudGeneration({
        poiCount: sourceList.length,
        renderedCount: layoutResults.length,
        centerPoi: centerPoi.name,
      });
    }

    console.log('标签云渲染完成', metrics);
  } catch (error) {
    console.error('渲染标签云失败:', error);
    alert('生成标签云失败: ' + (error.message || '未知错误'));
  } finally {
    isRendering = false;
  }
};

async function handleRenderCloud() {
  // 如果没有筛选数据，启动第二个引导并阻止绘制
  if (!poiStore.hasDrawing) {
    startDrawGuideIntro();
    return;
  }
  
  allowRenderCloud.value = true;
  // 每次点击【运行生成标签云】时，强制重新构建POI金字塔，使用最新的筛选数据
  try {
    await renderCloud(true);
    // 记录和刷新已在 renderCloud 函数内部处理
  } catch (error) {
    console.error('生成标签云失败:', error);
  }
}

// 清除标签云
const clearTagCloud = () => {
  // 设置清除标志，防止watch触发重新渲染
  isClearing.value = true;
  allowRenderCloud.value = false;
  maxDistance.value = 0;
  maxSimilarity.value = undefined;
  minSimilarity.value = undefined;
  poisPyramid = [];
  tagCloudScale = 0;
  isRendering = false;
  renderedLabelCount.value = 0; // 重置最终标签数量
  similarityCache.clear(); // 清除相似度缓存
  similarityProgress.value = 0; // 重置相似度计算进度
  
  // 完全销毁canvas实例
  if (canvasInstance) {
    try {
      // 先移除所有对象
      const objects = canvasInstance.getObjects();
      objects.forEach(obj => {
        canvasInstance.remove(obj);
      });
      canvasInstance.dispose();
    } catch (e) {
      console.warn('Canvas dispose error:', e);
    }
    canvasInstance = null;
  }
  
  // 通过更新key来强制Vue删除旧的canvas元素并创建新的
  canvasKey.value += 1;
  
  // 等待Vue重新创建canvas元素后，初始化新的canvas实例
  nextTick(() => {
    if (canvasRef.value) {
      initCanvas();
    }
    // 清除完成后，重置标志
    isClearing.value = false;
  });
};

// 初始化高德地图和Driving实例
const initAMapDriving = async () => {
  if (amapGlobal && drivingInstance) return; // 已经初始化
  
  try {
    amapGlobal = await AMapLoader.load({
      key: '80838eddfb922202b289fd1ad6fa4e58',
      version: '2.0',
      plugins: ['AMap.Driving'],
    });
    
    // 创建驾车路径规划实例
    drivingInstance = new amapGlobal.Driving({
      policy: amapGlobal.DrivingPolicy.LEAST_TIME, // 最便捷的驾车策略
    });
  } catch (error) {
    console.warn('高德地图加载失败:', error);
  }
};

// 计算通行时间（使用高德地图Driving API）- 保留原方法
const calculateTravelTimeAPI = (centerLng, centerLat, poiLng, poiLat) => {
  return new Promise((resolve, reject) => {
    if (!drivingInstance || !amapGlobal) {
      resolve(null);
      return;
    }
    
    try {
      drivingInstance.search(
        new amapGlobal.LngLat(centerLng, centerLat),
        new amapGlobal.LngLat(poiLng, poiLat),
        (status, result) => {
          if (status === 'complete' && result.routes && result.routes.length > 0) {
            // 时间单位：秒，转换为分钟
            const timeInSeconds = result.routes[0].time;
            const timeInMinutes = Math.round(timeInSeconds / 60);
            resolve(timeInMinutes);
          } else {
            resolve(null);
          }
        }
      );
    } catch (error) {
      console.warn('计算通行时间失败:', error);
      resolve(null);
    }
  });
};

// 计算通行时间（基于经纬度估算）- 新方法
const calculateTravelTime = (centerLng, centerLat, poiLng, poiLat) => {
  // 计算直线距离（米）
  const distanceInMeters = calculateDistance(centerLat, centerLng, poiLat, poiLng);
  
  // 实际道路距离通常比直线距离长，使用系数1.4（考虑城市道路的绕行）
  const roadDistanceFactor = 1.4;
  const roadDistanceKm = (distanceInMeters / 1000) * roadDistanceFactor;
  
  // 根据距离选择不同的平均车速
  // 短距离（<10km）：城市道路，平均30km/h
  // 中距离（10-50km）：混合道路，平均45km/h
  // 长距离（>50km）：高速公路为主，平均70km/h
  let averageSpeed;
  if (roadDistanceKm < 10) {
    averageSpeed = 30; // 城市道路
  } else if (roadDistanceKm < 50) {
    averageSpeed = 45; // 混合道路
  } else {
    averageSpeed = 70; // 高速公路为主
  }
  
  // 计算时间：时间(分钟) = 距离(km) / 速度(km/h) * 60
  const timeInMinutes = Math.round((roadDistanceKm / averageSpeed) * 60);
  
  // 至少返回1分钟
  return Math.max(1, timeInMinutes);
};

// 计算两点之间的经纬度距离（使用Haversine公式，返回米）
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 计算中心位置（基于经纬度的几何中心）
const computeCenter = (list) => {
  if (!list.length) return { lng: 0, lat: 0 };
  const lngs = list.map((poi) => poi.lng);
  const lats = list.map((poi) => poi.lat);
  return {
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
  };
};

const computeBounds = (list) => {
  const lngs = list.map((poi) => poi.lng);
  const lats = list.map((poi) => poi.lat);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
};

// 计算自然间断点（Jenks算法）
const calculateJenks = (data, numClasses) => {
  const n = data.length;
  const mat1 = [];
  const mat2 = [];
  const classIndex = [];

  for (let i = 0; i <= n; i++) {
    mat1[i] = [];
    mat2[i] = [];
    for (let j = 0; j <= numClasses; j++) {
      mat1[i][j] = 0;
      mat2[i][j] = 0;
    }
  }

  for (let i = 1; i <= numClasses; i++) {
    mat1[1][i] = 1;
    mat2[1][i] = 0;
    for (let j = 2; j <= n; j++) {
      mat2[j][i] = Infinity;
    }
  }

  let v = 0;
  for (let l = 2; l <= n; l++) {
    let s1 = 0;
    let s2 = 0;
    let w = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      const val = data[i3 - 1];
      s2 += val * val;
      s1 += val;
      w += 1;
      const v1 = s2 - (s1 * s1) / w;
      let i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= numClasses; j++) {
          if (mat2[l][j] >= v1 + mat2[i4][j - 1]) {
            mat1[l][j] = i3;
            mat2[l][j] = v1 + mat2[i4][j - 1];
          }
        }
      }
    }
    mat1[l][1] = 1;
    mat2[l][1] = v;
  }

  let k = n;
  for (let j = numClasses; j >= 1; j--) {
    classIndex[j - 1] = mat1[k][j] - 1;
    k = mat1[k][j] - 1;
  }

  const jenksBreaks = [];
  for (let i = 0; i < classIndex.length; i++) {
    jenksBreaks.push(data[classIndex[i]]);
  }
  return jenksBreaks;
};

// 计算颜色类别索引（优化版本：使用预计算的缓存值）
const calculateClassIndexOptimized = (entry, index, total, colorNum, discreteMethod, cache) => {
  let classIndex;
  const distance = entry.distance;

  switch (discreteMethod) {
    case 'equal':
      // 相等间隔（使用缓存值）
      classIndex = Math.floor((distance - cache.minValue) / cache.interval);
      if (classIndex >= colorNum) classIndex = colorNum - 1;
      break;
    case 'quantile':
      // 分位数
      const percentile = (index + 1) / total;
      classIndex = Math.ceil(colorNum * percentile) - 1;
      break;
    case 'jenks':
      // 自然间断点(Jenks)（使用缓存值）
      for (let i = 0; i < cache.jenksBreaks.length; i++) {
        if (distance <= cache.jenksBreaks[i]) {
          classIndex = i;
          break;
        }
      }
      if (classIndex === undefined) classIndex = colorNum - 1;
      break;
    case 'geometric':
      // 几何间隔（使用缓存值）
      classIndex = Math.floor(Math.log(distance / cache.minValue) / Math.log(cache.ratio));
      if (classIndex >= colorNum) classIndex = colorNum - 1;
      if (classIndex < 0) classIndex = 0;
      break;
    case 'stddev':
      // 标准差（使用缓存值）
      const deviation = distance - cache.mean;
      classIndex = Math.floor(deviation / cache.stdDevInterval) + cache.halfColorNum;
      if (classIndex < 0) classIndex = 0;
      else if (classIndex >= colorNum) classIndex = colorNum - 1;
      break;
    default:
      classIndex = 0;
      break;
  }

  return classIndex;
};

// 保留原函数以兼容（如果其他地方有调用）
const calculateClassIndex = (data, index, total, colorNum, discreteMethod) => {
  const entry = data[index];
  // 如果没有缓存，使用原逻辑（性能较差，但兼容）
  let colorCache = {};
  if (discreteMethod === 'equal' || discreteMethod === 'geometric') {
    const distances = data.map((item) => item.distance);
    colorCache.minValue = Math.min(...distances);
    colorCache.maxValue = Math.max(...distances);
    if (discreteMethod === 'geometric') {
      colorCache.ratio = Math.pow(colorCache.maxValue / colorCache.minValue, 1 / colorNum);
    } else {
      colorCache.range = colorCache.maxValue - colorCache.minValue;
      colorCache.interval = colorCache.range / colorNum;
    }
  } else if (discreteMethod === 'stddev') {
    const allValues = data.map((item) => item.distance);
    colorCache.mean = allValues.reduce((acc, curr) => acc + curr, 0) / allValues.length;
    colorCache.stdDev = Math.sqrt(
      allValues.reduce((acc, curr) => acc + Math.pow(curr - colorCache.mean, 2), 0) /
        allValues.length,
    );
    colorCache.stdDevInterval = colorCache.stdDev / colorNum;
    colorCache.halfColorNum = Math.floor(colorNum / 2);
  } else if (discreteMethod === 'jenks') {
    const values = data.map((item) => item.distance).sort((a, b) => a - b);
    colorCache.jenksBreaks = calculateJenks(values, colorNum);
  }
  return calculateClassIndexOptimized(entry, index, total, colorNum, discreteMethod, colorCache);
};

// 找到距离中心最近的POI作为中心地点
const findCenterPoi = (center, sourceList) => {
  if (!sourceList || sourceList.length === 0) {
    return null;
  }
  
    let nearestPoi = null;
    let minDistance = Infinity;
    
    for (const poi of sourceList) {
      const distance = calculateDistance(
        center.lat,
        center.lng,
        poi.lat,
        poi.lng,
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoi = poi;
      }
    }
    
  return nearestPoi;
};

// 绘制中心位置（接收中心POI作为参数）
const drawCenter = (centerX, centerY, centerPoi) => {
  const language = poiStore.fontSettings.language || 'zh';
  
  // 获取中心标签文本
  let centerLabelText;
  if (centerPoi) {
    centerLabelText = getPoiDisplayName(centerPoi);
    } else {
    // 如果没有中心POI，使用默认文本
    centerLabelText = language === 'en' ? 'Center' : '中心位置';
  }
  
  // 中心标签字号：比第1级字号大一点（第1级是fontSizes[0]）
  const fontSizes = poiStore.fontSettings.fontSizes;
  const firstLevelFontSize = fontSizes && fontSizes.length > 0 ? fontSizes[0] : 64;
  const centerFontSizeLogical = firstLevelFontSize * 1.2; // 逻辑字号（不包含 resolutionScale）
  const centerFontSize = centerFontSizeLogical * resolutionScale; // 实际绘制字号（包含 resolutionScale）
  
  const centerText = new Textbox(centerLabelText, {
    left: centerX,
    top: centerY,
    fill: 'rgb(255, 255, 255)',
    fontSize: centerFontSize, // 绘制时使用包含 resolutionScale 的字号
    strokeWidth: 5,
    fontWeight: 1000,
    stroke: 'rgba(255,255,255,0.7)',
    fontFamily: 'Comic Sans',
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
    selectable: false,
  });
  canvasInstance.add(centerText);
  
  // 使用统一的 measureText 函数计算中心标签的尺寸
  // 注意：为了与布局算法保持一致，使用逻辑字号（不包含 resolutionScale）
  // 这样返回的 centerLabelRect 尺寸与其他标签的尺寸在同一坐标系中
  const { width: centerTextWidth, height: centerTextHeight } = measureText(
    centerLabelText,
    centerFontSizeLogical, // 使用逻辑字号，与布局算法保持一致
    'Comic Sans', // 中心标签使用的字体
    1000 // 中心标签使用的字体粗细
  );
  
  return {
    x: centerX - centerTextWidth / 2,
    y: centerY - centerTextHeight / 2,
    width: centerTextWidth,
    height: centerTextHeight,
  };
};



// 按排名升序排列（保留用于兼容）
const upRank = (a, b) => a.rank - b.rank;

// 按距离升序排列
const upDis = (a, b) => a.distance - b.distance;

// 按相似度降序排列（相似度越高越靠前）
const downSimilarity = (a, b) => {
  const simA = a.similarity !== undefined ? a.similarity : 0;
  const simB = b.similarity !== undefined ? b.similarity : 0;
  return simB - simA; // 降序
};

// 初始化POI金字塔（基于相似度）
const initPoisPyramid = (data) => {
  poisPyramid = [];
  const dataLength = data.length;
  
  // 获取中心位置（优先使用绘制覆盖物的中心点）
  let center;
  if (poiStore.selectionCenter) {
    // 使用绘制覆盖物的中心点（圆形圆心、矩形中心、多边形中心等）
    center = {
      lng: poiStore.selectionCenter.lng,
      lat: poiStore.selectionCenter.lat,
    };
  } else {
    // 兜底：使用POI列表的几何中心
    center = computeCenter(data);
  }
  
  // 为每个POI计算距离（如果还没有）
  const dataWithDistance = data.map((poi) => {
    if (!poi.distance) {
      poi.distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
    }
    return poi;
  });
  
  // 第一步：按相似度排序（相似度高的在前）
  const sortedBySimilarity = [...dataWithDistance].sort(downSimilarity);
  poisPyramid[0] = sortedBySimilarity;
  
  // 确定初始scale（首次渲染约100个POI）
  tagCloudScale = 0;
  
  // 构建金字塔：每一层都是按相似度取前N个（相似度高的优先）
  let currentData = sortedBySimilarity;
  let currentLength = dataLength;
  let scale = 0;
  
  // 定义函数用于判断是否达到了数据量小于10的条件
  const shouldStopSplitting = (length) => length <= 10;
  
  // 自定义划分分层数据
  while (!shouldStopSplitting(currentLength)) {
    // 当数据量还大于10的时候，继续构建层级
    if (tagCloudScale === 0 && currentLength <= POI_THRESHOLD) {
      // 当数据量已经小于等于100的时候，设置tagCloudScale
      tagCloudScale = scale;
    }
    
    scale++;
    // 进行数据划分（取前一半，即相似度更高的POI）
    currentData = currentData.slice(0, Math.round(currentLength / 2));
    currentLength = currentData.length;
    
    // 存入金字塔（已经按相似度排序）
    poisPyramid[scale] = [...currentData];
  }
  
  // 如果tagCloudScale还是0，说明数据量小于等于100，使用第0层
  if (tagCloudScale === 0 && dataLength <= POI_THRESHOLD) {
    tagCloudScale = 0;
  }
  
  console.log('POI金字塔构建完成（基于相似度）:', {
    totalLayers: poisPyramid.length,
    currentScale: tagCloudScale,
    layerSizes: poisPyramid.map((layer, idx) => ({ scale: idx, count: layer.length }))
  });
};

// 切换分辨率（粗略/精细显示）
const switchResolution = async (mode) => {
  if (!allowRenderCloud.value || poisPyramid.length === 0) return;
  
  const oldScale = tagCloudScale;
  
  if (mode === 'fine') {
    // 精细显示：显示更多POI（降低scale）
    if (tagCloudScale > 0) {
      tagCloudScale--;
    }
  } else {
    // 粗略显示：显示更少POI（提高scale）
    if (tagCloudScale < poisPyramid.length - 1) {
      tagCloudScale++;
    }
  }
  
  // 如果scale没有变化，不重新渲染
  if (oldScale === tagCloudScale) {
    console.log('Scale未变化，跳过渲染');
    return;
  }
  
  console.log(`切换分辨率: ${mode}, scale: ${oldScale} -> ${tagCloudScale}, POI数量: ${poisPyramid[oldScale]?.length} -> ${poisPyramid[tagCloudScale]?.length}`);
  
  // 重新渲染（不重新初始化金字塔）
  await renderCloud(false);
};

// Canvas交互设置
const setupCanvasInteractions = () => {
  if (!canvasInstance) return;
  
  // 鼠标滚轮缩放
  canvasInstance.on('mouse:wheel', (opt) => {
    const delta = opt.e.deltaY;
    let zoom = canvasInstance.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    
    canvasInstance.zoomToPoint(
      { x: opt.e.offsetX, y: opt.e.offsetY },
      zoom,
    );
    
    vpt = canvasInstance.viewportTransform;
    opt.e.preventDefault();
    opt.e.stopPropagation();
  });
  
  // 鼠标拖拽（漫游）
  let isDragging = false;
  let lastPosX = 0;
  let lastPosY = 0;
  
  let clickStartTime = 0;
  let clickStartPos = { x: 0, y: 0 };
  let hasMoved = false; // 标记是否发生了移动
  
  canvasInstance.on('mouse:down', (opt) => {
    const evt = opt.e;
    // 记录点击开始时间和位置，用于区分拖拽和点击
    clickStartTime = Date.now();
    clickStartPos = { x: evt.clientX, y: evt.clientY };
    hasMoved = false;
    
    if (isPanning.value) {
      isDragging = true;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
    }
  });
  
  canvasInstance.on('mouse:move', (opt) => {
    if (isDragging && isPanning.value) {
      const e = opt.e;
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - clickStartPos.x, 2) + 
        Math.pow(e.clientY - clickStartPos.y, 2)
      );
      // 如果移动距离超过5像素，认为是拖拽
      if (moveDistance > 5) {
        hasMoved = true;
      }
      
      vpt = canvasInstance.viewportTransform;
      vpt[4] += e.clientX - lastPosX;
      vpt[5] += e.clientY - lastPosY;
      canvasInstance.setViewportTransform(vpt);
      lastPosX = e.clientX;
      lastPosY = e.clientY;
    }
  });
  
  canvasInstance.on('mouse:up', (opt) => {
    if (isDragging) {
      isDragging = false;
      vpt = canvasInstance.viewportTransform;
    }
    
    // 处理点击事件：只有在没有拖拽或拖拽距离很小的情况下才处理
    const clickDuration = Date.now() - clickStartTime;
    const evt = opt.e;
    const moveDistance = Math.sqrt(
      Math.pow(evt.clientX - clickStartPos.x, 2) + 
      Math.pow(evt.clientY - clickStartPos.y, 2)
    );
    
    // 如果是短时间点击且移动距离小，认为是点击事件而不是拖拽
    if (clickDuration < 300 && moveDistance < 5 && !hasMoved) {
      // 检查是否点击了标签（排除中心点）
      const target = opt.target;
      const objects = canvasInstance.getObjects();
      const centerObject = objects.length > 0 ? objects[0] : null;
      
      if (target && target.poiId && target !== centerObject) {
        // 根据POI ID查找对应的POI数据
        const poi = poiStore.poiList.find(p => p.id === target.poiId);
        if (poi) {
          // 获取标签的距离信息
          const poiWithDistance = {
            ...poi,
            distance: target.distance,
          };
          selectedPoi.value = poiWithDistance;
        }
      } else {
        // 点击空白区域，关闭信息窗口
        selectedPoi.value = null;
      }
    }
  });
};

// 返回中心点
const returnToCenter = () => {
  if (!canvasInstance) return;
  vpt[4] = 0;
  vpt[5] = 0;
  canvasInstance.setViewportTransform(vpt);
};

// 返回原始缩放
const returnToScale = () => {
  if (!canvasInstance) return;
  vpt[0] = 1;
  vpt[1] = 0;
  vpt[2] = 0;
  vpt[3] = 1;
  canvasInstance.setViewportTransform(vpt);
};

// 切换漫游
const togglePanning = () => {
  isPanning.value = !isPanning.value;
  if (canvasInstance) {
    canvasInstance.defaultCursor = isPanning.value ? 'grab' : 'default';
  }
};

// 放大
const zoomIn = () => {
  if (!canvasInstance) return;
  let zoom = canvasInstance.getZoom();
  zoom *= 1.1;
  if (zoom > 20) zoom = 20;
  
  const center = new Point(
    canvasInstance.getWidth() / 2,
    canvasInstance.getHeight() / 2,
  );
  canvasInstance.zoomToPoint(center, zoom);
  vpt = canvasInstance.viewportTransform;
};

// 缩小
const zoomOut = () => {
  if (!canvasInstance) return;
  let zoom = canvasInstance.getZoom();
  zoom *= 0.9;
  if (zoom < 0.01) zoom = 0.01;
  
  const center = new Point(
    canvasInstance.getWidth() / 2,
    canvasInstance.getHeight() / 2,
  );
  canvasInstance.zoomToPoint(center, zoom);
  vpt = canvasInstance.viewportTransform;
};

// 关闭POI信息窗口
const closePoiInfo = () => {
  selectedPoi.value = null;
};

// 图例悬停高亮
const handleLegendHover = (color) => {
  if (!canvasInstance) return;
  canvasInstance.forEachObject((obj) => {
    if (obj.fill === color) {
      obj.set({
        strokeWidth: obj.fontSize / 12,
        stroke: 'rgba(255,255,255,0.8)',
      });
    } else {
      obj.set({ strokeWidth: 0 });
    }
  });
  canvasInstance.renderAll();
};

// 图例离开
const handleLegendLeave = () => {
  if (!canvasInstance) return;
  canvasInstance.forEachObject((obj) => {
    obj.set({ strokeWidth: 0 });
  });
  canvasInstance.renderAll();
};

// 更新标签颜色（不重新绘制，只更新颜色属性）
// 重要：基于相似度重新计算颜色分类
const updateLabelColors = () => {
  if (!canvasInstance || !allowRenderCloud.value) return;
  
  const sourceList = poiStore.visibleList;
  if (!sourceList.length || poisPyramid.length === 0) return;
  
  // 使用当前的tagCloudScale，获取当前要渲染展示的POI数据
  const currentData = poisPyramid[tagCloudScale];
  if (!currentData) {
    console.warn(`tagCloudScale ${tagCloudScale} 超出范围，使用第0层`);
    return;
  }
  
  const colorSettings = poiStore.colorSettings;
  const palette = colorSettings.palette;
  const levelCount = Math.min(poiStore.fontSettings.fontSizes.length, palette.length);
  
  // 创建POI文本到POI数据的映射（用于快速查找）
  const textToPoiMap = new Map();
  currentData.forEach((poi) => {
    // 构建标签文本（不显示排名和时间）
    const displayName = getPoiDisplayName(poi);
    const labelText = displayName;
    textToPoiMap.set(labelText, poi);
  });
  
  // 基于相似度计算颜色分类
  // 过滤出有相似度数据的POI（排除中心地点）
  const poisWithSimilarity = currentData.filter(poi => poi.similarity !== undefined);
  
  if (poisWithSimilarity.length === 0) {
    console.warn('没有相似度数据，无法更新颜色');
    return;
  }
  
  // 基于当前尺度下的相似度进行分级
  const similarities = poisWithSimilarity.map(poi => poi.similarity || 0);
  const minSimilarity = Math.min(...similarities);
  const maxSimilarity = Math.max(...similarities);
  const similarityRange = maxSimilarity - minSimilarity;

  // 基于相似度创建文本到颜色类别的映射
  const textToColorMap = new Map();
  poisWithSimilarity.forEach((poi) => {
    // 构建标签文本（不显示排名和时间）
    const displayName = getPoiDisplayName(poi);
    const labelText = displayName;
    
    // 根据当前尺度下的相似度计算等级
    // 相似度高的应该是1级（palette[0]），相似度低的应该是5级（palette[4]）
    const similarity = poi.similarity || 0;
    const normalizedSimilarity = similarityRange > 0 
      ? (similarity - minSimilarity) / similarityRange 
      : 0;
    const level = Math.floor(normalizedSimilarity * (levelCount - 1));
    const finalLevel = Math.min(level, levelCount - 1);
    // 反转颜色索引：相似度高的用前面的颜色，相似度低的用后面的颜色
    const colorIndex = levelCount - 1 - finalLevel;
    const color = palette[colorIndex] || palette[0];
    
    textToColorMap.set(labelText, color);
  });
  
  // 更新canvas中的标签颜色（只更新fill属性，不触发重绘）
  // 使用set方法批量更新，确保Fabric.js正确更新属性
  let hasUpdates = false;
  let updatedCount = 0;
  let skippedCount = 0;
  
  // 临时禁用canvas的渲染，避免逐个更新时触发重绘
  const wasRenderOnAddRemove = canvasInstance.renderOnAddRemove;
  canvasInstance.renderOnAddRemove = false;
  
  canvasInstance.forEachObject((obj, i) => {
    if (i === 0) return; // 跳过中心点
    
    // 从映射中获取新颜色
    const newColor = textToColorMap.get(obj.text);
    if (!newColor) {
      // 如果找不到对应的颜色，可能是文本不匹配，尝试调试
      skippedCount++;
      return;
    }
    
    // 只更新颜色，不触发重绘
    if (obj.fill !== newColor) {
      // 使用set方法更新属性，确保Fabric.js正确更新内部状态
      // 注意：set方法会触发对象更新，但不会立即渲染（因为已禁用renderOnAddRemove）
      obj.set({ fill: newColor });
      // 同时更新存储的距离信息（如果存在）
      const poi = textToPoiMap.get(obj.text);
      if (poi) {
        // 获取中心位置（优先使用绘制覆盖物的中心点）
        let center;
        if (poiStore.selectionCenter) {
          center = {
            lng: poiStore.selectionCenter.lng,
            lat: poiStore.selectionCenter.lat,
          };
        } else {
          center = computeCenter(sourceList);
        }
        obj.distance = calculateDistance(
          center.lat,
          center.lng,
          poi.lat,
          poi.lng,
        );
      }
      // 确保对象状态已更新
      obj.setCoords();
      hasUpdates = true;
      updatedCount++;
    }
  });
  
  // 恢复canvas的渲染设置
  canvasInstance.renderOnAddRemove = wasRenderOnAddRemove;
  
  // 如果有更新，立即渲染所有更新
  if (hasUpdates) {
    // 强制渲染所有对象，确保所有颜色更新都显示出来
    // 直接调用renderAll，不使用requestAnimationFrame，确保立即渲染
    canvasInstance.renderAll();
  }
  
  // 调试信息（开发时使用）
  if (process.env.NODE_ENV === 'development' && (updatedCount > 0 || skippedCount > 0)) {
    console.log(`颜色更新: 已更新 ${updatedCount} 个标签, 跳过 ${skippedCount} 个标签, 总对象数: ${canvasInstance.getObjects().length - 1}`);
  }
};

// 更新标签字体和字重（不重新绘制，只更新属性）
// 优化：使用与updateLabelColors相同的方式，批量更新后一次性渲染
const updateLabelFonts = () => {
  if (!canvasInstance || !allowRenderCloud.value) return;
  
  const { fontSettings } = poiStore;
  let hasUpdates = false;
  let updatedCount = 0;
  
  // 临时禁用canvas的渲染，避免逐个更新时触发重绘
  const wasRenderOnAddRemove = canvasInstance.renderOnAddRemove;
  canvasInstance.renderOnAddRemove = false;
  
  // 批量更新所有对象的字体和字重
  canvasInstance.forEachObject((obj, i) => {
    if (i === 0) return; // 跳过中心点
    
    // 检查是否需要更新
    const needsFontFamilyUpdate = obj.fontFamily !== fontSettings.fontFamily;
    const needsFontWeightUpdate = obj.fontWeight !== fontSettings.fontWeight;
    
    if (needsFontFamilyUpdate || needsFontWeightUpdate) {
      // 使用set方法批量更新属性，确保Fabric.js正确更新内部状态
      // 注意：字体和字重改变可能影响文本尺寸，需要重新计算边界框
      const updates = {};
      if (needsFontFamilyUpdate) {
        updates.fontFamily = fontSettings.fontFamily;
      }
      if (needsFontWeightUpdate) {
        updates.fontWeight = fontSettings.fontWeight;
      }
      // 确保移除轮廓（切换字体时不应该有轮廓）
      // 无条件清除轮廓，避免字体切换时出现轮廓
      updates.strokeWidth = 0;
      
      // 批量更新属性（不触发渲染）
      obj.set(updates);
      // 确保对象状态已更新（字体改变可能影响文本尺寸，需要重新计算）
      obj.setCoords();
      hasUpdates = true;
      updatedCount++;
    }
  });
  
  // 恢复canvas的渲染设置
  canvasInstance.renderOnAddRemove = wasRenderOnAddRemove;
  
  // 如果有更新，立即渲染所有更新（一次性渲染，不会一个一个重绘）
  if (hasUpdates) {
    // 强制渲染所有对象，确保所有字体更新都显示出来
    // 直接调用renderAll，不使用requestAnimationFrame，确保立即渲染
    canvasInstance.renderAll();
  }
  
  // 调试信息（开发时使用）
  if (process.env.NODE_ENV === 'development' && updatedCount > 0) {
    console.log(`字体更新: 已更新 ${updatedCount} 个标签的字体/字重`);
  }
};

// 处理导出命令
const handleExportCommand = (command) => {
  if (command === 'svg') {
    // SVG导出也需要弹出设置对话框
    prepareExportDialog(command);
  } else if (command === 'png' || command === 'jpeg') {
    prepareExportDialog(command);
  }
};

// 准备导出对话框
function prepareExportDialog(format) {
  exportFormat.value = format;
  // 尺寸默认用canvas实际宽高
  if (canvasInstance) {
    const w = canvasInstance.getWidth();
    const h = canvasInstance.getHeight();
    exportWidth.value = w;
    exportHeight.value = h;
    origWidth.value = w;
    origHeight.value = h;
    _aspectRatio = w / h;
  } else {
    exportWidth.value = 800;
    exportHeight.value = 600;
    origWidth.value = 800;
    origHeight.value = 600;
    _aspectRatio = 800 / 600;
  }
  lockAspectRatio.value = true;
  exportDialogVisible.value = true;
}

// 响应宽度变化，锁定比例
function onExportWidthChange(val) {
  if (lockAspectRatio.value && origWidth.value && origHeight.value) {
    const w = Number(val) || 1;
    exportHeight.value = Math.round((w / origWidth.value) * origHeight.value);
  }
}

// 响应高度变化，锁定比例
function onExportHeightChange(val) {
  if (lockAspectRatio.value && origWidth.value && origHeight.value) {
    const h = Number(val) || 1;
    exportWidth.value = Math.round((h / origHeight.value) * origWidth.value);
  }
}

// 确认导出
const handleExportConfirm = () => {
  exportDialogVisible.value = false;
  if (exportFormat.value === 'svg') {
    exportAsSVG();
  } else {
    exportAsRaster(exportFormat.value, exportWidth.value, exportHeight.value);
  }
};

// 生成图例的SVG元素
const generateLegendSVG = (canvasWidth, canvasHeight) => {
  // 图例在原始canvas中的位置（右上角，距离边缘16px）
  const legendRight = 16;
  const legendTop = 16;
  const legendMinWidth = 180;
  
  // 计算图例位置和尺寸
  const legendX = canvasWidth - legendRight - legendMinWidth;
  const legendY = legendTop;
  const legendWidth = legendMinWidth;
  const padding = 12;
  const titleFontSize = 14;
  const colorBarHeight = 24;
  const colorBarGap = 2;
  const textFontSize = 12;
  const radius = 8;
  
  // 计算图例高度
  const titleHeight = titleFontSize + 8;
  const colorBarArea = colorBarHeight + 8;
  const textHeight = textFontSize + 8;
  const legendHeight = padding * 2 + titleHeight + colorBarArea + textHeight;
  
  // 获取语言设置
  const language = poiStore.fontSettings.language || 'zh';
  const titleText = language === 'en' ? 'Semantic Similarity' : '语义相似度';
  
  // 获取颜色调色板
  const palette = poiStore.colorSettings.palette || [];
  const colorCount = palette.length;
  const colorBarWidth = (legendWidth - padding * 2 - (colorBarGap * (colorCount - 1))) / colorCount;
  
  // 计算各个色块之间的分界点
  const boundaries = calculateColorBoundaries();
  const hasBoundaries = boundaries.length > 0 && allowRenderCloud.value && maxSimilarity.value !== undefined && minSimilarity.value !== undefined;
  
  // 如果有相似度标签，需要增加高度
  const boundaryTextHeight = hasBoundaries ? textFontSize + 4 : 0;
  const legendHeightWithBoundaries = legendHeight + boundaryTextHeight;
  
  // 构建SVG元素
  let legendSVG = '';
  
  // 定义图例组
  legendSVG += `<g id="similarity-legend">`;
  
  // 绘制圆角矩形背景
  legendSVG += `<rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="${legendHeightWithBoundaries}" rx="${radius}" ry="${radius}" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
  
  // 转义XML特殊字符
  const escapeXML = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };
  
  // 绘制标题
  legendSVG += `<text x="${legendX + padding}" y="${legendY + padding + titleFontSize}" font-family="sans-serif" font-size="${titleFontSize}" font-weight="500" fill="#ffffff">${escapeXML(titleText)}</text>`;
  
  // 绘制颜色条
  const colorBarY = legendY + padding + titleHeight;
  let currentX = legendX + padding;
  
  palette.forEach((color, index) => {
    // 绘制色块
    let fillColor = color;
    if (color.startsWith('rgb')) {
      fillColor = color;
    }
    legendSVG += `<rect x="${currentX}" y="${colorBarY}" width="${colorBarWidth}" height="${colorBarHeight}" fill="${fillColor}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;
    currentX += colorBarWidth + colorBarGap;
  });
  
  // 在色块下面一行绘制相似度标签
  if (hasBoundaries) {
    const boundaryTextY = colorBarY + colorBarHeight + 4 + textFontSize;
    
    // 绘制第一个标签（最大相似度，在第一个色块的左边界）
    const maxSimText = formatSimilarity(maxSimilarity.value);
    legendSVG += `<text x="${legendX + padding}" y="${boundaryTextY}" font-family="sans-serif" font-size="${textFontSize}" fill="rgba(255,255,255,0.8)" text-anchor="start">${escapeXML(maxSimText)}</text>`;
    
    // 绘制分界点标签（在每个色块的右边界）
    let currentX = legendX + padding;
    boundaries.forEach((boundary, index) => {
      currentX += colorBarWidth + colorBarGap;
      const boundaryText = formatSimilarity(boundary);
      legendSVG += `<text x="${currentX}" y="${boundaryTextY}" font-family="sans-serif" font-size="${textFontSize}" fill="rgba(255,255,255,0.8)" text-anchor="middle">${escapeXML(boundaryText)}</text>`;
    });
    
    // 绘制最小相似度标签（在最右边）
    if (minSimilarity.value !== undefined) {
      const minSimText = formatSimilarity(minSimilarity.value);
      const totalBarWidth = legendWidth - padding * 2;
      const rightEdgeX = legendX + padding + totalBarWidth; // 最后一个色块右边界
      legendSVG += `<text x="${rightEdgeX}" y="${boundaryTextY}" font-family="sans-serif" font-size="${textFontSize}" fill="rgba(255,255,255,0.8)" text-anchor="middle">${escapeXML(minSimText)}</text>`;
    }
  }
  
  legendSVG += `</g>`;
  
  return legendSVG;
};

// 导出为SVG
const exportAsSVG = () => {
  if (!canvasInstance) return;
  
  // Fabric.js 6.x 使用 toSVG 方法
  let svgString = canvasInstance.toSVG();
  
  // 如果用户选择包含图例，添加图例元素
  if (includeLegend.value) {
    // 获取canvas尺寸
    const canvasWidth = canvasInstance.getWidth();
    const canvasHeight = canvasInstance.getHeight();
    
    // 生成图例SVG
    const legendSVG = generateLegendSVG(canvasWidth, canvasHeight);
    
    // 将图例插入到SVG中（在</svg>标签之前）
    // 使用正则表达式确保只替换最后一个</svg>标签
    svgString = svgString.replace(/<\/svg>\s*$/, `${legendSVG}</svg>`);
  }
  
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tag-cloud.svg';
  link.click();
  URL.revokeObjectURL(url);
};

// 在canvas上绘制图例
const drawLegendOnCanvas = (ctx, imageWidth, imageHeight, scaleX, scaleY, offsetX = 0, offsetY = 0) => {
  // 图例在原始canvas中的位置（右上角，距离边缘16px）
  const legendRight = 16;
  const legendTop = 16;
  const legendMinWidth = 180;
  
  // 计算图例在导出canvas中的位置和尺寸（相对于图片的位置）
  const legendX = offsetX + imageWidth - (legendRight * scaleX) - (legendMinWidth * scaleX);
  const legendY = offsetY + legendTop * scaleY;
  const legendWidth = legendMinWidth * scaleX;
  const padding = 12 * scaleX;
  const titleFontSize = 14 * scaleY;
  const colorBarHeight = 24 * scaleY;
  const colorBarGap = 2 * scaleX;
  const textFontSize = 12 * scaleY;
  
  // 绘制图例背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1 * scaleX;
  
  // 计算图例高度
  const titleHeight = titleFontSize + 8 * scaleY;
  const colorBarArea = colorBarHeight + 8 * scaleY;
  const textHeight = textFontSize + 8 * scaleY;
  const legendHeight = padding * 2 + titleHeight + colorBarArea + textHeight;
  
  // 绘制圆角矩形背景
  const radius = 8 * scaleX;
  ctx.beginPath();
  ctx.moveTo(legendX + radius, legendY);
  ctx.lineTo(legendX + legendWidth - radius, legendY);
  ctx.quadraticCurveTo(legendX + legendWidth, legendY, legendX + legendWidth, legendY + radius);
  ctx.lineTo(legendX + legendWidth, legendY + legendHeight - radius);
  ctx.quadraticCurveTo(legendX + legendWidth, legendY + legendHeight, legendX + legendWidth - radius, legendY + legendHeight);
  ctx.lineTo(legendX + radius, legendY + legendHeight);
  ctx.quadraticCurveTo(legendX, legendY + legendHeight, legendX, legendY + legendHeight - radius);
  ctx.lineTo(legendX, legendY + radius);
  ctx.quadraticCurveTo(legendX, legendY, legendX + radius, legendY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // 绘制标题
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 ${titleFontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const language = poiStore.fontSettings.language || 'zh';
  const titleText = language === 'en' ? 'Semantic Similarity' : '语义相似度';
  ctx.fillText(titleText, legendX + padding, legendY + padding);
  
  // 绘制颜色条
  const colorBarY = legendY + padding + titleHeight;
  const palette = poiStore.colorSettings.palette || [];
  const colorCount = palette.length;
  const colorBarWidth = (legendWidth - padding * 2 - (colorBarGap * (colorCount - 1))) / colorCount;
  
  // 计算各个色块之间的分界点
  const boundaries = calculateColorBoundaries();
  const hasBoundaries = boundaries.length > 0 && allowRenderCloud.value && maxSimilarity.value !== undefined && minSimilarity.value !== undefined;
  
  // 如果有相似度标签，需要增加高度
  const boundaryTextHeight = hasBoundaries ? textFontSize + 4 * scaleY : 0;
  const legendHeightWithBoundaries = legendHeight + boundaryTextHeight;
  
  // 更新背景高度
  ctx.beginPath();
  ctx.moveTo(legendX + radius, legendY);
  ctx.lineTo(legendX + legendWidth - radius, legendY);
  ctx.quadraticCurveTo(legendX + legendWidth, legendY, legendX + legendWidth, legendY + radius);
  ctx.lineTo(legendX + legendWidth, legendY + legendHeightWithBoundaries - radius);
  ctx.quadraticCurveTo(legendX + legendWidth, legendY + legendHeightWithBoundaries, legendX + legendWidth - radius, legendY + legendHeightWithBoundaries);
  ctx.lineTo(legendX + radius, legendY + legendHeightWithBoundaries);
  ctx.quadraticCurveTo(legendX, legendY + legendHeightWithBoundaries, legendX, legendY + legendHeightWithBoundaries - radius);
  ctx.lineTo(legendX, legendY + radius);
  ctx.quadraticCurveTo(legendX, legendY, legendX + radius, legendY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  let currentX = legendX + padding;
  
  palette.forEach((color, index) => {
    // 绘制色块
    ctx.fillStyle = color;
    ctx.fillRect(currentX, colorBarY, colorBarWidth, colorBarHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1 * scaleX;
    ctx.strokeRect(currentX, colorBarY, colorBarWidth, colorBarHeight);
    currentX += colorBarWidth + colorBarGap;
  });
  
  // 在色块下面一行绘制相似度标签
  if (hasBoundaries) {
    const boundaryTextY = colorBarY + colorBarHeight + 4 * scaleY + textFontSize;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${textFontSize}px sans-serif`;
    ctx.textBaseline = 'top';
    
    // 绘制第一个标签（最大相似度，在第一个色块的左边界）
    ctx.textAlign = 'left';
    const maxSimText = formatSimilarity(maxSimilarity.value);
    ctx.fillText(maxSimText, legendX + padding, boundaryTextY);
    
    // 绘制分界点标签（在每个色块的右边界）
    ctx.textAlign = 'center';
    let currentX = legendX + padding;
    boundaries.forEach((boundary, index) => {
      currentX += colorBarWidth + colorBarGap;
      const boundaryText = formatSimilarity(boundary);
      ctx.fillText(boundaryText, currentX, boundaryTextY);
    });
    
    // 绘制最小相似度标签（在最右边）
    if (minSimilarity.value !== undefined) {
      const minSimText = formatSimilarity(minSimilarity.value);
      const totalBarWidth = legendWidth - padding * 2;
      const rightEdgeX = legendX + padding + totalBarWidth; // 最后一个色块右边界
      ctx.textAlign = 'center';
      ctx.fillText(minSimText, rightEdgeX, boundaryTextY);
    }
  }
};

// 导出为位图格式（PNG/JPEG）
const exportAsRaster = async (format = 'png', exportWidth = 800, exportHeight = 600) => {
  if (!canvasInstance) return;
  
  // 获取当前canvas尺寸
  const currentWidth = canvasInstance.getWidth();
  const currentHeight = canvasInstance.getHeight();
  
  // 计算缩放比例（使用较大的比例以确保覆盖目标尺寸）
  const scaleX = exportWidth / currentWidth;
  const scaleY = exportHeight / currentHeight;
  const multiplier = Math.max(scaleX, scaleY);
  
  // 使用Fabric.js的toDataURL方法，通过multiplier参数控制分辨率
  // 注意：multiplier是相对于当前canvas尺寸的倍数
  const dataURL = canvasInstance.toDataURL({
    format: format === 'jpeg' ? 'jpeg' : 'png',
    multiplier: multiplier,
    quality: format === 'jpeg' ? 0.92 : 1,
  });
  
  // 如果目标尺寸与当前canvas尺寸不同，需要调整到精确尺寸
  const img = new Image();
  img.onload = function() {
    // 创建临时canvas，精确控制输出尺寸
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 设置背景色
    const bgColor = poiStore.colorSettings.background || '#ffffff';
    tempCtx.fillStyle = bgColor;
    tempCtx.fillRect(0, 0, exportWidth, exportHeight);
    
    // 计算绘制区域，保持宽高比并居中显示
    const imgWidth = img.width;
    const imgHeight = img.height;
    const targetAspect = exportWidth / exportHeight;
    const imgAspect = imgWidth / imgHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgAspect > targetAspect) {
      // 图片更宽，以高度为准
      drawHeight = exportHeight;
      drawWidth = exportHeight * imgAspect;
      drawX = (exportWidth - drawWidth) / 2;
      drawY = 0;
    } else {
      // 图片更高，以宽度为准
      drawWidth = exportWidth;
      drawHeight = exportWidth / imgAspect;
      drawX = 0;
      drawY = (exportHeight - drawHeight) / 2;
    }
    
    // 绘制图片
    tempCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    
    // 如果用户选择包含图例，绘制图例
    if (includeLegend.value) {
      // 计算图例的缩放比例（基于实际绘制的图片尺寸）
      const actualScaleX = drawWidth / currentWidth;
      const actualScaleY = drawHeight / currentHeight;
      // 图例应该绘制在图片的右上角，所以需要考虑图片的偏移
      drawLegendOnCanvas(tempCtx, drawWidth, drawHeight, actualScaleX, actualScaleY, drawX, drawY);
    }
    
    // 转换为目标格式
    const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const finalDataURL = tempCanvas.toDataURL(type, format === 'jpeg' ? 0.92 : 1);
    
    // 下载
    const link = document.createElement('a');
    link.href = finalDataURL;
    link.download = `tag-cloud.${format}`;
    link.click();
  };
  img.onerror = () => {
    alert('图片导出失败，请重试！');
  };
  img.src = dataURL;
};

onMounted(() => {
  // 初始化canvas尺寸（只执行一次，固定大小）
  initCanvasSize();
  // 初始化高德地图和Driving实例
  initAMapDriving();
  // 初始化canvas，默认显示并使用设定好的背景色
  nextTick(() => {
    if (canvasRef.value) {
      initCanvas();
    }
  });
  // 不再监听窗口大小变化，canvas尺寸固定
});

// 监听清除标签云事件
watch(
  () => poiStore.hasDrawing,
  (hasDrawing) => {
    if (!hasDrawing) {
      // 当hasDrawing变为false时，清除标签云（无论allowRenderCloud的值如何）
      clearTagCloud();
    }
  },
);

// 监听数据列表变化（需要重新渲染）
watch(
  () => poiStore.visibleList,
  (newList, oldList) => {
    // 如果正在清除，不触发重新渲染
    if (isClearing.value) return;
    
    if (allowRenderCloud.value) {
      // 只有当数据真正变化时才重新初始化金字塔
      // 通过比较长度和第一个元素的id来判断是否真的变化了
      const isDataChanged = !oldList || 
        newList.length !== oldList.length ||
        (newList.length > 0 && oldList.length > 0 && newList[0].id !== oldList[0].id);
      
      if (isDataChanged) {
        // 数据变化时需要重新初始化金字塔
        renderCloud(true);
      }
    }
  },
  { deep: false },
);

// 监听字体设置变化（只有字号变化才重新绘制）
watch(
  () => poiStore.fontSettings.fontSizes,
  () => {
    // 如果正在清除，不触发重新渲染
    if (isClearing.value) return;
    
    if (allowRenderCloud.value) {
      // 字号变化需要重新绘制（影响布局）
      renderCloud(false);
    }
  },
  { deep: true },
);

// 监听颜色设置变化（直接更新，不重新绘制）
watch(
  () => poiStore.colorSettings,
  (newVal, oldVal) => {
    if (allowRenderCloud.value && canvasInstance) {
      // 只有palette、discreteCount、discreteMethod变化才更新颜色
      // background变化已经在单独的watch中处理
      if (newVal.palette !== oldVal?.palette || 
          newVal.discreteCount !== oldVal?.discreteCount ||
          newVal.discreteMethod !== oldVal?.discreteMethod) {
        updateLabelColors();
      }
    }
  },
  { deep: true },
);

// 监听字体和字重变化（直接更新，不重新绘制）
watch(
  () => [poiStore.fontSettings.fontFamily, poiStore.fontSettings.fontWeight],
  () => {
    if (allowRenderCloud.value) {
      updateLabelFonts();
    }
  },
);

// 监听语言变化（需要重新绘制，因为文本内容变化）
watch(
  () => poiStore.fontSettings.language,
  () => {
    // 如果正在清除，不触发重新渲染
    if (isClearing.value) return;
    
    if (allowRenderCloud.value) {
      // 语言变化需要重新绘制（文本内容变化）
      renderCloud(false);
    }
  },
);

// 监听算法设置变化，触发重新渲染
watch(
  () => poiStore.algorithmSettings?.layoutAlgorithm,
  () => {
    // 如果正在清除，不触发重新渲染
    if (isClearing.value) return;
    
    if (allowRenderCloud.value) {
      // 算法变化需要重新绘制
      renderCloud(false);
    }
  },
);

  

onBeforeUnmount(() => {
  if (resizeObserver && wrapperRef.value) {
    resizeObserver.unobserve(wrapperRef.value);
    resizeObserver = null;
  }
  if (canvasInstance) canvasInstance.dispose();
});
</script>

<style scoped>
.tagcloud-panel {
  background: #01030c;
  color: #fff;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 650px;
  width: 100%;
  height: 100%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
}
.canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.subtext {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

canvas {
  border-radius: 12px;
  background: #050816;
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.empty-cloud-hint {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(5, 8, 22, 0.95) 0%, rgba(12, 16, 36, 0.9) 100%);
  backdrop-filter: blur(8px);
  z-index: 5;
  pointer-events: none;
}

.hint-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px;
  text-align: center;
  max-width: 500px;
}

.hint-icon {
  width: 80px;
  height: 80px;
  color: rgba(255, 255, 255, 0.3);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.hint-text {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.5px;
}

.hint-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.3px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-options {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
}

.toolbar-options :deep(.el-checkbox__label) {
  color: #fff !important;
}

.toolbar-options :deep(.el-checkbox) {
  color: #fff;
}

.toolbar-options :deep(.first-checkbox) {
  margin-right: 0 !important;
}

.label-count {
  color: #fff;
  font-size: 14px;
  margin-left: 12px;
  padding: 0 8px;
}

.similarity-progress {
  margin-left: 12px;
  min-width: 200px;
}

.similarity-progress-bar {
  width: 200px;
}

.similarity-progress-bar :deep(.el-progress__text) {
  color: #fff;
  font-size: 12px;
}

.label-count-number {
  font-weight: 600;
  display: inline-block;
  min-width: 60px;
  text-align: center;
}

.similarity-progress {
  margin-left: 12px;
  min-width: 200px;
}

.similarity-progress-bar {
  width: 200px;
}

.similarity-progress-bar :deep(.el-progress__text) {
  color: #fff;
  font-size: 12px;
}

.tagcloud-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
}

/* 距离图例 */
.distance-legend {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 180px;
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
}

.legend-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.legend-colors-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-colors {
  display: flex;
  gap: 2px;
  height: 24px;
}

.legend-color-item {
  flex: 1;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 20px;
  height: 24px;
}

.legend-color-item:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
  z-index: 1;
  position: relative;
}

.legend-boundaries {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  position: relative;
  height: 16px;
  padding: 0 2px;
  width: 100%;
  box-sizing: border-box;
}

.legend-boundary-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  line-height: 16px;
  position: absolute;
  min-width: 0;
}

.legend-boundary-label.legend-start {
  left: 0;
  text-align: right;
  transform: translateX(-50%);
  padding-right: 2px;
}

.legend-boundary-label.legend-middle {
  text-align: center;
  transform: translateX(-50%);
  /* 确保标签不会超出边界 */
  max-width: calc(100% / var(--color-count, 5) - 4px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-boundary-label.legend-max-distance {
  right: 0;
  text-align: center;
  transform: translateX(50%);
}

/* Canvas工具栏 */
.canvas-toolbar {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
}

.canvas-toolbar :deep(.el-button) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.canvas-toolbar :deep(.el-button:hover) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.canvas-toolbar :deep(.el-button.is-circle) {
  width: 36px;
  height: 36px;
  display: flex;
  margin: 0;
  align-items: center;
  justify-content: center;
}

/* POI信息窗口 */
.poi-info-window {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 320px;
  max-width: calc(100% - 32px);
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  z-index: 20;
  animation: slideInUp 0.3s ease-out;
  pointer-events: auto;
}

@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.info-window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-window-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.info-window-header .close-btn {
  color: rgba(255, 255, 255, 0.7);
  padding: 4px;
}

.info-window-header .close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.info-window-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.6;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
  min-width: 80px;
  flex-shrink: 0;
}

.info-value {
  color: #fff;
  font-weight: 500;
  word-break: break-word;
}
</style>

