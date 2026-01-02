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
  Space,
  Divider
} from 'antd';
import {
  BellOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  WarningOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getNotificationSettings, updateNotificationSettings } from '../services/api';

const { Title, Text, Paragraph } = Typography;

function NotificationSettings() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await getNotificationSettings();

      // 轉換資料格式以符合表單
      form.setFieldsValue({
        expiry_warning_enabled: settings.expiry_warning_enabled,
        expiry_warning_days: settings.expiry_warning_days,
        low_stock_enabled: settings.low_stock_enabled,
        low_stock_threshold: settings.low_stock_threshold,
        space_warning_enabled: settings.space_warning_enabled,
        space_warning_threshold: settings.space_warning_threshold,
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

      // 轉換資料格式
      const settings = {
        expiry_warning_enabled: values.expiry_warning_enabled,
        expiry_warning_days: values.expiry_warning_days,
        low_stock_enabled: values.low_stock_enabled,
        low_stock_threshold: values.low_stock_threshold,
        space_warning_enabled: values.space_warning_enabled,
        space_warning_threshold: values.space_warning_threshold,
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
          low_stock_enabled: false,
          low_stock_threshold: 1,
          space_warning_enabled: true,
          space_warning_threshold: 80,
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
          <Form.Item
            name="expiry_warning_enabled"
            valuePropName="checked"
            style={{ marginBottom: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>啟用效期提醒</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  在食材即將過期時通知您
                </Text>
              </div>
              <Switch />
            </div>
          </Form.Item>

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
                      1: '1天',
                      7: '7天',
                      14: '14天',
                      30: '30天'
                    }}
                    tooltip={{ formatter: (value) => `${value} 天` }}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Card>

        {/* 庫存提醒設定 */}
        <Card
          title={
            <Space>
              <InboxOutlined style={{ color: '#1890ff' }} />
              <span>庫存提醒</span>
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <Form.Item
            name="low_stock_enabled"
            valuePropName="checked"
            style={{ marginBottom: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>啟用庫存提醒</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  當食材數量低於門檻時通知您
                </Text>
              </div>
              <Switch />
            </div>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.low_stock_enabled !== currentValues.low_stock_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('low_stock_enabled') ? (
                <Form.Item
                  name="low_stock_threshold"
                  label="庫存門檻"
                  help="當食材數量低於此值時發送提醒"
                >
                  <InputNumber
                    min={0}
                    max={100}
                    style={{ width: '100%' }}
                    addonAfter="個"
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Card>

        {/* 空間提醒設定 */}
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              <span>空間提醒</span>
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <Form.Item
            name="space_warning_enabled"
            valuePropName="checked"
            style={{ marginBottom: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>啟用空間提醒</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  當冰箱空間使用率過高時通知您
                </Text>
              </div>
              <Switch />
            </div>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.space_warning_enabled !== currentValues.space_warning_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('space_warning_enabled') ? (
                <Form.Item
                  name="space_warning_threshold"
                  label="空間使用率門檻"
                >
                  <Slider
                    min={50}
                    max={100}
                    marks={{
                      50: '50%',
                      65: '65%',
                      80: '80%',
                      100: '100%'
                    }}
                    tooltip={{ formatter: (value) => `${value}%` }}
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
