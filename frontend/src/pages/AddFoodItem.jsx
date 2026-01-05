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
} from 'antd';
import { CameraOutlined, FormOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFridges, recognizeFoodImage, createFoodItem } from '../services/api';
import { ImageUploader, CompartmentSelector } from '../components';

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

  useEffect(() => {
    loadFridges();
  }, []);

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

  const handleImageUpload = async (file) => {
    const fridgeId = form.getFieldValue('fridge_id') || selectedFridge;
    const storageType = form.getFieldValue('storage_type');

    // 嚴格驗證 fridgeId（確保是有效數字）
    const validFridgeId = Number(fridgeId);
    if (!storageType) {
      message.warning('請先選擇儲存類型');
      return;
    }
    if (!fridgeId || isNaN(validFridgeId) || validFridgeId <= 0) {
      message.warning('請先選擇冰箱');
      console.error('❌ Invalid fridge_id:', { fridgeId, selectedFridge, formValue: form.getFieldValue('fridge_id') });
      return;
    }

    try {
      setAiRecognizing(true);
      message.loading({ content: 'AI 辨識中...', key: 'ai-recognition' });

      // 呼叫 AI 辨識 API（使用已驗證的數字）
      const result = await recognizeFoodImage(file, validFridgeId, storageType);

      message.success({ content: result.confidence, key: 'ai-recognition' });

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
    } catch (error) {
      console.error('AI 辨識失敗:', error);
      message.error({ content: 'AI 辨識失敗，請手動輸入', key: 'ai-recognition' });
    } finally {
      setAiRecognizing(false);
    }
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

      // 修復：移除無效的 compartment_id（如果是字符串或不是數字）
      if (foodData.compartment_id && typeof foodData.compartment_id !== 'number') {
        delete foodData.compartment_id;
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

            {/* 儲存類型 */}
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

            {/* 分區選擇（細分模式） */}
            <Form.Item label="分區（可選）" name="compartment_id">
              <CompartmentSelector fridgeId={selectedFridge} />
            </Form.Item>

            {/* AI 模式：圖片上傳 */}
            {mode === 'ai' && (
              <>
                <Form.Item label="拍照上傳" required>
                  <ImageUploader onUpload={handleImageUpload} loading={aiRecognizing} />
                </Form.Item>
                <Divider>AI 辨識結果（可編輯）</Divider>
              </>
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

            <Form.Item label="價格（台幣）" name="price">
              <InputNumber
                min={0}
                placeholder="選填"
                style={{ width: '100%' }}
                size="large"
                addonAfter="元"
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
      </Content>
    </Layout>
  );
}

export default AddFoodItem;
