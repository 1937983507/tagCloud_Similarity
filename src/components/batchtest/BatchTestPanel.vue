<template>
  <div class="batch-test-panel">
    <div class="panel-header">
      <h2>批量测试</h2>
      <el-alert
        title="功能说明"
        type="info"
        :closable="false"
        style="margin-top: 12px;"
      >
        <p style="margin: 0; font-size: 13px;">
          批量测试将生成多个测试用例（含中心经纬度坐标和半径），<br/>
          对每个测试用例分别调用三种算法（传统阿基米德螺线、单角度径向移位、多角度径向移位）生成词云，<br/>
          并记录各项指标（中心经纬度、半径、渲染标签数量、算法指标等）。<br/>
          由于需要计算相似度和生成词云，批量测试会非常耗时，请耐心等待。
        </p>
      </el-alert>
    </div>
    
    <el-tabs v-model="activeTab" class="test-tabs" style="margin-top: 16px;">
      <!-- 自动生成模式 -->
      <el-tab-pane label="自动生成" name="auto">
        <div class="tab-content">
          <div class="input-section">
            <div class="input-row">
              <label>测试用例数量：</label>
              <el-input-number
                v-model="testCaseCount"
                :min="1"
                :max="1000"
                :step="1"
                style="width: 150px;"
              />
            </div>
            
            <el-button 
              type="primary" 
              @click="handleGenerateTestCases"
              :disabled="testCaseCount < 1 || generatingCases"
              :loading="generatingCases"
              style="margin-top: 16px;"
            >
              {{ generatingCases ? '生成中...' : '生成测试用例' }}
            </el-button>
          </div>
          
          <div v-if="testCases.length > 0" class="test-cases-section">
            <h3>生成的测试用例（{{ testCases.length }}个）：</h3>
            <div class="test-case-list">
              <div 
                v-for="(testCase, index) in testCases" 
                :key="index"
                class="test-case-item"
              >
                <span class="case-number">{{ index + 1 }}</span>
                <span class="case-info">
                  <span v-if="testCase.cityName" class="city-name">{{ testCase.cityName }}</span>
                  中心: ({{ testCase.centerLng.toFixed(4) }}, {{ testCase.centerLat.toFixed(4) }}), 
                  半径: {{ testCase.radius.toFixed(1) }}km
                </span>
                <el-button 
                  type="danger" 
                  size="small" 
                  text
                  @click="removeTestCase(index)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
    
    <!-- 测试控制区域 -->
    <div class="test-control-section">
      <div class="test-info">
        <span>总测试用例数：{{ testCases.length }}</span>
        <span v-if="testing" class="test-progress">
          当前进度：{{ currentTestIndex }} / {{ testCases.length }}
        </span>
      </div>
      <el-progress 
        v-if="testing && testCases.length > 0"
        :percentage="Math.round((currentTestIndex / testCases.length) * 100)"
        :stroke-width="8"
        style="margin-top: 12px; margin-bottom: 16px;"
      />
      
      <div class="test-buttons">
        <el-button 
          type="primary" 
          @click="handleStartTest"
          :disabled="testCases.length === 0 || testing"
          :loading="testing"
        >
          {{ testing ? '测试中...' : '开始测试' }}
        </el-button>
        <el-button 
          @click="handleStopTest"
          :disabled="!testing"
        >
          停止测试
        </el-button>
        <el-button 
          @click="handleClearResults"
          :disabled="testing || testResults.length === 0"
        >
          清空结果
        </el-button>
        <el-button 
          type="success"
          @click="handleExportResults"
          :disabled="testResults.length === 0"
        >
          导出结果
        </el-button>
      </div>
    </div>
    
    <!-- 测试结果区域 -->
    <div v-if="testResults.length > 0" class="test-results-section">
      <h3>测试结果（{{ testResults.length }}条）：</h3>
      <div class="results-table-wrapper">
        <table class="results-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>中心经度</th>
              <th>中心纬度</th>
              <th>半径(km)</th>
              <th>算法</th>
              <th>渲染标签数</th>
              <th>空间紧凑度CI</th>
              <th>方向保持度MAE(°)</th>
              <th>方向保持度MaxE(°)</th>
              <th>径向距离相似度相关性RDSC</th>
              <th>布局均匀度LU</th>
              <th>运行效率(ms)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, index) in testResults" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ result.centerLng.toFixed(4) }}</td>
              <td>{{ result.centerLat.toFixed(4) }}</td>
              <td>{{ result.radius.toFixed(1) }}</td>
              <td>{{ result.algorithm }}</td>
              <td>{{ result.labelCount }}</td>
              <td>{{ result.compactnessIndex !== undefined ? result.compactnessIndex.toFixed(4) : '-' }}</td>
              <td>{{ result.orientationRetention?.mae !== undefined ? result.orientationRetention.mae.toFixed(2) : '-' }}</td>
              <td>{{ result.orientationRetention?.maxE !== undefined ? result.orientationRetention.maxE.toFixed(2) : '-' }}</td>
              <td>{{ result.radialDistanceSimilarityCorrelation !== undefined ? result.radialDistanceSimilarityCorrelation.toFixed(4) : '-' }}</td>
              <td>{{ result.layoutUniformity !== undefined ? result.layoutUniformity.toFixed(4) : '-' }}</td>
              <td>{{ result.executionTime !== undefined ? result.executionTime.toFixed(1) : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { usePoiStore } from '@/stores/poiStore';
import { 
  generateRandomTestCases,
  filterPoisInRange,
  findNearestPoi
} from '@/utils/batchTestUtils';
import { calculateSimilarities } from '@/utils/similarity';
import { layoutTagCloud, measureText } from '@/utils/tagCloudLayout';
import { calculateLayoutMetrics } from '@/utils/layoutMetrics';
import { cityNameToPinyin } from '@/utils/cityNameToPinyin';

const poiStore = usePoiStore();

// 标签页
const activeTab = ref('auto');

// 测试用例
const testCaseCount = ref(10);
const generatingCases = ref(false);
const testCases = ref([]);

// 测试控制
const testing = ref(false);
const shouldStop = ref(false);
const currentTestIndex = ref(0);
const testResults = ref([]);

// 生成测试用例
const handleGenerateTestCases = async () => {
  generatingCases.value = true;
  try {
    testCases.value = await generateRandomTestCases(testCaseCount.value);
    ElMessage.success(`成功生成 ${testCases.value.length} 个测试用例`);
  } catch (error) {
    console.error('生成测试用例失败:', error);
    ElMessage.error('生成测试用例失败：' + error.message);
  } finally {
    generatingCases.value = false;
  }
};

// 删除测试用例
const removeTestCase = (index) => {
  testCases.value.splice(index, 1);
  ElMessage.info('已删除测试用例');
};

// 开始测试
const handleStartTest = async () => {
  if (testCases.value.length === 0) {
    ElMessage.warning('请先生成测试用例');
    return;
  }
  
  // 确认开始测试
  try {
    await ElMessageBox.confirm(
      `即将开始测试 ${testCases.value.length} 个用例。每个用例将对三种算法分别进行测试，耗时较长。`,
      '确认开始测试',
      {
        confirmButtonText: '开始',
        cancelButtonText: '取消',
        type: 'info',
      }
    );
  } catch {
    return;
  }
  
  // 确保POI数据已加载
  try {
    if (!poiStore.poiList || poiStore.poiList.length === 0) {
      ElMessage.info('正在加载POI数据...');
      await poiStore.loadDefaultData();
      if (!poiStore.poiList || poiStore.poiList.length === 0) {
        throw new Error('POI数据加载后仍为空');
      }
      ElMessage.success('POI数据加载完成');
    }
  } catch (error) {
    ElMessage.error('POI数据加载失败：' + error.message);
    return;
  }
  
  testing.value = true;
  shouldStop.value = false;
  currentTestIndex.value = 0;
  testResults.value = [];
  
  // 记录原始测试用例数量
  const originalTestCaseCount = testCases.value.length;
  let completedTestCaseCount = 0;
  let maxRetries = originalTestCaseCount * 5; // 最大重试次数：原始用例数的5倍
  let retryCount = 0;
  
  // 逐个执行测试，如果失败则自动替换
  let i = 0;
  while (i < testCases.value.length && completedTestCaseCount < originalTestCaseCount && retryCount < maxRetries) {
    if (shouldStop.value) {
      ElMessage.info('测试已停止');
      break;
    }
    
    currentTestIndex.value = i + 1;
    retryCount++;
    
    try {
      const testCase = testCases.value[i];
      // 对每个测试用例，分别测试三种算法
      const algorithms = ['archimedean-spiral', 'single-angle-radial', 'multi-angle-radial'];
      let testCaseSuccess = true;
      const testCaseResults = [];
      
      for (const algorithm of algorithms) {
        if (shouldStop.value) break;
        
        try {
          const result = await executeSingleTest(testCase, algorithm);
          testCaseResults.push(result);
        } catch (error) {
          // 如果某个算法失败，整个测试用例失败
          console.error(`测试用例 ${i + 1} 的算法 ${algorithm} 失败:`, error);
          testCaseSuccess = false;
          break;
        }
      }
      
      if (testCaseSuccess && testCaseResults.length === algorithms.length) {
        // 测试用例成功，添加所有结果
        testResults.value.push(...testCaseResults);
        completedTestCaseCount++;
        i++; // 移动到下一个测试用例
      } else {
        // 测试用例失败，删除并替换
        console.warn(`测试用例 ${i + 1} 失败，正在替换...`);
        testCases.value.splice(i, 1); // 删除失败的测试用例
        
        // 生成新的测试用例来替代
        try {
          const newTestCases = await generateRandomTestCases(1);
          if (newTestCases.length > 0) {
            testCases.value.splice(i, 0, ...newTestCases); // 在相同位置插入新用例
            console.log(`已生成新的测试用例替代失败的用例`);
          } else {
            // 如果生成失败，尝试继续下一个
            console.error('无法生成新的测试用例');
            i++;
          }
        } catch (error) {
          console.error('生成新测试用例失败:', error);
          i++;
        }
        // 不增加 completedTestCaseCount，继续重试当前索引
      }
    } catch (error) {
      // 捕获其他未预期的错误
      console.error(`测试用例 ${i + 1} 发生未预期错误:`, error);
      
      // 删除失败的测试用例并替换
      testCases.value.splice(i, 1);
      try {
        const newTestCases = await generateRandomTestCases(1);
        if (newTestCases.length > 0) {
          testCases.value.splice(i, 0, ...newTestCases);
        } else {
          i++;
        }
      } catch (error) {
        console.error('生成新测试用例失败:', error);
        i++;
      }
    }
  }
  
  // 如果达到最大重试次数，给出警告
  if (retryCount >= maxRetries && completedTestCaseCount < originalTestCaseCount) {
    console.warn('测试用例替换次数达到上限，停止测试');
    ElMessage.warning(`部分测试用例无法完成（已完成 ${completedTestCaseCount}/${originalTestCaseCount} 个用例）`);
  }
  
  testing.value = false;
  const expectedResultsCount = originalTestCaseCount * 3; // 每个测试用例有3个算法结果
  ElMessage.success(`测试完成！共完成 ${testResults.value.length} 个结果（期望 ${expectedResultsCount} 个）`);
};

// 执行单个测试用例
const executeSingleTest = async (testCase, algorithm) => {
  const { centerLng, centerLat, radius } = testCase;
  
  // ========== 数据准备阶段（只执行一次，不包含在运行效率中） ==========
  // 1. 筛选POI数据
  const filteredPois = filterPoisInRange(
    poiStore.poiList,
    centerLng,
    centerLat,
    radius
  );
  
  if (filteredPois.length === 0) {
    throw new Error('该范围内没有POI数据');
  }
  
  // 2. 找到中心地点
  const centerPoi = findNearestPoi(filteredPois, centerLng, centerLat);
  if (!centerPoi) {
    throw new Error('无法找到中心地点');
  }
  
  // 3. 获取周边地点（排除中心地点）
  const surroundingPois = filteredPois.filter(poi => poi.id !== centerPoi.id);
  
  if (surroundingPois.length === 0) {
    throw new Error('没有周边地点可渲染');
  }
  
  // 4. 计算相似度（不包含在运行效率中）
  const poisWithSimilarity = await calculateSimilarities(
    centerPoi,
    surroundingPois,
    null // 批量测试不显示进度
  );
  
  // 5. 按相似度排序
  const sortedPois = [...poisWithSimilarity].sort((a, b) => {
    const simA = a.similarity !== undefined ? a.similarity : 0;
    const simB = b.similarity !== undefined ? b.similarity : 0;
    return simB - simA; // 降序
  });
  
  // 6. 分配字号和颜色（基于相似度）
  const fontSizes = poiStore.fontSettings.fontSizes;
  const palette = poiStore.colorSettings.palette;
  const levelCount = Math.min(fontSizes.length, palette.length);
  
  const similarities = sortedPois
    .filter(poi => poi.similarity !== undefined)
    .map(poi => poi.similarity || 0);
  
  if (similarities.length === 0) {
    throw new Error('没有相似度数据');
  }
  
  const localMinSimilarity = Math.min(...similarities);
  const localMaxSimilarity = Math.max(...similarities);
  const similarityRange = localMaxSimilarity - localMinSimilarity;
  
  // 中心标签字号
  const firstLevelFontSize = fontSizes && fontSizes.length > 0 ? fontSizes[0] : 64;
  const centerFontSize = firstLevelFontSize * 1.2;
  
  const poisWithStyle = sortedPois.map((poi) => {
    const similarity = poi.similarity || 0;
    const normalizedSimilarity = similarityRange > 0 
      ? (similarity - localMinSimilarity) / similarityRange 
      : 0;
    const level = Math.floor(normalizedSimilarity * (levelCount - 1));
    const finalLevel = Math.min(level, levelCount - 1);
    const fontSizeIndex = levelCount - 1 - finalLevel;
    const fontSize = fontSizes[fontSizeIndex] || fontSizes[0];
    const colorIndex = levelCount - 1 - finalLevel;
    const fontColor = palette[colorIndex] || palette[0];
    
    return {
      ...poi,
      fontSize: fontSize,
      fontColor: fontColor,
      similarityLevel: finalLevel,
    };
  });
  
  // 添加中心标签
  const centerPoiStyled = {
    ...centerPoi,
    fontSize: centerFontSize,
    fontColor: 'rgb(255, 255, 255)',
    similarityLevel: 0,
    isCenter: true,
  };
  
  // 准备布局参数（只准备一次）
  // 注意：三种算法都是"无限画布"设计，会尽力将所有标签都摆放出来
  // centerX 和 centerY 只是作为布局的参考中心点，可以是任意值
  // 这里设置为 0, 0 作为原点，算法会从该点向外无限扩展
  const center = { lng: centerLng, lat: centerLat };
  const centerX = 0; // 布局参考中心点X坐标（无限画布，可以是任意值）
  const centerY = 0; // 布局参考中心点Y坐标（无限画布，可以是任意值）
  
  // 获取POI显示名称的函数
  const getPoiDisplayName = (poi) => {
    const language = poiStore.fontSettings.language || 'zh';
    if (language === 'en') {
      if (poi.name_en && poi.name_en.trim()) {
        return poi.name_en;
      }
      return cityNameToPinyin(poi.name);
    }
    return poi.name;
  };
  
  // 根据算法类型准备数据
  let poisForLayout;
  let centerLabelRect = null;
  
  if (algorithm === 'archimedean-spiral') {
    // d3-cloud算法：包含中心标签
    poisForLayout = [centerPoiStyled, ...poisWithStyle];
  } else {
    // 其他算法：单独处理中心标签
    const { width, height } = measureText(
      getPoiDisplayName(centerPoi),
      centerFontSize,
      'Comic Sans',
      1000
    );
    centerLabelRect = {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height,
    };
    poisForLayout = poisWithStyle;
  }
  
  // ========== 词云生成阶段（重复运行3次，取平均时间） ==========
  const RUN_COUNT = 3; // 重复运行次数
  const layoutTimes = [];
  let finalLayoutResults = null;
  
  // 重复运行布局算法3次
  for (let runIndex = 0; runIndex < RUN_COUNT; runIndex++) {
    // 记录布局开始时间（只包含布局算法的时间）
    const layoutStartTime = performance.now();
    
    // 执行布局（这是唯一包含在运行效率中的操作）
    const layoutResult = layoutTagCloud(
      poisForLayout,
      center,
      centerX,
      centerY,
      poiStore.fontSettings,
      getPoiDisplayName,
      centerLabelRect,
      algorithm
    );
    
    // 处理异步布局（d3-cloud）或同步布局（其他算法）
    const layoutResults = await (layoutResult instanceof Promise ? layoutResult : Promise.resolve(layoutResult));
    
    // 记录布局结束时间
    const layoutEndTime = performance.now();
    const layoutTime = layoutEndTime - layoutStartTime;
    
    layoutTimes.push(layoutTime);
    
    // 保存最后一次运行的结果用于计算指标
    if (runIndex === RUN_COUNT - 1) {
      finalLayoutResults = layoutResults;
    }
  }
  
  // 计算平均运行时间
  const averageLayoutTime = layoutTimes.reduce((sum, time) => sum + time, 0) / RUN_COUNT;
  
  // 8. 计算指标（使用最后一次运行的结果和平均时间）
  const metrics = calculateLayoutMetrics(
    finalLayoutResults,
    center,
    centerX,
    centerY,
    averageLayoutTime // 使用平均时间
  );
  
  // 9. 返回结果
  return {
    centerLng,
    centerLat,
    radius,
    algorithm: getAlgorithmName(algorithm),
    labelCount: metrics.labelCount,
    compactnessIndex: metrics.compactnessIndex,
    orientationRetention: metrics.orientationRetention,
    radialDistanceSimilarityCorrelation: metrics.radialDistanceSimilarityCorrelation,
    layoutUniformity: metrics.layoutUniformity,
    executionTime: metrics.executionTime, // 这是平均运行时间
  };
};

// 获取算法名称
const getAlgorithmName = (algorithm) => {
  const names = {
    'archimedean-spiral': '传统阿基米德螺线',
    'single-angle-radial': '单角度径向移位',
    'multi-angle-radial': '多角度径向移位',
  };
  return names[algorithm] || algorithm;
};

// 停止测试
const handleStopTest = () => {
  shouldStop.value = true;
  ElMessage.info('正在停止测试...');
};

// 清空结果
const handleClearResults = () => {
  testResults.value = [];
  ElMessage.info('已清空测试结果');
};

// 导出结果
const handleExportResults = () => {
  if (testResults.value.length === 0) {
    ElMessage.warning('没有可导出的结果');
    return;
  }
  
  // 转换为CSV格式
  const headers = [
    '序号',
    '中心经度',
    '中心纬度',
    '半径(km)',
    '算法',
    '渲染标签数量',
    '空间紧凑度CI',
    '方向保持度MAE(°)',
    '方向保持度MaxE(°)',
    '径向距离相似度相关性RDSC',
    '布局均匀度LU',
    '运行效率(ms)'
  ];
  
  const rows = testResults.value.map((result, index) => [
    index + 1,
    result.centerLng.toFixed(4),
    result.centerLat.toFixed(4),
    result.radius.toFixed(1),
    result.algorithm,
    result.labelCount,
    result.compactnessIndex !== undefined ? result.compactnessIndex.toFixed(4) : '-',
    result.orientationRetention?.mae !== undefined ? result.orientationRetention.mae.toFixed(2) : '-',
    result.orientationRetention?.maxE !== undefined ? result.orientationRetention.maxE.toFixed(2) : '-',
    result.radialDistanceSimilarityCorrelation !== undefined ? result.radialDistanceSimilarityCorrelation.toFixed(4) : '-',
    result.layoutUniformity !== undefined ? result.layoutUniformity.toFixed(4) : '-',
    result.executionTime !== undefined ? result.executionTime.toFixed(1) : '-'
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // 添加BOM以支持中文
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `batch_test_results_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  ElMessage.success('导出成功');
};
</script>

<style scoped>
.batch-test-panel {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.panel-header h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2333;
}

.test-tabs {
  margin-top: 16px;
}

.tab-content {
  padding: 16px 0;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-section label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-row label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  min-width: 120px;
}

.test-cases-section {
  margin-top: 24px;
}

.test-cases-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2333;
}

.test-case-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.test-case-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.case-number {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #409eff;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.case-info {
  flex: 1;
  font-size: 13px;
  color: #606266;
}

.city-name {
  display: inline-block;
  padding: 2px 8px;
  margin-right: 8px;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 4px;
  font-weight: 500;
  font-size: 12px;
}

.test-control-section {
  padding: 16px 0;
  border-top: 1px solid #e4e7ed;
  margin-top: 16px;
}

.test-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #606266;
}

.test-progress {
  color: #409eff;
  font-weight: 600;
}

.test-buttons {
  display: flex;
  gap: 12px;
}

.test-results-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e4e7ed;
}

.test-results-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2333;
}

.results-table-wrapper {
  max-height: 400px;
  overflow: auto;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.results-table thead {
  background: #f5f7fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.results-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
  white-space: nowrap;
}

.results-table td {
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
  color: #606266;
}

.results-table tbody tr:hover {
  background: #f5f7fa;
}
</style>

