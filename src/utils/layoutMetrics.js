/**
 * 标签云布局算法指标计算工具
 */

/**
 * 计算两点之间的方位角（以正北为0度，顺时针）
 * @param {number} centerLat - 中心点纬度
 * @param {number} centerLng - 中心点经度
 * @param {number} poiLat - POI纬度
 * @param {number} poiLng - POI经度
 * @returns {number} 方位角（度数，0-360）
 */
function calculateBearing(centerLat, centerLng, poiLat, poiLng) {
  const lat1 = (centerLat * Math.PI) / 180;
  const lat2 = (poiLat * Math.PI) / 180;
  const dLng = ((poiLng - centerLng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180) / Math.PI;
  bearing = (bearing + 360) % 360; // 转换为0-360度

  return bearing;
}

/**
 * 计算两点之间的角度差（锐角，0-180度）
 * @param {number} angle1 - 角度1（度）
 * @param {number} angle2 - 角度2（度）
 * @returns {number} 角度差（度，0-180）
 */
function calculateAngleDifference(angle1, angle2) {
  let diff = Math.abs(angle1 - angle2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * 计算从中心点到某点的方位角（Canvas坐标系）
 * @param {number} centerX - 中心点X坐标
 * @param {number} centerY - 中心点Y坐标
 * @param {number} x - 目标点X坐标
 * @param {number} y - 目标点Y坐标
 * @returns {number} 方位角（度数，0-360，以正北为0度，顺时针）
 */
function calculateCanvasBearing(centerX, centerY, x, y) {
  const dx = x - centerX;
  const dy = y - centerY;
  
  // Canvas坐标系：Y轴向下，需要转换为地理坐标系（Y轴向上）
  // 地理坐标系：正北为0度，顺时针
  let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  angle = (angle + 360) % 360;
  
  return angle;
}

/**
 * 计算皮尔逊相关系数
 * @param {Array<number>} x - 数组X
 * @param {Array<number>} y - 数组Y
 * @returns {number} 相关系数（-1到1）
 */
function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

/**
 * 计算数组的方差
 * @param {Array<number>} values - 数值数组
 * @returns {number} 方差
 */
function calculateVariance(values) {
  if (values.length === 0) {
    return 0;
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return variance;
}

/**
 * 计算数组的变异系数（Coefficient of Variation）
 * CV = 标准差 / 平均值 = √方差 / 平均值
 * 用于消除量纲和均值的影响，使得不同k值之间的均匀度可以进行比较
 * @param {Array<number>} values - 数值数组
 * @returns {number} 变异系数
 */
function calculateCoefficientOfVariation(values) {
  if (values.length === 0) {
    return 0;
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) {
    return 0; // 如果均值为0，返回0
  }
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  
  return cv;
}

/**
 * 计算标签云布局指标
 * @param {Array} layoutResults - 布局结果数组，每个元素包含 {poi, x, y, width, height, fontSize, bearing}
 * @param {Object} center - 中心点 {lat, lng}
 * @param {number} centerX - 中心点Canvas X坐标
 * @param {number} centerY - 中心点Canvas Y坐标
 * @param {number} layoutTime - 布局耗时（毫秒）
 * @returns {Object} 指标对象
 */
export function calculateLayoutMetrics(layoutResults, center, centerX, centerY, layoutTime) {
  if (!layoutResults || layoutResults.length === 0) {
    return {
      labelCount: 0,
      compactnessIndex: 0,
      orientationRetention: {
        mae: 0,
        maxE: 0,
      },
      radialDistanceSimilarityCorrelation: 0,
      layoutUniformity: {
        k360: 0,
        k120: 0,
        k72: 0,
        k36: 0,
        k24: 0,
      },
      executionTime: layoutTime || 0,
    };
  }

  // 1. 标签数量
  const labelCount = layoutResults.length;

  // 2. 空间紧凑度CI：所有标签面积总和 / 最小外接矩形面积
  let totalLabelArea = 0;
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  // 调试：统计标签尺寸信息
  const labelSizes = [];
  
  layoutResults.forEach((result) => {
    const area = result.width * result.height;
    totalLabelArea += area;
    
    // 记录标签尺寸用于调试
    labelSizes.push({
      text: result.text,
      width: result.width,
      height: result.height,
      area: area,
      fontSize: result.fontSize
    });
    
    const left = result.x - result.width / 2;
    const right = result.x + result.width / 2;
    const top = result.y - result.height / 2;
    const bottom = result.y + result.height / 2;
    
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  });
  
  // // 输出前5个标签的尺寸信息用于调试
  // if (labelSizes.length > 0) {
  //   console.log("前5个标签的尺寸信息：", labelSizes.slice(0, 5));
  //   console.log("标签数量：", labelSizes.length);
  //   console.log("平均标签面积：", totalLabelArea / labelSizes.length);
  // }

  // console.log("当前画布的坐标：", minX, minY, maxX, maxY);

  const boundingRectArea = (maxX - minX) * (maxY - minY);
  // console.log("当前画布的面积：", boundingRectArea)
  // console.log("当前标签的总面积：", totalLabelArea)
  
  const compactnessIndex = boundingRectArea > 0 ? totalLabelArea / boundingRectArea : 0;

  // 3. 方向保持度OR：计算真实方向角与摆放方向角的差值
  const angleDifferences = [];
  
  layoutResults.forEach((result) => {
    const poi = result.poi;
    if (!poi || poi.lat === undefined || poi.lng === undefined) {
      return;
    }
    
    // 真实方向角（地理坐标）
    const trueBearing = calculateBearing(center.lat, center.lng, poi.lat, poi.lng);
    
    // 摆放方向角（Canvas坐标）
    const layoutBearing = calculateCanvasBearing(centerX, centerY, result.x, result.y);
    
    // 计算角度差（锐角）
    const angleDiff = calculateAngleDifference(trueBearing, layoutBearing);
    angleDifferences.push(angleDiff);
  });

  const mae = angleDifferences.length > 0
    ? angleDifferences.reduce((a, b) => a + b, 0) / angleDifferences.length
    : 0;
  const maxE = angleDifferences.length > 0
    ? Math.max(...angleDifferences)
    : 0;

  // 4. 径向距离与相似度的相关性RDSC
  const radialDistances = [];
  const similarities = [];
  
  layoutResults.forEach((result) => {
    const poi = result.poi;
    if (!poi || poi.lat === undefined || poi.lng === undefined) {
      return;
    }
    
    // 计算径向距离（Canvas坐标系中的距离）
    const dx = result.x - centerX;
    const dy = result.y - centerY;
    const radialDistance = Math.sqrt(dx * dx + dy * dy);
    
    radialDistances.push(radialDistance);
    
    // 获取相似度（如果POI对象中有similarity属性）
    const similarity = poi.similarity !== undefined ? poi.similarity : 0;
    similarities.push(similarity);
  });

  const radialDistanceSimilarityCorrelation = pearsonCorrelation(radialDistances, similarities);

  // 5. 布局均匀度LU：将360度圆周等分为36个扇形区间，计算各区间内标签数量的变异系数
  // 使用变异系数（CV）而不是方差，可以消除不同k值下均值不同的影响，使得结果可以比较
  const calculateUniformity = () => {
    const k = 36; // 固定为36个扇形区间
    const sectorCounts = new Array(k).fill(0);
    
    layoutResults.forEach((result) => {
      // 使用标签中心点判断落在哪个区间
      const angle = calculateCanvasBearing(centerX, centerY, result.x, result.y);
      const sectorIndex = Math.floor((angle / 360) * k);
      const index = sectorIndex >= k ? k - 1 : sectorIndex; // 防止越界
      sectorCounts[index]++;
    });
    
    // 使用变异系数（CV）而不是方差
    // CV = 标准差 / 平均值，可以消除量纲和均值的影响
    return calculateCoefficientOfVariation(sectorCounts);
  };

  const layoutUniformity = calculateUniformity();

  return {
    labelCount,
    compactnessIndex,
    orientationRetention: {
      mae,
      maxE,
    },
    radialDistanceSimilarityCorrelation,
    layoutUniformity,
    executionTime: layoutTime || 0,
  };
}

