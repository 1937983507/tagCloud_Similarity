/**
 * 相似度计算工具
 * 使用本地部署的 Ollama dengcao/Qwen3-Embedding-0.6B:Q8_0 模型
 */

const OLLAMA_API_URL = 'http://localhost:11434/api/embeddings';
const EMBEDDING_MODEL = 'dengcao/Qwen3-Embedding-0.6B:Q8_0';

/**
 * 调用 Ollama API 获取文本嵌入向量
 * @param {string} text - 要嵌入的文本
 * @returns {Promise<number[]>} 嵌入向量
 */
export async function getEmbedding(text) {
  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('获取嵌入向量失败:', error);
    throw error;
  }
}

/**
 * 批量获取文本嵌入向量（带进度回调）
 * @param {string[]} texts - 文本数组
 * @param {Function} onProgress - 进度回调函数 (current, total) => void
 * @returns {Promise<number[][]>} 嵌入向量数组
 */
export async function getBatchEmbeddings(texts, onProgress = null) {
  const embeddings = [];
  
  // 使用 Promise.all 并发请求，提高效率
  const batchSize = 10; // 每批处理10个请求
  const total = texts.length;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(text => getEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);
    
    // 更新进度
    const current = Math.min(i + batchSize, total);
    if (onProgress) {
      onProgress(current, total);
    }
    
    // 显示进度
    // console.log(`嵌入向量计算进度: ${current}/${total}`);
  }
  
  return embeddings;
}

/**
 * 计算两个向量的余弦相似度
 * @param {number[]} vec1 - 向量1
 * @param {number[]} vec2 - 向量2
 * @returns {number} 相似度 (0-1)
 */
export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * 计算中心地点与周边地点的相似度
 * @param {Object} centerPoi - 中心地点
 * @param {Object[]} surroundingPois - 周边地点数组
 * @param {Function} onProgress - 进度回调函数 (current, total) => void
 * @returns {Promise<Object[]>} 带相似度的POI数组
 */
export async function calculateSimilarities(centerPoi, surroundingPois, onProgress = null) {
  try {
    console.log('开始计算相似度...');
    console.log('中心地点:', centerPoi.name);
    console.log('周边地点数量:', surroundingPois.length);

    // 获取中心地点的嵌入向量
    if (onProgress) {
      onProgress(0, surroundingPois.length + 1);
    }
    const centerEmbedding = await getEmbedding(centerPoi.name);
    console.log('中心地点嵌入向量维度:', centerEmbedding.length);
    
    if (onProgress) {
      onProgress(1, surroundingPois.length + 1);
    }

    // 批量获取周边地点的嵌入向量（带进度回调）
    const surroundingTexts = surroundingPois.map(poi => poi.name);
    const surroundingEmbeddings = await getBatchEmbeddings(
      surroundingTexts,
      (current, total) => {
        // 进度 = 1 (中心) + current (周边) / (total + 1)
        if (onProgress) {
          const progress = Math.round(((1 + current) / (total + 1)) * 100);
          onProgress(1 + current, total + 1);
        }
      }
    );

    // 计算相似度
    const poisWithSimilarity = surroundingPois.map((poi, index) => {
      const similarity = cosineSimilarity(centerEmbedding, surroundingEmbeddings[index]);
      return {
        ...poi,
        similarity: similarity,
        similarityScore: Math.round(similarity * 100) / 100, // 保留2位小数
      };
    });

    if (onProgress) {
      onProgress(surroundingPois.length + 1, surroundingPois.length + 1);
    }

    console.log('相似度计算完成');
    console.log('相似度范围:', {
      min: Math.min(...poisWithSimilarity.map(p => p.similarity)),
      max: Math.max(...poisWithSimilarity.map(p => p.similarity)),
      avg: poisWithSimilarity.reduce((sum, p) => sum + p.similarity, 0) / poisWithSimilarity.length,
    });

    return poisWithSimilarity;
  } catch (error) {
    console.error('计算相似度失败:', error);
    throw error;
  }
}

/**
 * 根据相似度分级
 * @param {number} similarity - 相似度值 (0-1)
 * @param {number} levelCount - 分级数量
 * @returns {number} 等级 (0 到 levelCount-1)
 */
export function getSimilarityLevel(similarity, levelCount = 5) {
  // 将相似度映射到等级
  const level = Math.floor(similarity * levelCount);
  return Math.min(level, levelCount - 1);
}
