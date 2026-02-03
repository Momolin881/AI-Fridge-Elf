/**
 * 編輯食材頁面
 *
 * 允許使用者編輯或刪除食材。
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Spin,
  Image,
  Upload,
  Modal,
} from 'antd';
import { DeleteOutlined, CalendarOutlined, CheckCircleOutlined, CameraOutlined, PictureOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFoodItem, updateFoodItem, deleteFoodItem, archiveFoodItem, getNotificationSettings, uploadFoodImage, getFridge } from '../services/api';
import { CompartmentSelector, ExpenseCalendarModal } from '../components';

const { Content } = Layout;
const { Title } = Typography;

function EditFoodItem() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [foodItem, setFoodItem] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [expiryWarningDays, setExpiryWarningDays] = useState(3); // 預設 3 天
  const [imageUploading, setImageUploading] = useState(false);
  const [fridgeDetail, setFridgeDetail] = useState(null);
  const [currentStorageType, setCurrentStorageType] = useState('冷藏');
  const [disposalModalVisible, setDisposalModalVisible] = useState(false);

  useEffect(() => {
    loadFoodItem();
    loadNotificationSettings();
  }, [id]);

  const loadNotificationSettings = async () => {
    try {
      const settings = await getNotificationSettings();
      if (settings?.expiry_warning_days) {
        setExpiryWarningDays(settings.expiry_warning_days);
      }
    } catch (error) {
      console.error('載入通知設定失敗:', error);
      // 失敗時使用預設值 3 天
    }
  };

  const loadFoodItem = async () => {
    try {
      setLoading(true);
      const data = await getFoodItem(id);
      setFoodItem(data);
      setCurrentStorageType(data.storage_type || '冷藏');

      // 載入冰箱詳情（包含分區資訊）
      if (data.fridge_id) {
        try {
          const fridge = await getFridge(data.fridge_id);
          setFridgeDetail(fridge);
        } catch (e) {
          console.error('載入冰箱詳情失敗:', e);
        }
      }

      // 填入表單
      form.setFieldsValue({
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        expiry_date: data.expiry_date ? dayjs(data.expiry_date) : null,
        purchase_date: data.purchase_date ? dayjs(data.purchase_date) : null,
        price: data.price,
        volume_liters: data.volume_liters,
        storage_type: data.storage_type,
        compartment_id: data.compartment_id,
      });
    } catch (error) {
      console.error('載入食材失敗:', error);
      message.error('載入食材失敗');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // 根據 storage_type 過濾分區選項
  const getFilteredCompartments = () => {
    if (!fridgeDetail?.compartments) return [];
    return fridgeDetail.compartments
      .filter((c) => c.parent_type === currentStorageType)
      .map((c) => ({
        value: c.id,
        label: c.name,
        parent: c.parent_type,
      }));
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // 轉換日期格式
      const updateData = {
        ...values,
        expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : null,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
      };

      await updateFoodItem(id, updateData);
      message.success('更新食材成功！');
      navigate('/');
    } catch (error) {
      console.error('更新食材失敗:', error);
      message.error('更新食材失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteFoodItem(id);
      message.success('刪除食材成功！');
      navigate('/');
    } catch (error) {
      console.error('刪除食材失敗:', error);
      message.error('刪除食材失敗，請稍後再試');
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async (disposalReason) => {
    try {
      setArchiving(true);
      await archiveFoodItem(id, disposalReason);
      const reasonText = disposalReason === 'used' ? '用完' : '丟棄';
      message.success(`食材已標記為「${reasonText}」！`);
      setDisposalModalVisible(false);
      navigate('/');
    } catch (error) {
      console.error('標記已處理失敗:', error);
      message.error('操作失敗，請稍後再試');
    } finally {
      setArchiving(false);
    }
  };

  // 處理圖片上傳
  const handleImageUpload = async (file) => {
    if (!foodItem?.fridge_id) {
      message.error('找不到冰箱資訊');
      return false;
    }

    try {
      setImageUploading(true);
      message.loading({ content: '正在上傳圖片...', key: 'image-upload' });

      // 上傳圖片
      const result = await uploadFoodImage(file, foodItem.fridge_id);

      // 更新食材圖片資訊
      await updateFoodItem(id, {
        image_url: result.image_url,
        cloudinary_public_id: result.cloudinary_public_id,
      });

      // 更新本地狀態
      setFoodItem(prev => ({
        ...prev,
        image_url: result.image_url,
        cloudinary_public_id: result.cloudinary_public_id,
      }));

      message.success({ content: '圖片上傳成功！', key: 'image-upload' });
    } catch (error) {
      console.error('圖片上傳失敗:', error);
      message.error({ content: '圖片上傳失敗，請稍後再試', key: 'image-upload' });
    } finally {
      setImageUploading(false);
    }

    return false; // 阻止 antd Upload 的預設上傳行為
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="載入中..." />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          編輯食材
        </Title>

        <Card>
          {/* 已處理按鈕 - 只有已過期或即將過期（3天內）的 active 食材才顯示 */}
          {foodItem?.status !== 'archived' &&
            foodItem?.expiry_date &&
            dayjs(foodItem.expiry_date).diff(dayjs(), 'day') <= expiryWarningDays && (
              <Popconfirm
                title="確定要標記為「已處理」嗎？"
                description="食材將從冰箱清單移除，進入歷史紀錄"
                onConfirm={handleArchive}
                okText="確定"
                cancelText="取消"
                okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={archiving}
                  size="large"
                  block
                  style={{
                    background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                    border: 'none',
                    marginBottom: 16,
                  }}
                >
                  標記為「已處理」
                </Button>
              </Popconfirm>
            )}

          {/* 已封存提示 */}
          {foodItem?.status === 'archived' && (
            <div style={{
              padding: '12px 16px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              textAlign: 'center',
              marginBottom: 16,
            }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              此食材已於 {foodItem.archived_at ? dayjs(foodItem.archived_at).format('YYYY-MM-DD HH:mm') : '-'} 標記為已處理
            </div>
          )}

          {/* 圖片區域 - 顯示現有圖片或上傳新圖片 */}
          <div style={{ marginBottom: 24 }}>
            {foodItem?.image_url ? (
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={foodItem.image_url}
                  alt={foodItem.name}
                  style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }}
                />
                {foodItem.recognized_by_ai === 1 && (
                  <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                    此食材由 AI 辨識
                  </div>
                )}
                <Upload
                  beforeUpload={handleImageUpload}
                  showUploadList={false}
                  accept="image/*"
                >
                  <Button
                    icon={<CameraOutlined />}
                    loading={imageUploading}
                    style={{ marginTop: 12 }}
                  >
                    更換圖片
                  </Button>
                </Upload>
              </div>
            ) : (
              <Upload
                beforeUpload={handleImageUpload}
                showUploadList={false}
                accept="image/*"
              >
                <div
                  style={{
                    border: '2px dashed #d9d9d9',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {imageUploading ? (
                    <Spin tip="上傳中..." />
                  ) : (
                    <>
                      <p style={{ fontSize: '28px', margin: 0 }}>📷</p>
                      <p style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
                        點擊上傳食材圖片
                      </p>
                      <p style={{ fontSize: '12px', color: '#999' }}>
                        支援 JPG、PNG 格式
                      </p>
                    </>
                  )}
                </div>
              </Upload>
            )}
          </div>

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  min={0}
                  placeholder="選填"
                  style={{ width: '100%' }}
                  size="large"
                />
                <Button
                  size="large"
                  icon={<CalendarOutlined />}
                  onClick={() => setCalendarVisible(true)}
                  title="查看消費月曆"
                />
              </Space.Compact>
            </Form.Item>

            <Form.Item label="體積（公升，選填）" name="volume_liters" tooltip="用於計算冰箱容量使用率，不填則預估 0.5L">
              <InputNumber
                min={0}
                max={100}
                step={0.1}
                placeholder="例如：0.5"
                style={{ width: '100%' }}
                size="large"
                addonAfter="公升"
              />
            </Form.Item>

            {/* 儲存類型 */}
            <Form.Item
              label="儲存類型"
              name="storage_type"
              rules={[{ required: true, message: '請選擇儲存類型' }]}
            >
              <Radio.Group onChange={(e) => {
                setCurrentStorageType(e.target.value);
                // 切換儲存類型時清空分區選擇
                form.setFieldValue('compartment_id', null);
              }}>
                <Radio value="冷藏">冷藏</Radio>
                <Radio value="冷凍">冷凍</Radio>
              </Radio.Group>
            </Form.Item>

            {/* 分區選擇（細分模式） */}
            {fridgeDetail?.compartment_mode === 'detailed' && (
              <Form.Item label="分區（可選）" name="compartment_id">
                <CompartmentSelector
                  mode="detailed"
                  customCompartments={getFilteredCompartments()}
                />
              </Form.Item>
            )}

            {/* 提交按鈕 */}
            <Form.Item style={{ marginTop: 32 }}>
              <Space style={{ width: '100%' }} size="middle" direction="vertical">
                <Space style={{ width: '100%' }} size="middle">
                  <Button onClick={() => navigate('/')} size="large" style={{ flex: 1 }}>
                    取消
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    size="large"
                    style={{ flex: 2 }}
                  >
                    儲存變更
                  </Button>
                </Space>

                <Button
                  icon={<InboxOutlined />}
                  size="large"
                  block
                  onClick={() => setDisposalModalVisible(true)}
                  style={{ background: '#f0f0f0' }}
                >
                  移出冰箱
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* 處理方式選擇 Modal */}
        <Modal
          title="這項食材怎麼處理了？"
          open={disposalModalVisible}
          onCancel={() => setDisposalModalVisible(false)}
          footer={null}
          centered
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              onClick={() => handleArchive('used')}
              loading={archiving}
              style={{ height: 60, fontSize: 16 }}
            >
              ✅ 已用完（煮掉/吃掉）
            </Button>
            <Button
              danger
              size="large"
              block
              icon={<DeleteOutlined />}
              onClick={() => handleArchive('wasted')}
              loading={archiving}
              style={{ height: 60, fontSize: 16 }}
            >
              🗑️ 已丟棄（過期/壞掉）
            </Button>
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              這將幫助計算你節省了多少食材浪費
            </div>
          </Space>
        </Modal>

        {/* 消費月曆 Modal */}
        <ExpenseCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
        />

        {/* 提示文字 */}
        <div style={{ textAlign: 'center', padding: '16px', color: '#999', fontSize: 12 }}>
          食材用完或丢棄时，請點擊「移出冰箱」選擇處理方式
        </div>
      </Content>
    </Layout>
  );
}

export default EditFoodItem;
