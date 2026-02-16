/**
 * 新增食材頁面
 *
 * 支援兩種方式：
 * 1. AI 圖片辨識（自動填入資訊）
 * 2. 手動輸入
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Radio,
  Button,
  message,
  Typography,
  Space,
  Divider,
  Spin,
  Upload,
  Image,
} from 'antd';
import { CameraOutlined, FormOutlined, CalendarOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFridges, getFridge, recognizeFoodImage, createFoodItem, uploadFoodImage } from '../services/api';
import { ImageUploader, CompartmentSelector, ExpenseCalendarModal } from '../components';

const { Content } = Layout;
const { Title } = Typography;

function AddFoodItem() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fridgeLoading, setFridgeLoading] = useState(true);
  const [fridges, setFridges] = useState([]);
  const [mode, setMode] = useState('ai'); // ai or manual
  const [aiRecognizing, setAiRecognizing] = useState(false);
  const [selectedFridge, setSelectedFridge] = useState(null);
  const [selectedFridgeDetail, setSelectedFridgeDetail] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [manualImageUploading, setManualImageUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  // 圖片壓縮函數（針對手機端優化）
  const compressImage = (file, maxWidth = 800, quality = 0.8) => {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // 確保 Image 建構子存在
        if (typeof window.Image !== 'function') {
          throw new Error('Image constructor not available');
        }
        const img = new window.Image();
        
        img.onload = () => {
          try {
            // 計算壓縮後尺寸
            let { width, height } = img;
            if (width > height) {
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
            } else {
              if (height > maxWidth) {
                width = (width * maxWidth) / height;
                height = maxWidth;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 繪製並壓縮
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // 確保 blob 有正確的檔名和類型
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  resolve(file); // 壓縮失敗，回傳原檔案
                }
              },
              'image/jpeg',
              quality
            );
          } catch (error) {
            console.error('圖片壓縮過程錯誤:', error);
            resolve(file); // 錯誤時回傳原檔案
          }
        };
        
        img.onerror = () => {
          console.error('圖片載入失敗');
          resolve(file); // 載入失敗，回傳原檔案
        };
        
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('圖片壓縮初始化錯誤:', error);
        resolve(file); // 初始化失敗，回傳原檔案
      }
    });
  };

  useEffect(() => {
    loadFridges();
  }, []);

  // 當選擇冰箱時，載入冰箱詳細資料（含分區）
  useEffect(() => {
    if (selectedFridge) {
      loadFridgeDetail(selectedFridge);
    }
  }, [selectedFridge]);

  const loadFridges = async () => {
    try {
      setFridgeLoading(true);
      const data = await getFridges();
      setFridges(data);

      // 如果只有一個冰箱，自動選擇
      if (data.length === 1) {
        setSelectedFridge(data[0].id);
        form.setFieldValue('fridge_id', data[0].id);
      }
    } catch (error) {
      console.error('載入冰箱失敗:', error);
      message.error('載入冰箱失敗，請稍後再試');
    } finally {
      setFridgeLoading(false);
    }
  };

  const loadFridgeDetail = async (fridgeId) => {
    try {
      const detail = await getFridge(fridgeId);
      setSelectedFridgeDetail(detail);
    } catch (error) {
      console.error('載入冰箱詳細資料失敗:', error);
    }
  };

  const handleImageUpload = async (file) => {
    const fridgeId = form.getFieldValue('fridge_id') || selectedFridge;
    const storageType = form.getFieldValue('storage_type');
    const compartmentId = form.getFieldValue('compartment_id');

    // Debug logging
    console.log('🔍 handleImageUpload called:', {
      fridgeId,
      selectedFridge,
      storageType,
      compartmentId,
      compartmentMode: selectedFridgeDetail?.compartment_mode,
    });

    // 注意：儲存類型和分區都移到儲存時檢查，允許先拍照辨識
    // 簡單模式和細分模式都使用「冷藏」作為 AI 辨識時的預設值

    // 嚴格驗證 fridgeId（確保是有效數字）
    const validFridgeId = Number(fridgeId);

    // AI 辨識時使用預設 storage_type（稍後儲存時可以更改）
    const effectiveStorageType = storageType || '冷藏';

    if (!fridgeId || isNaN(validFridgeId) || validFridgeId <= 0) {
      message.warning('請先選擇冰箱');
      console.error('❌ Invalid fridge_id:', { fridgeId, selectedFridge, formValue: form.getFieldValue('fridge_id') });
      return;
    }

    try {
      setAiRecognizing(true);
      message.loading({ content: 'AI 辨識中...', key: 'ai-recognition' });

      // 手機端圖片壓縮（檢查檔案大小）
      let uploadFile = file;
      if (file.size > 1024 * 1024) { // 大於 1MB 就壓縮
        message.loading({ content: '正在壓縮圖片...', key: 'ai-recognition' });
        uploadFile = await compressImage(file);
        console.log(`圖片壓縮: ${file.size} → ${uploadFile.size} bytes`);
      }

      message.loading({ content: 'AI 辨識中...', key: 'ai-recognition' });

      // 呼叫 AI 辨識 API（使用壓縮後的檔案）
      const result = await recognizeFoodImage(uploadFile, validFridgeId, effectiveStorageType);

      message.success({ content: `辨識成功: ${result.name}`, key: 'ai-recognition' });

      // 自動填入表單
      form.setFieldsValue({
        name: result.name,
        category: result.category,
        quantity: result.quantity,
        unit: result.unit,
        expiry_date: result.expiry_date ? dayjs(result.expiry_date) : null,
        purchase_date: dayjs(),
        image_url: result.image_url,
        cloudinary_public_id: result.cloudinary_public_id,
        recognized_by_ai: 1,
      });

      // 設定預覽圖
      setPreviewImageUrl(result.image_url);
    } catch (error) {
      console.error('AI 辨識失敗:', error);
      
      // 手機調試：顯示詳細錯誤資訊
      let errorMessage = 'AI 辨識失敗，請手動輸入';
      if (error.response) {
        errorMessage += ` (HTTP ${error.response.status})`;
      } else if (error.request) {
        errorMessage += ' (網絡錯誤)';
      } else {
        errorMessage += ` (${error.message})`;
      }
      
      message.error({ content: errorMessage, key: 'ai-recognition', duration: 5 });
    } finally {
      setAiRecognizing(false);
    }
  };

  // 手動模式下的圖片上傳（不含 AI 辨識）
  const handleManualImageUpload = async (file) => {
    const fridgeId = form.getFieldValue('fridge_id') || selectedFridge;
    const validFridgeId = Number(fridgeId);

    if (!fridgeId || isNaN(validFridgeId) || validFridgeId <= 0) {
      message.warning('請先選擇冰箱');
      return false;
    }

    try {
      setManualImageUploading(true);
      message.loading({ content: '正在上傳圖片...', key: 'manual-upload' });

      // 手機端圖片壓縮
      let uploadFile = file;
      if (file.size > 1024 * 1024) { // 大於 1MB 就壓縮
        message.loading({ content: '正在壓縮圖片...', key: 'manual-upload' });
        uploadFile = await compressImage(file);
      }

      message.loading({ content: '正在上傳圖片...', key: 'manual-upload' });

      // 上傳圖片（不含 AI 辨識）
      const result = await uploadFoodImage(uploadFile, validFridgeId);

      // 設定表單欄位
      form.setFieldsValue({
        image_url: result.image_url,
        cloudinary_public_id: result.cloudinary_public_id,
      });

      // 顯示預覽圖
      setPreviewImageUrl(result.image_url);

      message.success({ content: '圖片上傳成功！', key: 'manual-upload' });
    } catch (error) {
      console.error('圖片上傳失敗:', error);
      message.error({ content: '圖片上傳失敗，請稍後再試', key: 'manual-upload' });
    } finally {
      setManualImageUploading(false);
    }

    return false; // 阻止 antd Upload 預設行為
  };

  // 清除手動上傳的圖片
  const handleClearManualImage = () => {
    form.setFieldsValue({
      image_url: null,
      cloudinary_public_id: null,
    });
    setPreviewImageUrl(null);
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      // 轉換日期格式
      const foodData = {
        ...values,
        expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : null,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        recognized_by_ai: values.recognized_by_ai || 0,
      };

      // 修復：確保 compartment_id 是數字類型
      if (foodData.compartment_id) {
        foodData.compartment_id = Number(foodData.compartment_id);
        if (isNaN(foodData.compartment_id)) {
          delete foodData.compartment_id;
        } else {
          // 細分模式：根據分區自動設定 storage_type
          const selectedCompartment = selectedFridgeDetail?.compartments?.find(c => c.id === foodData.compartment_id);
          if (selectedCompartment?.parent_type) {
            foodData.storage_type = selectedCompartment.parent_type;
          }
        }
      }

      await createFoodItem(foodData);
      message.success('新增食材成功！');
      navigate('/');
    } catch (error) {
      console.error('新增食材失敗:', error);
      message.error('新增食材失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (fridgeLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="載入中..." />
      </div>
    );
  }

  if (fridges.length === 0) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Content style={{ padding: '24px' }}>
          <Card>
            <Title level={4}>尚未設定冰箱</Title>
            <p>請先完成冰箱設定才能新增食材。</p>
            <Button type="primary" onClick={() => navigate('/setup')}>
              前往設定
            </Button>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          新增食材
        </Title>

        <Card>
          {/* 新增模式選擇 */}
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ marginBottom: 24, width: '100%' }}
            size="large"
            buttonStyle="solid"
          >
            <Radio.Button value="ai" style={{ width: '50%', textAlign: 'center' }}>
              <CameraOutlined /> AI 拍照辨識
            </Radio.Button>
            <Radio.Button value="manual" style={{ width: '50%', textAlign: 'center' }}>
              <FormOutlined /> 手動輸入
            </Radio.Button>
          </Radio.Group>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              quantity: 1,
              storage_type: '冷藏',
              purchase_date: dayjs(),
            }}
          >
            {/* 冰箱選擇（如果有多個冰箱） */}
            {fridges.length > 1 ? (
              <Form.Item
                label="選擇冰箱"
                name="fridge_id"
                rules={[{ required: true, message: '請選擇冰箱' }]}
              >
                <Radio.Group onChange={(e) => setSelectedFridge(e.target.value)}>
                  {fridges.map((fridge) => (
                    <Radio key={fridge.id} value={fridge.id}>
                      {fridge.model_name || `冰箱 ${fridge.id}`}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
            ) : (
              // 只有一個冰箱時，使用隱藏欄位
              <Form.Item name="fridge_id" hidden>
                <Input />
              </Form.Item>
            )}

            {/* 分區選擇（僅細分模式顯示） - 放在儲存類型之前 */}
            {selectedFridgeDetail?.compartment_mode === 'detailed' && (
              <Form.Item label="分區" name="compartment_id" rules={[{ required: true, message: '請選擇分區' }]}>
                <CompartmentSelector
                  mode="detailed"
                  customCompartments={
                    selectedFridgeDetail?.compartments?.map((c) => ({
                      value: c.id,
                      label: c.name,
                      parent: c.parent_type,
                    })) || []
                  }
                  onChange={(value) => {
                    // 選擇分區時，自動設定儲存類型
                    const compartment = selectedFridgeDetail?.compartments?.find((c) => c.id === value);
                    if (compartment?.parent_type) {
                      form.setFieldValue('storage_type', compartment.parent_type);
                    }
                  }}
                />
              </Form.Item>
            )}

            {/* 儲存類型 - 細分模式下隱藏（由分區自動決定） */}
            {selectedFridgeDetail?.compartment_mode !== 'detailed' && (
              <Form.Item
                label="儲存類型"
                name="storage_type"
                rules={[{ required: true, message: '請選擇儲存類型' }]}
              >
                <Radio.Group>
                  <Radio value="冷藏">冷藏</Radio>
                  <Radio value="冷凍">冷凍</Radio>
                </Radio.Group>
              </Form.Item>
            )}
            {/* 細分模式下的隱藏 storage_type 欄位 */}
            {selectedFridgeDetail?.compartment_mode === 'detailed' && (
              <Form.Item name="storage_type" hidden>
                <Input />
              </Form.Item>
            )}

            {/* AI 模式：圖片上傳 */}
            {mode === 'ai' && (
              <>
                <Form.Item label="拍照上傳" required>
                  <ImageUploader onUpload={handleImageUpload} loading={aiRecognizing} />
                </Form.Item>
                <Divider>AI 辨識結果（可編輯）</Divider>
              </>
            )}

            {/* 手動模式：可選圖片上傳 */}
            {mode === 'manual' && (
              <Form.Item label="食材圖片（選填）">
                {previewImageUrl ? (
                  <div style={{ textAlign: 'center' }}>
                    <Image
                      src={previewImageUrl}
                      alt="preview"
                      style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                    />
                    <div style={{ marginTop: 12 }}>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleClearManualImage}
                      >
                        移除圖片
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Upload
                    beforeUpload={handleManualImageUpload}
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
                      {manualImageUploading ? (
                        <Spin tip="上傳中..." />
                      ) : (
                        <>
                          <p style={{ fontSize: '28px', margin: 0 }}>📷</p>
                          <p style={{ marginTop: '6px', color: '#666', fontSize: '14px' }}>
                            點擊上傳食材圖片（選填）
                          </p>
                          <p style={{ fontSize: '11px', color: '#999' }}>
                            支援 JPG、PNG 格式
                          </p>
                        </>
                      )}
                    </div>
                  </Upload>
                )}
              </Form.Item>
            )}

            {/* 食材資訊表單 */}
            <Form.Item
              label="食材名稱"
              name="name"
              rules={[{ required: true, message: '請輸入食材名稱' }]}
            >
              <Input placeholder="例如：蘋果、雞胸肉" size="large" />
            </Form.Item>

            <Form.Item label="類別" name="category">
              <Input placeholder="例如：水果、肉類" size="large" />
            </Form.Item>

            <Space style={{ width: '100%' }} size="large">
              <Form.Item
                label="數量"
                name="quantity"
                rules={[{ required: true, message: '請輸入數量' }]}
              >
                <InputNumber min={1} style={{ width: 120 }} size="large" />
              </Form.Item>

              <Form.Item label="單位" name="unit">
                <Input placeholder="個、包、公斤" style={{ width: 120 }} size="large" />
              </Form.Item>
            </Space>

            <Form.Item label="效期" name="expiry_date">
              <DatePicker
                placeholder="選擇效期日期"
                style={{ width: '100%' }}
                size="large"
                format="YYYY-MM-DD"
              />
            </Form.Item>

            <Form.Item label="購買日期" name="purchase_date">
              <DatePicker
                placeholder="選擇購買日期"
                style={{ width: '100%' }}
                size="large"
                format="YYYY-MM-DD"
              />
            </Form.Item>

            <Form.Item label="價格（台幣）">
              <div style={{ display: 'flex', gap: 8 }}>
                <Form.Item name="price" noStyle>
                  <InputNumber
                    min={0}
                    placeholder="選填"
                    style={{ flex: 1 }}
                    size="large"
                  />
                </Form.Item>
                <Button
                  type="primary"
                  size="large"
                  icon={<CalendarOutlined />}
                  onClick={() => setCalendarVisible(true)}
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }} onClick={() => setCalendarVisible(true)}>
                  查看/紀錄本月消費紀錄
                </span>
              </div>
            </Form.Item>

            <Form.Item label="體積（公升，選填）" name="volume_liters" tooltip="用於計算冰箱容量使用率，不填則預估 0.5L">
              <InputNumber
                min={0}
                max={100}
                step={0.1}
                placeholder="例如：0.5"
                style={{ width: '100%' }}
                size="large"
suffix="公升"
              />
            </Form.Item>

            {/* 隱藏欄位（AI 辨識用） */}
            <Form.Item name="image_url" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="cloudinary_public_id" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="recognized_by_ai" hidden>
              <Input />
            </Form.Item>

            {/* 提交按鈕 */}
            <Form.Item style={{ marginTop: 32 }}>
              <Space style={{ width: '100%' }} size="middle">
                <Button onClick={() => navigate('/')} size="large" style={{ flex: 1 }}>
                  取消
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  style={{ flex: 2 }}
                >
                  新增食材
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* 消費月曆 Modal */}
        <ExpenseCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
        />
      </Content>
    </Layout>
  );
}

export default AddFoodItem;
