<template>
  <section class="panel-card algorithm-panel">
    <!-- 算法布局选择 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">算法布局</span>
        <span class="section-desc">选择标签云的布局算法</span>
      </div>
      <div class="section-content">
        <el-select
          v-model="localAlgorithm"
          style="width: 100%"
          @change="handleAlgorithmChange"
        >
          <el-option
            label="多角度径向移位算法"
            value="multi-angle-radial"
          />
          <el-option
            label="单角度径向移位算法"
            value="single-angle-radial"
          />
          <el-option
            label="阿基米德螺线算法"
            value="archimedean-spiral"
          />
        </el-select>
        <div class="algorithm-desc">
          <p v-if="localAlgorithm === 'multi-angle-radial'">
            按照地点标签真实方向角，在±15°扇形范围内使用多角度径向移位算法从中心向外探测可放置位置。
          </p>
          <p v-if="localAlgorithm === 'single-angle-radial'">
            直接按照地点标签真实方向角从中心向外径向移动，直到移动到空闲区域进行摆放。
          </p>
          <p v-if="localAlgorithm === 'archimedean-spiral'">
            使用 d3-cloud 库实现的阿基米德螺线算法进行布局。
          </p>
        </div>
      </div>
    </div>

    <!-- 算法指标展示 -->
    <div class="config-section">
      <div class="section-header">
        <span class="section-title">算法指标</span>
        <span class="section-desc">当前布局算法的性能指标</span>
      </div>
      <div class="section-content">
        <div v-if="!poiStore.layoutMetrics" class="metrics-empty">
          <p>暂无指标数据，请先运行生成标签云</p>
        </div>
        <div v-else class="metrics-content">
          <!-- 1. 标签数量 -->
          <div class="metric-item">
            <div class="metric-label">本轮渲染的标签数量</div>
            <div class="metric-value">{{ poiStore.layoutMetrics.labelCount }}</div>
          </div>

          <!-- 2. 空间紧凑度CI -->
          <div class="metric-item">
            <div class="metric-label">空间紧凑度 CI</div>
            <div class="metric-value">{{ formatNumber(poiStore.layoutMetrics.compactnessIndex, 4) }}</div>
            <div class="metric-desc">所有标签面积总和与最小外接矩形面积的比值</div>
          </div>

          <!-- 3. 方向保持度OR -->
          <div class="metric-item">
            <div class="metric-label">方向保持度 OR</div>
            <div class="metric-sub-item">
              <span class="metric-sub-label">平均方向偏移 MAE:</span>
              <span class="metric-sub-value">{{ formatNumber(poiStore.layoutMetrics.orientationRetention.mae, 2) }}°</span>
            </div>
            <div class="metric-sub-item">
              <span class="metric-sub-label">最大方向偏移 MaxE:</span>
              <span class="metric-sub-value">{{ formatNumber(poiStore.layoutMetrics.orientationRetention.maxE, 2) }}°</span>
            </div>
            <div class="metric-desc">真实方向角与摆放方向角的差值（锐角）</div>
          </div>

          <!-- 4. 径向距离与相似度的相关性RDSC -->
          <div class="metric-item">
            <div class="metric-label">径向距离与相似度的相关性 RDSC</div>
            <div class="metric-value">{{ formatNumber(poiStore.layoutMetrics.radialDistanceSimilarityCorrelation, 4) }}</div>
            <div class="metric-desc">采用皮尔逊相关系数（-1到1）</div>
          </div>

          <!-- 5. 布局均匀度LU -->
          <div class="metric-item">
            <div class="metric-label">布局均匀度 LU</div>
            <div class="metric-value">{{ formatNumber(poiStore.layoutMetrics.layoutUniformity, 4) }}</div>
            <div class="metric-desc">将360度圆周等分为36个扇形区间，计算各区间内标签数量的变异系数（CV）</div>
          </div>

          <!-- 6. 运行效率 -->
          <div class="metric-item">
            <div class="metric-label">运行效率</div>
            <div class="metric-value">{{ formatTime(poiStore.layoutMetrics.executionTime) }}</div>
            <div class="metric-desc">算法布局耗时（不包括数据准备和相似度计算）</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { usePoiStore } from '@/stores/poiStore';

const poiStore = usePoiStore();

const localAlgorithm = ref(poiStore.algorithmSettings?.layoutAlgorithm || 'multi-angle-radial');

// 监听 store 的变化，同步到本地
watch(
  () => poiStore.algorithmSettings?.layoutAlgorithm,
  (newValue) => {
    if (newValue && newValue !== localAlgorithm.value) {
      localAlgorithm.value = newValue;
    }
  }
);

const handleAlgorithmChange = () => {
  poiStore.updateAlgorithmSettings({
    layoutAlgorithm: localAlgorithm.value,
  });
};

// 格式化数字
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return Number(value).toFixed(decimals);
};

// 格式化时间（毫秒）
const formatTime = (ms) => {
  if (ms === null || ms === undefined || isNaN(ms)) {
    return 'N/A';
  }
  return `${Number(ms).toFixed(1)} ms`;
};
</script>

<style scoped>
.algorithm-panel {
  min-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0px;
  background: #f5f7fa;
}

.config-section {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.section-header {
  padding: 16px 20px;
  background: #fafbfc;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.section-desc {
  font-size: 12px;
  color: #909399;
  margin-left: 12px;
}

.section-content {
  padding: 20px;
}

.algorithm-desc {
  margin-top: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.algorithm-desc p {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.metrics-empty {
  padding: 40px 20px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.metrics-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.metric-item {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.metric-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 18px;
  font-weight: 700;
  color: #409eff;
  margin: 8px 0;
}

.metric-sub-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.metric-sub-label {
  color: #606266;
}

.metric-sub-value {
  color: #303133;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.metric-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  line-height: 1.5;
}
</style>

