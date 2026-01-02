/**
 * 食譜詳情頁面
 *
 * 顯示完整的食譜資訊，包含材料清單和烹飪步驟。
 */

import { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Divider,
  List,
  message,
  Descriptions,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  FireOutlined,
  HeartOutlined,
  HeartFilled,
} from '@ant-design/icons';
import { createUserRecipe } from '../services/api';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

function RecipeDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [isFavorite, setIsFavorite] = useState(false);
  const [adding, setAdding] = useState(false);

  // 從 navigation state 取得食譜資料
  const recipe = location.state?.recipe;

  if (!recipe) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Content style={{ padding: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/recipes/recommendations')}
            style={{ marginBottom: 16 }}
          >
            返回
          </Button>
          <Card>
            <Text type="secondary">找不到食譜資訊</Text>
          </Card>
        </Content>
      </Layout>
    );
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case '簡單':
        return 'green';
      case '中等':
        return 'orange';
      case '困難':
        return 'red';
      default:
        return 'default';
    }
  };

  const handleAddToFavorites = async (category = 'favorites') => {
    try {
      setAdding(true);
      await createUserRecipe(recipe, category);
      message.success('已加入收藏');
      setIsFavorite(true);
    } catch (error) {
      console.error('加入收藏失敗:', error);
      message.error('加入收藏失敗，請稍後再試');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        {/* 返回按鈕 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/recipes/recommendations')}
          style={{ marginBottom: 16 }}
        >
          返回
        </Button>

        {/* 食譜標題卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Title level={3} style={{ marginBottom: 8 }}>
                {recipe.name}
              </Title>
              <Space wrap style={{ marginBottom: 12 }}>
                <Tag color={getDifficultyColor(recipe.difficulty)}>
                  {recipe.difficulty}
                </Tag>
                {recipe.cooking_time && (
                  <Tag icon={<ClockCircleOutlined />}>
                    {recipe.cooking_time} 分鐘
                  </Tag>
                )}
                {recipe.cuisine_type && (
                  <Tag icon={<FireOutlined />}>
                    {recipe.cuisine_type}
                  </Tag>
                )}
              </Space>
              <Paragraph>{recipe.description}</Paragraph>
            </div>
            <Button
              type="primary"
              icon={isFavorite ? <HeartFilled /> : <HeartOutlined />}
              onClick={() => handleAddToFavorites()}
              loading={adding}
              disabled={isFavorite}
            >
              {isFavorite ? '已收藏' : '收藏'}
            </Button>
          </div>
        </Card>

        {/* 食材資訊 */}
        {(recipe.matched_ingredients?.length > 0 || recipe.missing_ingredients?.length > 0) && (
          <Card title="食材狀態" style={{ marginBottom: 16 }}>
            {recipe.matched_ingredients && recipe.matched_ingredients.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text strong>符合的現有食材：</Text>
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    {recipe.matched_ingredients.map((ingredient, i) => (
                      <Tag key={i} color="green">
                        {ingredient}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </div>
            )}
            {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
              <div>
                <Text strong>需要採買的食材：</Text>
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    {recipe.missing_ingredients.map((ingredient, i) => (
                      <Tag key={i} color="orange">
                        {ingredient}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* 材料清單 */}
        <Card title="材料清單" style={{ marginBottom: 16 }}>
          <List
            dataSource={recipe.ingredients}
            renderItem={(ingredient) => (
              <List.Item>
                <Text>
                  {ingredient.name}
                  {ingredient.amount && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {ingredient.amount}
                    </Text>
                  )}
                </Text>
              </List.Item>
            )}
          />
        </Card>

        {/* 烹飪步驟 */}
        <Card title="烹飪步驟">
          <List
            dataSource={recipe.steps}
            renderItem={(step, index) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <Text strong style={{ marginRight: 8 }}>
                    步驟 {index + 1}
                  </Text>
                  <Text>{step}</Text>
                </div>
              </List.Item>
            )}
          />
        </Card>

        {/* 快速收藏到分類 */}
        <Card
          title="加入食譜庫"
          style={{ marginTop: 16 }}
          extra={<Text type="secondary">選擇分類</Text>}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              block
              onClick={() => handleAddToFavorites('favorites')}
              loading={adding}
              disabled={isFavorite}
            >
              加入收藏
            </Button>
            <Button
              block
              onClick={() => handleAddToFavorites('常煮')}
              loading={adding}
              disabled={isFavorite}
            >
              加入常煮清單
            </Button>
            <Button
              block
              onClick={() => handleAddToFavorites('pro')}
              loading={adding}
              disabled={isFavorite}
            >
              加入黑白大廚 Pro
            </Button>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
}

export default RecipeDetail;
