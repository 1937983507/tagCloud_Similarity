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
            按照地点标签真实方向角，在±15°扇形范围内使用阿基米德螺线算法从中心向外探测可放置位置。
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
</style>

