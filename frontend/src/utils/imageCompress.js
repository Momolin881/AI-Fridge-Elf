/**
 * 圖片壓縮工具
 * 
 * 專門針對手機拍照優化，提升AI辨識成功率
 */

/**
 * 壓縮圖片檔案
 * @param {File} file - 原始圖片檔案
 * @param {Object} options - 壓縮選項
 * @returns {Promise<File>} 壓縮後的檔案
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.8,
    outputFormat = 'image/jpeg',
    maxSizeMB = 2
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 計算壓縮後尺寸
      let { width, height } = img;
      
      // 保持寬高比例縮放
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // 繪製縮放後的圖片
      ctx.drawImage(img, 0, 0, width, height);

      // 轉換為 Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('圖片壓縮失敗'));
            return;
          }

          // 檢查壓縮後大小
          const sizeMB = blob.size / 1024 / 1024;
          if (sizeMB > maxSizeMB) {
            // 如果還是太大，降低品質重試
            const newQuality = Math.max(0.3, quality * 0.7);
            if (newQuality < quality) {
              compressImage(file, { ...options, quality: newQuality })
                .then(resolve)
                .catch(reject);
              return;
            }
          }

          // 創建新的 File 物件
          const compressedFile = new File(
            [blob], 
            file.name.replace(/\.[^/.]+$/, '.jpg'), // 統一為 jpg 格式
            { 
              type: outputFormat,
              lastModified: Date.now()
            }
          );

          console.log(`🔧 圖片壓縮完成:`, {
            原始大小: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            壓縮後: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
            原始尺寸: `${img.width}x${img.height}`,
            壓縮後: `${width}x${height}`,
            品質: quality
          });

          resolve(compressedFile);
        },
        outputFormat,
        quality
      );
    };

    img.onerror = () => reject(new Error('圖片載入失敗'));

    // 讀取圖片
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsDataURL(file);
  });
};

/**
 * 智能壓縮 - 根據檔案大小和來源自動選擇壓縮策略
 * @param {File} file - 圖片檔案
 * @param {boolean} isFromCamera - 是否來自相機拍攝
 * @returns {Promise<File>} 處理後的檔案
 */
export const smartCompress = async (file, isFromCamera = false) => {
  const sizeMB = file.size / 1024 / 1024;

  // 小於 0.5MB 且不是相機拍攝，直接使用
  if (sizeMB < 0.5 && !isFromCamera) {
    console.log('📸 檔案較小，跳過壓縮:', `${sizeMB.toFixed(2)}MB`);
    return file;
  }

  // 根據檔案大小選擇壓縮策略
  let options = {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8,
    maxSizeMB: 2
  };

  if (isFromCamera || sizeMB > 5) {
    // 相機拍攝或大檔案：更激進的壓縮
    options = {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
      maxSizeMB: 1.5
    };
  } else if (sizeMB > 2) {
    // 中等檔案：適中壓縮
    options = {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.75,
      maxSizeMB: 2
    };
  }

  try {
    return await compressImage(file, options);
  } catch (error) {
    console.warn('⚠️ 圖片壓縮失敗，使用原檔案:', error);
    return file;
  }
};

/**
 * 檢測是否為相機拍攝的照片
 * @param {File} file - 圖片檔案
 * @returns {boolean} 是否為相機拍攝
 */
export const isFromCamera = (file) => {
  // 檔案名稱特徵（iOS/Android 相機命名規則）
  const cameraNamePatterns = [
    /^IMG_\d+\.(jpg|jpeg|heic)$/i,  // iOS
    /^DCIM_\d+\.(jpg|jpeg)$/i,      // Android
    /^Camera_\d+\.(jpg|jpeg)$/i,    // 通用
    /^\d{8}_\d{6}\.(jpg|jpeg)$/i,   // 時間戳格式
  ];

  const hasLargeDimensions = file.size > 3 * 1024 * 1024; // 大於3MB可能是相機拍攝

  return cameraNamePatterns.some(pattern => pattern.test(file.name)) || hasLargeDimensions;
};