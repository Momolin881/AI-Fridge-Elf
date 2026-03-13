/**
 * 新增食材頁面
 *
 * 支援兩種方式：
 * 1. AI 圖片辨識（自動填入資訊）
 * 2. 手動輸入
 */

import { useState, useEffect, useCallback } from 'react';
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
import { getFridges, getFridge, recognizeFoodImage, createFoodItem, uploadFoodImage, completeOnboardingTask, getOnboardingProgress } from '../services/api';
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
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [photoTaskCompleted, setPhotoTaskCompleted] = useState(false);

  // 簡化的圖片處理函數（避免壓縮導致的問題）
  const processImage = async (file) => {
    try {
      // 如果檔案太大（超過 5MB），提醒使用者
      if (file.size > 5 * 1024 * 1024) {
        message.warning('圖片檔案較大，可能影響上傳速度');
      }
      
      // 直接回傳原檔案，不進行壓縮
      // 讓後端處理圖片大小和格式問題
      return file;
    } catch (error) {
      console.error('圖片處理錯誤:', error);
      return file;
    }
  };

  useEffect(() => {
    loadFridges();
    loadOnboardingData();
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

  // 載入新手進度資料
  const loadOnboardingData = async () => {
    try {
      const response = await getOnboardingProgress();
      setOnboardingProgress(response.data);
    } catch (error) {
      // 靜默處理，不影響正常功能
      console.log('載入新手進度失敗:', error);
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

  // 使用 useCallback 避免 onChange 處理函數重新建立導致的循環引用警告
  const handleCompartmentChange = useCallback((value) => {
    // 選擇分區時，自動設定儲存類型
    const compartment = selectedFridgeDetail?.compartments?.find((c) => c.id === value);
    if (compartment?.parent_type) {
      form.setFieldValue('storage_type', compartment.parent_type);
    }
  }, [selectedFridgeDetail?.compartments, form]);

  const handleImageUpload = async (file) => {
    const fridgeId = form.getFieldValue('fridge_id') || selectedFridge;
    const storageType = form.getFieldValue('storage_type');

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

      // 呼叫 AI 辨識 API（直接使用原檔案）
      const result = await recognizeFoodImage(file, validFridgeId, effectiveStorageType);

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
      
      // 檢查是否為新手，只有新手才觸發任務
      const isPhotoTaskCompleted = onboardingProgress?.tasks?.photo_upload?.completed || photoTaskCompleted || false;
      
      if (!isPhotoTaskCompleted) {
        try {
          console.log('🎯 新手AI辨識成功，觸發任務：photo_upload');
          const taskResult = await completeOnboardingTask('photo_upload');
          console.log('✅ 新手任務完成：拍照入庫', taskResult);
          console.log('🔍 taskResult.progress 存在嗎?', !!taskResult.progress);
          console.log('🔍 taskResult.progress 內容:', taskResult.progress);
          console.log('🔍 photo_upload 任務狀態:', taskResult.progress?.tasks?.photo_upload);
          // 直接使用 API 回應中的最新進度，而不是重新載入
          if (taskResult.progress) {
            setOnboardingProgress(taskResult.progress);
            setPhotoTaskCompleted(true); // 標記已完成，避免重複執行
            console.log('🔄 已更新本地進度狀態:', taskResult.progress);
            
            // 保存最新進度用於導航傳遞
            window.latestOnboardingProgress = taskResult.progress;
          } else {
            console.log('❌ taskResult.progress 不存在，無法更新狀態');
          }
        } catch (taskError) {
          console.error('❌ 新手任務完成失敗:', taskError);
        }
      }
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
      
      // 檢查是否為新手，如果是新手且AI辨識失敗，發送LINE通知並自動完成任務
      const isPhotoTaskCompleted = onboardingProgress?.tasks?.photo_upload?.completed || photoTaskCompleted || false;
      
      if (!isPhotoTaskCompleted) {
        console.log('🔸 新手AI辨識失敗，準備發送LINE通知');
        
        // 發送LINE@通知給管理員
        try {
          if (window.liff && window.liff.isLoggedIn()) {
            await window.liff.sendMessages([{
              type: 'text',
              text: '新手任務-AI辨識失敗'
            }]);
            console.log('📤 LINE通知已發送：新手任務-AI辨識失敗');
          }
        } catch (lineError) {
          console.error('❌ LINE通知發送失敗:', lineError);
        }
        
        // 自動完成新手任務，讓用戶不會卡住
        try {
          const taskResult = await completeOnboardingTask('photo_upload');
          console.log('✅ 新手任務自動完成：拍照入庫（AI失敗補救）', taskResult);
          // 直接使用 API 回應中的最新進度
          if (taskResult.progress) {
            setOnboardingProgress(taskResult.progress);
            setPhotoTaskCompleted(true); // 標記已完成，避免重複執行
            console.log('🔄 已更新本地進度狀態:', taskResult.progress);
            
            // 保存最新進度用於導航傳遞
            window.latestOnboardingProgress = taskResult.progress;
          }
        } catch (taskError) {
          console.error('❌ 新手任務自動完成失敗:', taskError);
        }
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

      // 上傳圖片（不含 AI 辨識，直接使用原檔案）
      const result = await uploadFoodImage(file, validFridgeId);

      // 設定表單欄位
      form.setFieldsValue({
        image_url: result.image_url,
        cloudinary_public_id: result.cloudinary_public_id,
      });

      // 顯示預覽圖
      setPreviewImageUrl(result.image_url);

      message.success({ content: '圖片上傳成功！', key: 'manual-upload' });
      
      // 檢查是否為新手，只有新手才觸發任務
      const isPhotoTaskCompleted = onboardingProgress?.tasks?.photo_upload?.completed || photoTaskCompleted || false;
      
      if (!isPhotoTaskCompleted) {
        try {
          console.log('🎯 新手手動上傳成功，觸發任務：photo_upload');
          const taskResult = await completeOnboardingTask('photo_upload');
          console.log('✅ 新手任務完成：拍照入庫（手動上傳）', taskResult);
          // 直接使用 API 回應中的最新進度
          if (taskResult.progress) {
            setOnboardingProgress(taskResult.progress);
            console.log('🔄 已更新本地進度狀態:', taskResult.progress);
            
            // 保存最新進度用於導航傳遞
            window.latestOnboardingProgress = taskResult.progress;
          }
        } catch (taskError) {
          console.error('❌ 新手任務完成失敗:', taskError);
        }
      }
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
      
      // 檢查是否為新手，只有新手且還沒完成拍照任務才觸發
      const isPhotoTaskCompleted = onboardingProgress?.tasks?.photo_upload?.completed || photoTaskCompleted || false;
      
      if (!isPhotoTaskCompleted) {
        try {
          console.log('🎯 新手儲存食材成功，觸發任務：photo_upload');
          const taskResult = await completeOnboardingTask('photo_upload');
          console.log('✅ 新手任務完成：拍照入庫（儲存食材）', taskResult);
          // 直接使用 API 回應中的最新進度
          if (taskResult.progress) {
            setOnboardingProgress(taskResult.progress);
            console.log('🔄 已更新本地進度狀態:', taskResult.progress);
            
            // 保存最新進度用於導航傳遞
            window.latestOnboardingProgress = taskResult.progress;
          }
        } catch (error) {
          console.error('❌ 新手任務完成失敗:', error);
        }
      }
      
      // 延遲一點導航，確保後端狀態更新完成
      // 直接傳遞最新的進度資料，不依賴重新查詢
      setTimeout(() => {
        // 使用全域保存的最新進度，避免狀態更新延遲問題
        const progressToPass = window.latestOnboardingProgress || onboardingProgress;
        console.log('📤 準備傳遞的進度資料:', progressToPass);
        navigate('/', { 
          replace: true, 
          state: { 
            refreshOnboarding: true, 
            onboardingProgress: progressToPass, // 傳遞最新進度
            timestamp: Date.now() 
          } 
        });
      }, 100);
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
                  onChange={handleCompartmentChange}
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
