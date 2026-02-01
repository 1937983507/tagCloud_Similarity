/**
 * 批量测试工具函数
 * 用于生成测试用例和执行批量测试
 */

// 城市坐标数据缓存
let cityCoordinatesCache = null;

/**
 * 加载城市坐标数据
 * @returns {Promise<Array>} 城市数组，每个元素包含 {name, lng, lat}
 */
async function loadCityCoordinates() {
  // 如果已缓存，直接返回
  if (cityCoordinatesCache) {
    return cityCoordinatesCache;
  }
  
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/cityCoordinates.json`);
    if (!response.ok) {
      throw new Error(`加载城市坐标数据失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.cities || !Array.isArray(data.cities)) {
      throw new Error('城市坐标数据格式错误');
    }
    
    // 缓存数据
    cityCoordinatesCache = data.cities;
    return cityCoordinatesCache;
  } catch (error) {
    console.error('加载城市坐标数据失败:', error);
    throw error;
  }
}

/**
 * 生成随机测试用例（从城市坐标中随机选择并施加偏移）
 * @param {number} count - 测试用例数量
 * @returns {Promise<Array>} 测试用例数组，每个元素包含 {centerLng, centerLat, radius}
 */
export async function generateRandomTestCases(count) {
  // 加载城市坐标数据
  const cities = await loadCityCoordinates();
  
  if (cities.length === 0) {
    throw new Error('城市坐标数据为空');
  }
  
  const testCases = [];
  
  // 随机选择 n 个城市（允许重复，因为城市数量可能少于测试用例数量）
  for (let i = 0; i < count; i++) {
    // 随机选择一个城市
    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    const baseLng = randomCity.lng;
    const baseLat = randomCity.lat;
    
    // 生成随机半径（1-200km）
    const radius = 1 + Math.random() * 99;
    
    // 计算坐标偏移范围（根据半径动态调整）
    // 偏移范围约为半径的 10-30%，但最小为 ±0.1度，最大为 ±1度
    const offsetRatio = 0.1 + Math.random() * 0.2; // 10-30%
    const offsetKm = radius * offsetRatio;
    
    // 将公里转换为度数（粗略估算：1度纬度 ≈ 111km，1度经度 ≈ 111km * cos(纬度)）
    const latOffset = offsetKm / 111; // 纬度偏移（度）
    const lngOffset = offsetKm / (111 * Math.cos(baseLat * Math.PI / 180)); // 经度偏移（度）
    
    // 限制偏移范围：最小 ±0.1度，最大 ±1度
    const minOffset = 0.1;
    const maxOffset = 1.0;
    const finalLatOffset = Math.max(minOffset, Math.min(maxOffset, latOffset));
    const finalLngOffset = Math.max(minOffset, Math.min(maxOffset, lngOffset));
    
    // 生成随机偏移（±范围内）
    const latOffsetValue = (Math.random() * 2 - 1) * finalLatOffset; // -finalLatOffset 到 +finalLatOffset
    const lngOffsetValue = (Math.random() * 2 - 1) * finalLngOffset; // -finalLngOffset 到 +finalLngOffset
    
    // 计算最终坐标
    const centerLng = baseLng + lngOffsetValue;
    const centerLat = baseLat + latOffsetValue;
    
    testCases.push({
      centerLng,
      centerLat,
      radius,
      cityName: randomCity.name, // 可选：保存原始城市名用于调试
    });
  }
  
  return testCases;
}

/**
 * 计算两点之间的距离（米）
 * @param {number} lat1 - 纬度1
 * @param {number} lng1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lng2 - 经度2
 * @returns {number} 距离（米）
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 筛选指定范围内的POI数据
 * @param {Array} poiList - POI列表
 * @param {number} centerLng - 中心经度
 * @param {number} centerLat - 中心纬度
 * @param {number} radiusKm - 半径（公里）
 * @returns {Array} 筛选后的POI列表
 */
export function filterPoisInRange(poiList, centerLng, centerLat, radiusKm) {
  const radiusM = radiusKm * 1000; // 转换为米
  
  return poiList.filter(poi => {
    if (!poi.lng || !poi.lat) {
      return false;
    }
    
    const distance = calculateDistance(centerLat, centerLng, poi.lat, poi.lng);
    return distance <= radiusM;
  });
}

/**
 * 找到与中心坐标最接近的POI作为中心地点
 * @param {Array} poiList - POI列表
 * @param {number} centerLng - 中心经度
 * @param {number} centerLat - 中心纬度
 * @returns {Object|null} 最接近的POI，如果没有则返回null
 */
export function findNearestPoi(poiList, centerLng, centerLat) {
  if (!poiList || poiList.length === 0) {
    return null;
  }
  
  let nearestPoi = null;
  let minDistance = Infinity;
  
  for (const poi of poiList) {
    if (!poi.lng || !poi.lat) {
      continue;
    }
    
    const distance = calculateDistance(centerLat, centerLng, poi.lat, poi.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoi = poi;
    }
  }
  
  return nearestPoi;
}

