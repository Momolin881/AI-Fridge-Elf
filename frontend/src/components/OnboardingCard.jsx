/**
 * 新手三部曲卡片組件
 * 
 * 顯示新手進度和任務狀態，淺色系設計
 */

import { useState, useEffect } from 'react';
import { Card, Progress, Space, Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import './OnboardingCard.css';

const { Title, Text } = Typography;

const OnboardingCard = ({ 
  onClose, 
  progress = null,
  isVisible = true 
}) => {
  const [currentProgress, setCurrentProgress] = useState({
    tasks: {
      photo_upload: { completed: false },
      mark_consumed: { completed: false },
      recipe_view: { completed: false }
    },
    is_completed: false
  });

  useEffect(() => {
    if (progress) {
      setCurrentProgress(progress);
    }
  }, [progress]);

  // 計算完成進度
  const completedCount = Object.values(currentProgress.tasks || {}).filter(
    task => task.completed
  ).length;
  const totalTasks = Object.keys(currentProgress.tasks || {}).length;
  const progressPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  
  console.log('🔍 OnboardingCard 渲染詳情:', {
    tasks: currentProgress.tasks,
    photo_upload_completed: currentProgress.tasks?.photo_upload?.completed,
    mark_consumed_completed: currentProgress.tasks?.mark_consumed?.completed, 
    recipe_view_completed: currentProgress.tasks?.recipe_view?.completed,
    completedCount,
    totalTasks,
    progressPercentage
  });

  // 任務配置
  const tasks = [
    {
      key: 'photo_upload',
      icon: '📸',
      title: '拍照入庫',
      description: '使用AI辨識食材'
    },
    {
      key: 'mark_consumed',
      icon: '✅',
      title: '標記用完',
      description: '移出已使用食材'
    },
    {
      key: 'recipe_view',
      icon: '🍳',
      title: 'AI食譜',
      description: '查看智能推薦'
    }
  ];

  // 如果已完成或不可見，不渲染
  if (!isVisible || currentProgress.is_completed) {
    return null;
  }

  return (
    <Card className="onboarding-card">
      {/* 標題區域 */}
      <div className="onboarding-header">
        <div className="onboarding-title">
          <span className="title-icon">🏆</span>
          <Title level={4} className="title-text">新手三部曲</Title>
        </div>
        <Button 
          type="text" 
          icon={<CloseOutlined />}
          onClick={onClose}
          className="close-button"
          size="small"
        />
      </div>

      {/* 副標題 */}
      <Text className="subtitle">冰友挑戰:解鎖任務，馬上使用</Text>

      {/* 任務區域 */}
      <div className="tasks-container">
        <Space size="large" className="tasks-row">
          {tasks.map((task) => {
            const isCompleted = currentProgress.tasks[task.key]?.completed || false;
            return (
              <div key={task.key} className="task-item">
                <div className={`task-circle ${isCompleted ? 'completed' : 'pending'}`}>
                  <span className="task-icon">{task.icon}</span>
                </div>
                <div className="task-info">
                  <Text strong className="task-title">{task.title}</Text>
                  <Text className="task-description">{task.description}</Text>
                </div>
              </div>
            );
          })}
        </Space>
      </div>

      {/* 進度條 */}
      <div className="progress-section">
        <Progress 
          percent={progressPercentage}
          strokeColor="#52c41a"
          trailColor="#f0f0f0"
          size="small"
          format={() => `${completedCount}/${totalTasks}`}
        />
        <Text className="progress-text">
          已完成 {completedCount} / {totalTasks} 項任務
        </Text>
      </div>
    </Card>
  );
};

export default OnboardingCard;