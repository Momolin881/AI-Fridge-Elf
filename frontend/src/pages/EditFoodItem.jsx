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
  Popconfirm,
  Image,
} from 'antd';
import { DeleteOutlined, CalendarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFoodItem, updateFoodItem, deleteFoodItem, archiveFoodItem, getNotificationSettings } from '../services/api';
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

      // 填入表單
      form.setFieldsValue({
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        expiry_date: data.expiry_date ? dayjs(data.expiry_date) : null,
        purchase_date: data.purchase_date ? dayjs(data.purchase_date) : null,
        price: data.price,
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

  const handleArchive = async () => {
    try {
      setArchiving(true);
      await archiveFoodItem(id);
      message.success('食材已標記為「已處理」！');
      navigate('/');
    } catch (error) {
      console.error('標記已處理失敗:', error);
      message.error('操作失敗，請稍後再試');
    } finally {
      setArchiving(false);
    }
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

          {/* 顯示圖片（如果有） */}
          {foodItem?.image_url && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
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
            </div>
          )}

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
              <CompartmentSelector fridgeId={foodItem?.fridge_id} />
            </Form.Item>

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

                <Popconfirm
                  title="確定要刪除此食材嗎？"
                  description="此操作無法復原"
                  onConfirm={handleDelete}
                  okText="確定刪除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleting}
                    size="large"
                    block
                  >
                    刪除食材
                  </Button>
                </Popconfirm>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* 消費月曆 Modal */}
        <ExpenseCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
        />

        {/* 提示文字 */}
        <div style={{ textAlign: 'center', padding: '16px', color: '#999', fontSize: 12 }}>
          在效期前拿出享用的食材，請定期手動刪除
        </div>
      </Content>
    </Layout>
  );
}

export default EditFoodItem;
