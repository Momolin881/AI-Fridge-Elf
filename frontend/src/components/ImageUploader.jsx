/**
 * ImageUploader 元件
 *
 * 圖片上傳元件，支援拍照和從相簿選擇。
 * 整合 AI 圖片辨識功能，自動識別食材資訊。
 */

import { useState } from 'react';
import { Upload, Button, message, Image, Spin, Alert } from 'antd';
import { CameraOutlined, PictureOutlined, DeleteOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { recognizeFoodImage } from '@services/api';

const ImageUploader = ({
  onImageRecognized,
  onImageSelected,
  onUpload, // 新增：支援外部自訂上傳處理
  maxSize = 10, // MB
  autoRecognize = true,
  loading = false, // 新增：外部載入狀態
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);

  // 圖片上傳前檢查
  const beforeUpload = (file) => {
    // 檢查檔案類型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上傳圖片檔案！');
      return Upload.LIST_IGNORE;
    }

    // 檢查檔案大小
    const isSizeValid = file.size / 1024 / 1024 < maxSize;
    if (!isSizeValid) {
      message.error(`圖片大小不能超過 ${maxSize}MB！`);
      return Upload.LIST_IGNORE;
    }

    return false; // 阻止自動上傳，手動處理
  };

  // 處理圖片選擇
  const handleImageChange = async (info) => {
    const file = info.file;

    // 建立預覽 URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target.result);
    };
    reader.readAsDataURL(file);

    setImageFile(file);
    onImageSelected?.(file);

    // 如果有提供 onUpload（外部自訂處理），優先使用
    if (onUpload) {
      await onUpload(file);
      return;
    }

    // 否則，如果啟用自動辨識，立即辨識
    if (autoRecognize) {
      await recognizeImage(file);
    }
  };

  // 辨識圖片
  const recognizeImage = async (file = imageFile) => {
    if (!file) {
      message.warning('請先選擇圖片');
      return;
    }

    setRecognizing(true);
    setRecognitionResult(null);

    try {
      const result = await recognizeFoodImage(file);
      setRecognitionResult(result);
      onImageRecognized?.(result);
      message.success('圖片辨識成功！');
    } catch (error) {
      console.error('Image recognition failed:', error);
      message.error('圖片辨識失敗，請重試');
    } finally {
      setRecognizing(false);
    }
  };

  // 清除圖片
  const handleClear = () => {
    setImageUrl(null);
    setImageFile(null);
    setRecognitionResult(null);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 上傳區域 */}
      {!imageUrl && (
        <Upload
          beforeUpload={beforeUpload}
          onChange={handleImageChange}
          showUploadList={false}
          accept="image/*"
        >
          <div
            style={{
              border: '2px dashed #d9d9d9',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#fafafa',
            }}
          >
            <p style={{ fontSize: '28px', margin: 0 }}>📸</p>
            <p style={{ marginTop: '6px', color: '#666', fontSize: '14px' }}>
              點擊選擇圖片或拍照
            </p>
            <div style={{ marginTop: '8px' }}>
              <Button icon={<CameraOutlined />} size="small" style={{ marginRight: '8px' }}>
                拍照
              </Button>
              <Button icon={<PictureOutlined />} size="small">
                選擇照片
              </Button>
            </div>
            <p style={{ marginTop: '6px', fontSize: '11px', color: '#999' }}>
              支援 JPG、PNG 格式，大小不超過 {maxSize}MB
            </p>
          </div>
        </Upload>
      )}

      {/* 圖片預覽 */}
      {imageUrl && (
        <div style={{ textAlign: 'center' }}>
          <Image
            src={imageUrl}
            alt="preview"
            style={{
              maxWidth: '100%',
              maxHeight: '400px',
              borderRadius: '8px',
            }}
          />

          <div style={{ marginTop: '15px' }}>
            {!autoRecognize && !recognizing && !recognitionResult && (
              <Button
                type="primary"
                onClick={() => recognizeImage()}
                style={{ marginRight: '10px' }}
              >
                辨識食材
              </Button>
            )}
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleClear}
            >
              清除
            </Button>
          </div>
        </div>
      )}

      {/* 辨識中（使用外部 loading 狀態或內部 recognizing 狀態） */}
      {(loading || recognizing) && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '10px', color: '#666' }}>
            AI 正在辨識圖片中的食材...
          </p>
        </div>
      )}

      {/* 辨識結果 */}
      {recognitionResult && !recognizing && (
        <Alert
          message="辨識成功"
          description={
            <div>
              <p><strong>食材名稱:</strong> {recognitionResult.name || '未識別'}</p>
              {recognitionResult.quantity && (
                <p><strong>數量:</strong> {recognitionResult.quantity}</p>
              )}
              {recognitionResult.expiry_date && (
                <p><strong>效期:</strong> {recognitionResult.expiry_date}</p>
              )}
            </div>
          }
          type="success"
          showIcon
          style={{ marginTop: '15px' }}
        />
      )}
    </div>
  );
};

ImageUploader.propTypes = {
  onImageRecognized: PropTypes.func,
  onImageSelected: PropTypes.func,
  onUpload: PropTypes.func, // 外部自訂上傳處理（會覆蓋 autoRecognize）
  maxSize: PropTypes.number,
  autoRecognize: PropTypes.bool,
  loading: PropTypes.bool, // 外部載入狀態
};

export default ImageUploader;
