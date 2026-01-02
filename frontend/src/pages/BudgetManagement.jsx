/**
 * 預算控管頁面
 *
 * 顯示消費統計、預算設定、採買建議等功能。
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Form,
  InputNumber,
  Slider,
  Button,
  message,
  Spin,
  Typography,
  Space,
  Statistic,
  Progress,
  List,
  Tag,
  Tabs,
  Alert,
} from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
  PieChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  getSpendingStats,
  getBudgetSettings,
  updateBudgetSettings,
  getShoppingSuggestions,
} from '../services/api';

// 註冊 Chart.js 組件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend
);

const { Title, Text, Paragraph } = Typography;

function BudgetManagement() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, settingsData, suggestionsData] = await Promise.all([
        getSpendingStats(period),
        getBudgetSettings(),
        getShoppingSuggestions(),
      ]);

      setStats(statsData);
      setSettings(settingsData);
      setSuggestions(suggestionsData);

      // 設定表單初始值
      form.setFieldsValue({
        monthly_budget: settingsData.monthly_budget,
        warning_threshold: settingsData.warning_threshold,
      });
    } catch (error) {
      console.error('載入預算資料失敗:', error);
      message.error('載入資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      await updateBudgetSettings(values);
      message.success('預算設定已儲存');
      loadData();
    } catch (error) {
      console.error('儲存預算設定失敗:', error);
      message.error('儲存設定失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  // 消費趨勢圖表數據
  const getTrendChartData = () => {
    if (!stats || !stats.monthly_trend) return null;

    return {
      labels: stats.monthly_trend.map((item) => item.month),
      datasets: [
        {
          label: '月度消費（NT$）',
          data: stats.monthly_trend.map((item) => item.amount),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.3,
          fill: true,
        },
      ],
    };
  };

  // 分類消費圖表數據
  const getCategoryChartData = () => {
    if (!stats || !stats.category_breakdown || stats.category_breakdown.length === 0) {
      return null;
    }

    const colors = [
      'rgba(255, 99, 132, 0.8)',
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
    ];

    return {
      labels: stats.category_breakdown.map((item) => item.category),
      datasets: [
        {
          label: '消費金額（NT$）',
          data: stats.category_breakdown.map((item) => item.amount),
          backgroundColor: colors.slice(0, stats.category_breakdown.length),
          borderColor: colors.slice(0, stats.category_breakdown.length).map((color) =>
            color.replace('0.8', '1')
          ),
          borderWidth: 1,
        },
      ],
    };
  };

  // 優先級標籤顏色
  const getPriorityColor = (priority) => {
    switch (priority) {
      case '高':
        return 'red';
      case '中':
        return 'orange';
      case '低':
        return 'blue';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '20px',
        }}
      >
        <Spin size="large" tip="載入中..." />
      </div>
    );
  }

  const trendChartData = getTrendChartData();
  const categoryChartData = getCategoryChartData();

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
          <DollarOutlined /> 預算控管
        </Title>
        <Paragraph type="secondary" style={{ marginTop: '8px' }}>
          管理您的食材採購預算和消費分析
        </Paragraph>
      </div>

      {/* 期間選擇 */}
      <Tabs
        activeKey={period}
        onChange={setPeriod}
        items={[
          { key: 'month', label: '本月統計' },
          { key: 'year', label: '本年統計' },
        ]}
        style={{ marginBottom: '16px' }}
      />

      {/* 警告提示 */}
      {stats && stats.is_over_threshold && (
        <Alert
          message="預算警告"
          description={`您已使用 ${stats.budget_used_percentage.toFixed(1)}% 的預算，超過警告門檻！`}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          closable
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 統計卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col span={12}>
          <Card>
            <Statistic
              title={period === 'month' ? '本月消費' : '本年消費'}
              value={stats?.total_spending || 0}
              precision={0}
              prefix="NT$"
              valueStyle={{ color: stats?.is_over_threshold ? '#ff4d4f' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title={period === 'month' ? '月度預算' : '年度預算'}
              value={stats?.budget || 0}
              precision={0}
              prefix="NT$"
            />
          </Card>
        </Col>
      </Row>

      {/* 預算進度 */}
      <Card title="預算使用進度" style={{ marginBottom: '16px' }}>
        <Progress
          percent={stats?.budget_used_percentage || 0}
          status={stats?.is_over_threshold ? 'exception' : 'active'}
          strokeColor={stats?.is_over_threshold ? '#ff4d4f' : '#52c41a'}
          format={(percent) => `${percent.toFixed(1)}%`}
        />
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <Text type="secondary">
            已使用 NT${stats?.total_spending.toLocaleString()} / NT${stats?.budget.toLocaleString()}
          </Text>
        </div>
      </Card>

      {/* 消費趨勢圖 */}
      {trendChartData && (
        <Card
          title={
            <Space>
              <LineChartOutlined />
              <span>消費趨勢（最近12個月）</span>
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <Line
            data={trendChartData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              aspectRatio: 2,
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function (value) {
                      return 'NT$' + value.toLocaleString();
                    },
                  },
                },
              },
            }}
          />
        </Card>
      )}

      {/* 分類消費統計 */}
      {categoryChartData && (
        <Card
          title={
            <Space>
              <PieChartOutlined />
              <span>分類消費統計</span>
            </Space>
          }
          style={{ marginBottom: '16px' }}
        >
          <Row gutter={16}>
            <Col span={24} md={12}>
              <Pie
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  aspectRatio: 1.5,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          return `${label}: NT$${value.toLocaleString()}`;
                        },
                      },
                    },
                  },
                }}
              />
            </Col>
            <Col span={24} md={12}>
              <List
                size="small"
                dataSource={stats?.category_breakdown || []}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{item.category}</Text>
                      <div>
                        <Text strong style={{ marginRight: '8px' }}>
                          NT${item.amount.toLocaleString()}
                        </Text>
                        <Text type="secondary">({item.count} 項)</Text>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 採買建議 */}
      <Card
        title={
          <Space>
            <ShoppingCartOutlined />
            <span>採買建議</span>
          </Space>
        }
        style={{ marginBottom: '16px' }}
      >
        {suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Text type="secondary">目前沒有採買建議</Text>
          </div>
        ) : (
          <List
            dataSource={suggestions}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.food_name}</span>
                      {item.category && <Tag>{item.category}</Tag>}
                      <Tag color={getPriorityColor(item.priority)}>{item.priority}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div>{item.reason}</div>
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary">
                          目前庫存: {item.current_quantity} | 建議採購: {item.suggested_quantity}
                        </Text>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 預算設定 */}
      <Card title={<Space><DollarOutlined /><span>預算設定</span></Space>} style={{ marginBottom: '80px' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="monthly_budget"
            label="月度預算（NT$）"
            rules={[{ required: true, message: '請輸入月度預算' }]}
          >
            <InputNumber
              min={0}
              max={1000000}
              style={{ width: '100%' }}
              formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="warning_threshold"
            label="警告門檻（%）"
            help="當預算使用率達到此門檻時會發出警告"
          >
            <Slider
              min={50}
              max={100}
              marks={{
                50: '50%',
                65: '65%',
                80: '80%',
                100: '100%',
              }}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            儲存設定
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default BudgetManagement;
