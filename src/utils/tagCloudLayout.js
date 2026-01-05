/**
 * 标签云布局算法
 * 实现多角度径向移位算法（阿基米德螺线 + 方位角约束）
 */

/**
 * 计算两点之间的方位角（以正北为0度，顺时针）
 * @param {number} centerLat - 中心点纬度
 * @param {number} centerLng - 中心点经度
 * @param {number} poiLat - POI纬度
 * @param {number} poiLng - POI经度
 * @returns {number} 方位角（度数，0-360）
 */
export function calculateBearing(centerLat, centerLng, poiLat, poiLng) {
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
 * 检查两个矩形是否重叠
 * @param {Object} rect1 - 矩形1 {x, y, width, height}
 * @param {Object} rect2 - 矩形2 {x, y, width, height}
 * @param {number} padding - 额外的间距
 * @returns {boolean} 是否重叠
 */
export function isOverlapping(rect1, rect2, padding = 2) {
  return !(
    rect1.x + rect1.width + padding < rect2.x ||
    rect2.x + rect2.width + padding < rect1.x ||
    rect1.y + rect1.height + padding < rect2.y ||
    rect2.y + rect2.height + padding < rect1.y
  );
}

/**
 * 阿基米德螺线算法（带方位角约束）
 * 在指定扇形范围内，从中心向外螺旋探测，直到找到合适位置
 * 由于画布空间无限大，在扇形范围内一定能找到位置
 * @param {number} centerX - 中心点X坐标
 * @param {number} centerY - 中心点Y坐标
 * @param {number} bearing - 真实方位角（度数）
 * @param {number} width - 标签宽度
 * @param {number} height - 标签高度
 * @param {Array} placedLabels - 已放置的标签数组
 * @returns {Object} 放置位置 {x, y}（保证能找到）
 */
export function findPositionWithSpiral(
  centerX,
  centerY,
  bearing,
  width,
  height,
  placedLabels
) {
  // 定义扇形范围：方位角 ±15度（总共30度）
  const sectorHalfAngle = 15; // 扇形半角
  const minAngle = bearing - sectorHalfAngle;
  const maxAngle = bearing + sectorHalfAngle;

  // 阿基米德螺线参数
  const startRadius = 5; // 起始半径（从中心稍微偏移，避免与中心标签重叠）
  const radiusIncrement = 8; // 每圈半径增量
  const angleStep = 10; // 角度步进（度）

  let radius = startRadius;
  let angle = minAngle; // 从扇形最小角度开始

  // 在扇形范围内不断向外螺旋探测，直到找到合适位置
  // 由于画布空间无限大，一定能找到位置
  while (true) {
    // 计算当前探测点的坐标
    const angleRad = (angle * Math.PI) / 180;
    const x = centerX + radius * Math.sin(angleRad);
    const y = centerY - radius * Math.cos(angleRad); // Canvas坐标系Y轴向下

    // 创建候选矩形（标签中心对齐）
    const candidateRect = {
      x: x - width / 2,
      y: y - height / 2,
      width: width,
      height: height,
    };

    // 检查是否与已放置的标签重叠
    let hasCollision = false;
    for (const placed of placedLabels) {
      if (isOverlapping(candidateRect, placed, 4)) {
        hasCollision = true;
        break;
      }
    }

    if (!hasCollision) {
      // 找到合适的位置，返回
      return { x, y };
    }

    // 更新角度（在扇形范围内移动）
    angle += angleStep;
    
    // 如果角度超出扇形范围，重置角度并增加半径（向外扩展一圈）
    if (angle > maxAngle) {
      angle = minAngle;
      radius += radiusIncrement;
    }
  }
}

/**
 * 计算文本的边界框尺寸（估算）
 * @param {string} text - 文本内容
 * @param {number} fontSize - 字体大小
 * @param {string} fontFamily - 字体族
 * @param {number} fontWeight - 字体粗细
 * @returns {Object} {width, height}
 */
export function measureText(text, fontSize, fontFamily = 'Arial', fontWeight = 400) {
  // 创建临时canvas用于测量
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  
  // 高度估算（通常为字体大小的1.2倍）
  const height = fontSize * 1.2;
  
  return { width, height };
}

/**
 * 布局标签云
 * @param {Array} pois - POI数组（已按相似度排序）
 * @param {Object} center - 中心点 {lng, lat}
 * @param {number} centerX - 中心点Canvas X坐标
 * @param {number} centerY - 中心点Canvas Y坐标
 * @param {Object} fontSettings - 字体设置
 * @param {Function} getPoiDisplayName - 获取POI显示名称的函数
 * @param {boolean} showRank - 是否显示排名
 * @param {boolean} showTime - 是否显示时间
 * @param {Object} centerLabelRect - 中心标签矩形 {x, y, width, height}，用于避免压盖
 * @returns {Array} 布局结果数组
 */
export function layoutTagCloud(
  pois,
  center,
  centerX,
  centerY,
  fontSettings,
  getPoiDisplayName,
  showRank = false,
  showTime = false,
  centerLabelRect = null
) {
  const placedLabels = [];
  
  // 如果有中心标签矩形，将其添加到已放置标签列表中，避免其他标签压盖
  if (centerLabelRect) {
    placedLabels.push({
      x: centerLabelRect.x,
      y: centerLabelRect.y,
      width: centerLabelRect.width,
      height: centerLabelRect.height,
    });
  }
  
  const layoutResults = [];

  console.log(`开始布局 ${pois.length} 个标签...`);

  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    
    // 计算真实方位角
    const bearing = calculateBearing(center.lat, center.lng, poi.lat, poi.lng);
    
    // 构建标签文本
    const displayName = getPoiDisplayName(poi);
    let labelText = displayName;
    const rankPart = showRank && poi.rank ? String(poi.rank) : '';
    const timePart = showTime && poi.time ? String(poi.time) : '';
    
    if (rankPart && timePart) {
      labelText = `${displayName} ${rankPart}|${timePart}`;
    } else if (rankPart) {
      labelText = `${displayName} ${rankPart}`;
    } else if (timePart) {
      labelText = `${displayName} ${timePart}`;
    }
    
    // 获取字体大小（根据相似度等级）
    const fontSize = poi.fontSize || fontSettings.fontSizes[0];
    
    // 测量文本尺寸
    const { width, height } = measureText(
      labelText,
      fontSize,
      fontSettings.fontFamily,
      fontSettings.fontWeight
    );
    
    // 使用阿基米德螺线算法找到合适的位置
    const position = findPositionWithSpiral(
      centerX,
      centerY,
      bearing,
      width,
      height,
      placedLabels
    );
    
    // 记录已放置的标签
    const placedRect = {
      x: position.x - width / 2,
      y: position.y - height / 2,
      width: width,
      height: height,
    };
    placedLabels.push(placedRect);
    
    // 记录布局结果
    layoutResults.push({
      poi: poi,
      text: labelText,
      x: position.x,
      y: position.y,
      width: width,
      height: height,
      fontSize: fontSize,
      bearing: bearing,
    });
    
    // 显示进度
    if ((i + 1) % 10 === 0 || i === pois.length - 1) {
      console.log(`布局进度: ${i + 1}/${pois.length}`);
    }
  }

  console.log(`布局完成，成功放置 ${layoutResults.length}/${pois.length} 个标签`);
  
  return layoutResults;
}

