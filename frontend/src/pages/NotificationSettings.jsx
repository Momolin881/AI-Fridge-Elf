/**
 * 通知設定頁面
 *
 * 允許使用者設定效期提醒、庫存提醒、空間提醒的參數。
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Switch,
  Slider,
  InputNumber,
  TimePicker,
  Button,
  message,
  Spin,
  Typography,
  Space
} from 'antd';
import {
  BellOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ArrowLeftOutlined,
  SendOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getNotificationSettings, updateNotificationSettings, testExpiryNotification } from '../services/api';

const { Title, Text, Paragraph } = Typography;

function NotificationSettings() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await getNotificationSettings();

      // 轉換資料格式以符合表單（現在後端已支援 budget_warning）
      form.setFieldsValue({
        expiry_warning_enabled: settings.expiry_warning_enabled,
        expiry_warning_days: settings.expiry_warning_days,
        budget_warning_enabled: settings.budget_warning_enabled ?? false,
        budget_warning_amount: settings.budget_warning_amount ?? 5000,
        notification_time: settings.notification_time ? dayjs(settings.notification_time, 'HH:mm') : dayjs('09:00', 'HH:mm')
      });

    } catch (error) {
      console.error('載入通知設定失敗:', error);
      message.error('載入設定失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // 轉換資料格式（現在後端已支援所有欄位）
      const settings = {
        expiry_warning_enabled: values.expiry_warning_enabled,
        expiry_warning_days: values.expiry_warning_days,
        budget_warning_enabled: values.budget_warning_enabled,
        budget_warning_amount: values.budget_warning_amount,
        notification_time: values.notification_time.format('HH:mm')
      };

      await updateNotificationSettings(settings);
      message.success('通知設定已儲存');

    } catch (error) {
      console.error('儲存通知設定失敗:', error);
      message.error('儲存設定失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setTesting(true);
      await testExpiryNotification();
      message.success('測試通知已發送，請查看 LINE 訊息');
    } catch (error) {
      console.error('發送測試通知失敗:', error);
      if (error.response?.status === 401) {
        message.error('請先在 LINE 內重新開啟應用');
      } else {
        message.error('發送測試通知失敗：' + (error.response?.data?.detail || '請稍後再試'));
      }
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px'
      }}>
        <Spin size="large" tip="載入中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', paddingBottom: '80px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* 標題列 */}
      <div style={{ marginBottom: '20px' }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ marginBottom: '10px' }}
        >
          返回
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          <BellOutlined /> 通知設定
        </Title>
        <Paragraph type="secondary" style={{ marginTop: '8px' }}>
          設定您的通知偏好，我們會在適當時間提醒您
        </Paragraph>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          expiry_warning_enabled: true,
          expiry_warning_days: 3,
          budget_warning_enabled: false,
          budget_warning_amount: 5000,
          notification_time: dayjs('09:00', 'HH:mm')
        }}
      >
        {/* 效期提醒設定 */}
        <Card
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#ff9900' }} />
              <span>效期提醒</span>
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <Text strong>啟用效期提醒</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                在食材即將過期時通知您
              </Text>
            </div>
            <Form.Item
              name="expiry_warning_enabled"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.expiry_warning_enabled !== currentValues.expiry_warning_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('expiry_warning_enabled') ? (
                <Form.Item
                  name="expiry_warning_days"
                  label="提前提醒天數"
                >
                  <Slider
                    min={1}
                    max={30}
                    marks={{
                      1: '1',
                      2: '2',
                      3: '3',
                      4: '4',
                      5: '5',
                      6: '6',
                      7: '7',
                      14: '14',
                      30: '30天'
                    }}
                    step={null}
                    tooltip={{ formatter: (value) => `${value} 天` }}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Card>

        {/* 月消費金額提醒 */}
        <Card
          title={
            <Space>
              <DollarOutlined style={{ color: '#52c41a' }} />
              <span>月消費金額提醒</span>
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <Text strong>啟用消費提醒</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                當月消費超過設定金額時通知您
              </Text>
            </div>
            <Form.Item
              name="budget_warning_enabled"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.budget_warning_enabled !== currentValues.budget_warning_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('budget_warning_enabled') ? (
                <Form.Item
                  name="budget_warning_amount"
                  label="月消費上限"
                  help="當月消費超過此金額時發送提醒"
                >
                  <InputNumber
                    min={0}
                    max={100000}
                    step={500}
                    style={{ width: '100%' }}
                    addonBefore="NT$"
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Card>

        {/* 通知時間設定 */}
        <Card
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#52c41a' }} />
              <span>通知時間</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Form.Item
            name="notification_time"
            label="每日通知時間"
            help="系統將在此時間檢查並發送通知"
          >
            <TimePicker
              format="HH:mm"
              style={{ width: '100%' }}
              placeholder="選擇時間"
              showNow={false}
              minuteStep={15}
            />
          </Form.Item>
        </Card>

        {/* 測試通知按鈕 */}
        <Card
          title={
            <Space>
              <SendOutlined style={{ color: '#1890ff' }} />
              <span>測試通知</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
            點擊下方按鈕立即發送一則測試通知到您的 LINE，確認通知功能正常運作。
          </Paragraph>
          <Button
            icon={<SendOutlined />}
            onClick={handleTestNotification}
            loading={testing}
            block
          >
            發送測試通知
          </Button>
        </Card>

        {/* 儲存按鈕 */}
        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitting}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            zIndex: 1000
          }}
        >
          儲存設定
        </Button>
      </Form>
    </div>
  );
}

export default NotificationSettings;
