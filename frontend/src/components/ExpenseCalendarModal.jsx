/**
 * 消費月曆 Modal 元件
 *
 * 顯示每日消費記錄和月份總計。
 * 支援設定月預算上限和超額提醒。
 */

import { useState, useEffect } from 'react';
import { Modal, Calendar, Card, Badge, List, Tag, Typography, Spin, InputNumber, Progress, Alert, Space, Button } from 'antd';
import { CalendarOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { getFoodItems, getNotificationSettings, updateNotificationSettings } from '../services/api';

const { Text } = Typography;
const BUDGET_STORAGE_KEY = 'fridge-elf-monthly-budget';

function ExpenseCalendarModal({ visible, onClose }) {
  const [loading, setLoading] = useState(true);
  const [foodItems, setFoodItems] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailyItems, setDailyItems] = useState([]);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(0);

  // 載入預算設定（從通知設定 API）
  const loadBudgetFromSettings = async () => {
    try {
      const settings = await getNotificationSettings();
      if (settings?.budget_warning_amount) {
        setMonthlyBudget(settings.budget_warning_amount);
      }
    } catch (error) {
      console.error('載入預算設定失敗:', error);
      // 失敗時嘗試從 localStorage 讀取（向下相容）
      const savedBudget = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (savedBudget) {
        setMonthlyBudget(Number(savedBudget));
      }
    }
  };

  useEffect(() => {
    if (visible) {
      loadFoodItems();
      loadBudgetFromSettings();
    }
  }, [visible]);

  const loadFoodItems = async () => {
    try {
      setLoading(true);
      const items = await getFoodItems();
      // 只保留有價格的食材
      setFoodItems(items.filter((item) => item.price && item.price > 0));
    } catch (error) {
      console.error('載入食材失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 計算每日消費總額
  const getDailySpending = () => {
    const dailyMap = {};
    foodItems.forEach((item) => {
      if (item.purchase_date && item.price) {
        const dateKey = dayjs(item.purchase_date).format('YYYY-MM-DD');
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = 0;
        }
        dailyMap[dateKey] += item.price;
      }
    });
    return dailyMap;
  };

  // 計算指定月份的消費總額
  const getMonthlyTotal = (month) => {
    const monthKey = month.format('YYYY-MM');
    return foodItems
      .filter((item) => dayjs(item.purchase_date).format('YYYY-MM') === monthKey)
      .reduce((sum, item) => sum + (item.price || 0), 0);
  };

  // 日曆單元格渲染
  const dateCellRender = (value) => {
    const dateKey = value.format('YYYY-MM-DD');
    const dailySpending = getDailySpending();
    const amount = dailySpending[dateKey];

    if (amount) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Badge
            count={`$${amount}`}
            style={{
              backgroundColor: '#52c41a',
              fontSize: '10px',
              padding: '0 4px',
            }}
          />
        </div>
      );
    }
    return null;
  };

  // 點擊日期
  const handleDateSelect = (date) => {
    const dateKey = date.format('YYYY-MM-DD');
    const items = foodItems.filter(
      (item) => dayjs(item.purchase_date).format('YYYY-MM-DD') === dateKey
    );
    setSelectedDate(date);
    setDailyItems(items);
  };

  // 處理月曆月份切換
  const handlePanelChange = (date) => {
    setCalendarMonth(date);
    setSelectedDate(null);
    setDailyItems([]);
  };

  // 計算選中日期的總消費
  const selectedDateTotal = dailyItems.reduce((sum, item) => sum + (item.price || 0), 0);

  // 關閉時重置狀態
  const handleClose = () => {
    setSelectedDate(null);
    setDailyItems([]);
    setEditingBudget(false);
    onClose();
  };

  // 開始編輯預算
  const startEditBudget = () => {
    setTempBudget(monthlyBudget);
    setEditingBudget(true);
  };

  // 儲存預算（到通知設定 API）
  const saveBudget = async () => {
    try {
      setMonthlyBudget(tempBudget);
      setEditingBudget(false);

      // 同步到通知設定 API
      await updateNotificationSettings({
        budget_warning_amount: tempBudget,
      });

      // 也存到 localStorage 作為備份
      localStorage.setItem(BUDGET_STORAGE_KEY, String(tempBudget));
    } catch (error) {
      console.error('儲存預算設定失敗:', error);
      // 即使 API 失敗也存到 localStorage
      localStorage.setItem(BUDGET_STORAGE_KEY, String(tempBudget));
    }
  };

  // 計算預算使用百分比
  const monthlyTotal = getMonthlyTotal(calendarMonth);
  const budgetPercent = monthlyBudget > 0 ? Math.round((monthlyTotal / monthlyBudget) * 100) : 0;
  const isOverBudget = monthlyBudget > 0 && monthlyTotal > monthlyBudget;

  return (
    <Modal
      title={
        <>
          <CalendarOutlined /> 消費月曆
        </>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={800}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 超額警告 */}
          {isOverBudget && (
            <Alert
              message="超出預算！"
              description={`本月消費已超出預算 NT$ ${(monthlyTotal - monthlyBudget).toLocaleString()}`}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 月份消費總計 + 預算設定 */}
          <Card
            size="small"
            style={{
              marginBottom: 16,
              background: isOverBudget ? '#fff2f0' : '#f6ffed',
              borderColor: isOverBudget ? '#ffccc7' : '#b7eb8f',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {/* 消費 vs 預算 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 16 }}>
                  {calendarMonth.format('YYYY 年 M 月')} 總消費
                </Text>
                <Text strong style={{ fontSize: 20, color: isOverBudget ? '#ff4d4f' : '#52c41a' }}>
                  NT$ {monthlyTotal.toLocaleString()}
                </Text>
              </div>

              {/* 預算設定區 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary">月預算上限：</Text>
                {editingBudget ? (
                  <Space.Compact>
                    <InputNumber
                      value={tempBudget}
                      onChange={setTempBudget}
                      min={0}
                      step={1000}
                      formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                      style={{ width: 140 }}
                    />
                    <Button type="primary" icon={<CheckOutlined />} onClick={saveBudget} />
                  </Space.Compact>
                ) : (
                  <Space>
                    <Text strong>
                      {monthlyBudget > 0 ? `NT$ ${monthlyBudget.toLocaleString()}` : '未設定'}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={startEditBudget}
                    />
                  </Space>
                )}
              </div>

              {/* 預算進度條 */}
              {monthlyBudget > 0 && (
                <Progress
                  percent={Math.min(budgetPercent, 100)}
                  strokeColor={
                    budgetPercent > 100 ? '#ff4d4f' : budgetPercent > 80 ? '#faad14' : '#52c41a'
                  }
                  format={() => `${budgetPercent}%`}
                  status={isOverBudget ? 'exception' : 'active'}
                />
              )}
            </Space>
          </Card>

          <Calendar
            fullscreen={false}
            cellRender={dateCellRender}
            onSelect={handleDateSelect}
            onPanelChange={handlePanelChange}
          />

          {/* 當日消費明細 */}
          {selectedDate && (
            <Card
              size="small"
              title={`${selectedDate.format('YYYY/MM/DD')} 消費明細`}
              style={{ marginTop: 16 }}
            >
              {dailyItems.length === 0 ? (
                <Text type="secondary">當日無消費記錄</Text>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                      支出：NT$ {selectedDateTotal.toLocaleString()}
                    </Text>
                  </div>
                  <List
                    size="small"
                    dataSource={dailyItems}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <div>
                            <Text>{item.name}</Text>
                            {item.quantity > 1 && (
                              <Text type="secondary"> x{item.quantity}</Text>
                            )}
                            {item.category && (
                              <Tag style={{ marginLeft: 8 }}>{item.category}</Tag>
                            )}
                          </div>
                          <Text strong>NT$ {item.price?.toLocaleString()}</Text>
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              )}
            </Card>
          )}
        </>
      )}
    </Modal>
  );
}

ExpenseCalendarModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ExpenseCalendarModal;
