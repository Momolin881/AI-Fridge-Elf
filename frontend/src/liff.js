/**
 * LIFF SDK 初始化模組
 *
 * 提供 LIFF SDK 的初始化和常用方法封裝。
 * 處理 LINE Login 和使用者資訊獲取。
 */

import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

/**
 * 初始化 LIFF SDK
 * @returns {Promise<boolean>} 初始化成功返回 true，失敗返回 false
 */
export const initializeLiff = async () => {
  // 開發模式：跳過 LIFF 初始化
  if (DEV_MODE) {
    console.log('Development mode: Skipping LIFF initialization');
    return true;
  }

  try {
    await liff.init({ liffId: LIFF_ID });

    // 檢查登入狀態
    if (!liff.isLoggedIn()) {
      liff.login();
      return false;
    }

    return true;
  } catch (error) {
    console.error('LIFF initialization failed:', error);
    throw error;
  }
};

/**
 * 獲取 LIFF Access Token
 * @returns {string|null} Access Token 或 null
 */
export const getLiffAccessToken = () => {
  // 開發模式：返回測試 token
  if (DEV_MODE) {
    return 'dev-test-token';
  }
  if (liff.isLoggedIn()) {
    return liff.getAccessToken();
  }
  return null;
};

/**
 * 獲取使用者資訊
 * @returns {Promise<Object>} 使用者資訊物件
 */
export const getUserProfile = async () => {
  try {
    const profile = await liff.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      statusMessage: profile.statusMessage,
    };
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
};

/**
 * 登出
 */
export const logout = () => {
  liff.logout();
  window.location.reload();
};

/**
 * 關閉 LIFF 視窗
 */
export const closeLiff = () => {
  liff.closeWindow();
};

/**
 * 檢查是否在 LINE 應用內
 * @returns {boolean}
 */
export const isInClient = () => {
  return liff.isInClient();
};

/**
 * 傳送訊息給使用者（僅限 LINE 內部）
 * @param {string} message - 要傳送的訊息
 */
export const sendMessage = (message) => {
  if (liff.isInClient()) {
    liff.sendMessages([
      {
        type: 'text',
        text: message,
      }
    ]);
  }
};

export default liff;
