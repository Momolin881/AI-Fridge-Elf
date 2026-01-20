/**
 * API 客戶端模組
 *
 * 使用 Axios 提供與後端 API 的通信介面。
 * 自動處理認證 token 和錯誤處理。
 */

import axios from 'axios';
import { getLiffAccessToken } from '../liff';

// API 基礎 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// 建立 Axios 實例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// 請求攔截器：自動設置 Content-Type（FormData 除外）
apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      // FormData：刪除預設的 Content-Type，讓瀏覽器自動設置（包含 boundary）
      delete config.headers['Content-Type'];
      // 增加上傳超時時間
      config.timeout = 60000;
      console.log('📤 FormData request:', config.url);
    } else {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 請求攔截器：自動添加 Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = getLiffAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 回應攔截器：統一錯誤處理
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // 伺服器回應錯誤
      console.error('API Error:', error.response.status, error.response.data);

      // 401 未授權 - 重新登入
      if (error.response.status === 401) {
        window.location.href = '/';
      }
    } else if (error.request) {
      // 請求已發送但無回應
      console.error('Network Error:', error.request);
      console.error('Error details:', error.message, error.code);
    } else {
      // 其他錯誤
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ========== API 方法 ==========

// ---------- 使用者相關 ----------

/**
 * 獲取使用者資訊
 * @returns {Promise<Object>} 使用者資訊
 */
export const getUserInfo = () => {
  return apiClient.get('/users/me');
};

/**
 * 更新使用者設定
 * @param {Object} settings - 設定物件
 * @returns {Promise<Object>} 更新後的設定
 */
export const updateUserSettings = (settings) => {
  return apiClient.put('/users/me/settings', settings);
};

// ---------- 食材相關 ----------

/**
 * 獲取所有食材
 * @param {Object} params - 查詢參數 (compartment, is_expired, etc.)
 * @returns {Promise<Array>} 食材清單
 */
export const getFoodItems = (params = {}) => {
  return apiClient.get('/food-items', { params });
};

/**
 * 獲取單一食材詳情
 * @param {number} itemId - 食材 ID
 * @returns {Promise<Object>} 食材詳情
 */
export const getFoodItem = (itemId) => {
  return apiClient.get(`/food-items/${itemId}`);
};

/**
 * 上傳圖片並辨識食材
 * @param {File} imageFile - 圖片檔案
 * @param {number} fridgeId - 冰箱 ID
 * @param {string} storageType - 儲存類型（「冷藏」或「冷凍」）
 * @param {number} compartmentId - 分區 ID（可選）
 * @returns {Promise<Object>} 辨識結果
 */
export const recognizeFoodImage = (imageFile, fridgeId, storageType, compartmentId = null) => {
  // 嚴格驗證 fridgeId 必須是有效數字
  const validFridgeId = Number(fridgeId);
  if (!fridgeId || isNaN(validFridgeId) || validFridgeId <= 0) {
    console.error('❌ Invalid fridge_id in recognizeFoodImage:', { fridgeId, validFridgeId });
    return Promise.reject(new Error('fridge_id 必須是有效的數字'));
  }

  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('fridge_id', validFridgeId);  // 使用驗證過的數字
  formData.append('storage_type', storageType);
  if (compartmentId) {
    formData.append('compartment_id', compartmentId);
  }

  // Debug logging
  console.log('🔍 recognizeFoodImage called with:', {
    imageFile: imageFile ? { name: imageFile.name, size: imageFile.size, type: imageFile.type } : null,
    fridgeId: validFridgeId,
    storageType,
    compartmentId,
  });

  // 不要手動設置 Content-Type，讓瀏覽器自動處理 FormData（會自動加上 boundary）
  return apiClient.post('/food-items/recognize', formData);
};

/**
 * 新增食材
 * @param {Object} foodData - 食材資料
 * @returns {Promise<Object>} 新增的食材
 */
export const createFoodItem = (foodData) => {
  return apiClient.post('/food-items', foodData);
};

/**
 * 更新食材
 * @param {number} itemId - 食材 ID
 * @param {Object} foodData - 更新的資料
 * @returns {Promise<Object>} 更新後的食材
 */
export const updateFoodItem = (itemId, foodData) => {
  return apiClient.put(`/food-items/${itemId}`, foodData);
};

/**
 * 刪除食材
 * @param {number} itemId - 食材 ID
 * @returns {Promise<void>}
 */
export const deleteFoodItem = (itemId) => {
  return apiClient.delete(`/food-items/${itemId}`);
};

/**
 * 封存食材（標記為已處理）
 * @param {number} itemId - 食材 ID
 * @returns {Promise<Object>} 封存後的食材
 */
export const archiveFoodItem = (itemId) => {
  return apiClient.post(`/food-items/${itemId}/archive`);
};

/**
 * 批次刪除食材
 * @param {Array<number>} itemIds - 食材 ID 陣列
 * @returns {Promise<void>}
 */
export const deleteFoodItems = (itemIds) => {
  return apiClient.post('/food-items/batch-delete', { item_ids: itemIds });
};

// ---------- 冰箱相關 ----------

/**
 * 獲取使用者的所有冰箱
 * @returns {Promise<Array>} 冰箱清單
 */
export const getFridges = () => {
  return apiClient.get('/fridges');
};

/**
 * 獲取單一冰箱詳情（含分區）
 * @param {number} fridgeId - 冰箱 ID
 * @returns {Promise<Object>} 冰箱詳情
 */
export const getFridge = (fridgeId) => {
  return apiClient.get(`/fridges/${fridgeId}`);
};

/**
 * 新增冰箱
 * @param {Object} fridgeData - 冰箱資料
 * @returns {Promise<Object>} 新增的冰箱
 */
export const createFridge = (fridgeData) => {
  return apiClient.post('/fridges', fridgeData);
};

/**
 * 更新冰箱
 * @param {number} fridgeId - 冰箱 ID
 * @param {Object} fridgeData - 更新的資料
 * @returns {Promise<Object>} 更新後的冰箱
 */
export const updateFridge = (fridgeId, fridgeData) => {
  return apiClient.put(`/fridges/${fridgeId}`, fridgeData);
};

/**
 * 新增冰箱分區
 * @param {number} fridgeId - 冰箱 ID
 * @param {Object} compartmentData - 分區資料
 * @returns {Promise<Object>} 新增的分區
 */
export const createCompartment = (fridgeId, compartmentData) => {
  return apiClient.post(`/fridges/${fridgeId}/compartments`, compartmentData);
};

// ---------- 通知相關 ----------

/**
 * 獲取通知設定
 * @returns {Promise<Object>} 通知設定
 */
export const getNotificationSettings = () => {
  return apiClient.get('/notifications/settings');
};

/**
 * 更新通知設定
 * @param {Object} settings - 通知設定
 * @returns {Promise<Object>} 更新後的設定
 */
export const updateNotificationSettings = (settings) => {
  return apiClient.put('/notifications/settings', settings);
};

/**
 * 測試效期提醒通知（手動觸發）
 * @returns {Promise<Object>} 執行結果
 */
export const testExpiryNotification = () => {
  return apiClient.post('/notifications/test-expiry-check');
};

// ---------- 食譜相關 ----------

/**
 * 根據現有食材推薦食譜
 * @param {Array<number>} itemIds - 食材 ID 陣列（可選）
 * @returns {Promise<Array>} 推薦食譜清單
 */
export const getRecipeRecommendations = (itemIds = []) => {
  return apiClient.post('/recipes/recommendations', { item_ids: itemIds });
};

/**
 * 獲取使用者食譜
 * @param {string} category - 類別 (favorites, pro)
 * @returns {Promise<Array>} 食譜清單
 */
export const getUserRecipes = (category = null) => {
  return apiClient.get('/recipes', { params: { category } });
};

/**
 * 新增使用者食譜
 * @param {Object} recipeData - 食譜資料
 * @param {string} category - 分類 (favorites, pro, 常煮)
 * @returns {Promise<Object>} 新增的食譜
 */
export const createUserRecipe = (recipeData, category = 'favorites') => {
  return apiClient.post('/recipes', recipeData, { params: { category } });
};

/**
 * 刪除使用者食譜
 * @param {number} userRecipeId - 使用者食譜 ID
 * @returns {Promise<void>}
 */
export const deleteUserRecipe = (userRecipeId) => {
  return apiClient.delete(`/recipes/${userRecipeId}`);
};

// ---------- 預算相關 ----------

/**
 * 獲取消費統計
 * @param {string} period - 期間 (month, year)
 * @returns {Promise<Object>} 消費統計
 */
export const getSpendingStats = (period = 'month') => {
  return apiClient.get('/budget/stats', { params: { period } });
};

/**
 * 獲取預算設定
 * @returns {Promise<Object>} 預算設定
 */
export const getBudgetSettings = () => {
  return apiClient.get('/budget/settings');
};

/**
 * 更新預算設定
 * @param {Object} settings - 預算設定
 * @returns {Promise<Object>} 更新後的設定
 */
export const updateBudgetSettings = (settings) => {
  return apiClient.put('/budget/settings', settings);
};

/**
 * 獲取採買建議
 * @returns {Promise<Array>} 建議採買清單
 */
export const getShoppingSuggestions = () => {
  return apiClient.get('/budget/shopping-suggestions');
};

// ---------- 冰箱成員相關 ----------

/**
 * 獲取冰箱成員清單
 * @param {number} fridgeId - 冰箱 ID
 * @returns {Promise<Array>} 成員清單
 */
export const getFridgeMembers = (fridgeId) => {
  return apiClient.get(`/fridges/${fridgeId}/members`);
};

/**
 * 產生冰箱邀請碼
 * @param {number} fridgeId - 冰箱 ID
 * @param {Object} options - 邀請選項 { default_role, expires_days }
 * @returns {Promise<Object>} 邀請碼資料
 */
export const createFridgeInvite = (fridgeId, options = {}) => {
  return apiClient.post(`/fridges/${fridgeId}/invites`, options);
};

/**
 * 透過邀請碼加入冰箱
 * @param {string} inviteCode - 邀請碼
 * @returns {Promise<Object>} 加入結果
 */
export const joinFridgeByCode = (inviteCode) => {
  return apiClient.post(`/fridges/join/${inviteCode}`);
};

/**
 * 更新成員權限
 * @param {number} fridgeId - 冰箱 ID
 * @param {number} memberId - 成員 ID
 * @param {Object} data - { role: 'editor' | 'viewer' }
 * @returns {Promise<Object>} 更新後的成員資料
 */
export const updateMemberRole = (fridgeId, memberId, data) => {
  return apiClient.put(`/fridges/${fridgeId}/members/${memberId}`, data);
};

/**
 * 移除冰箱成員
 * @param {number} fridgeId - 冰箱 ID
 * @param {number} memberId - 成員 ID
 * @returns {Promise<void>}
 */
export const removeMember = (fridgeId, memberId) => {
  return apiClient.delete(`/fridges/${fridgeId}/members/${memberId}`);
};

// ---------- 冰箱匯出匯入 ----------

/**
 * 匯出冰箱資料
 * @param {number} fridgeId - 冰箱 ID
 * @returns {Promise<Object>} 匯出的 JSON 資料
 */
export const exportFridge = (fridgeId) => {
  return apiClient.get(`/fridges/${fridgeId}/export`);
};

/**
 * 匯入冰箱資料
 * @param {number} fridgeId - 冰箱 ID
 * @param {Object} data - 匯入的 JSON 資料
 * @param {boolean} clearExisting - 是否清除現有食材
 * @returns {Promise<Object>} 匯入結果
 */
export const importFridge = (fridgeId, data, clearExisting = false) => {
  return apiClient.post(`/fridges/${fridgeId}/import?clear_existing=${clearExisting}`, data);
};

export default apiClient;
