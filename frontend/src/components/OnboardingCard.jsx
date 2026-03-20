/**
 * 新手三部曲卡片組件
 * 
 * 顯示新手進度和任務狀態，整合 SVG 圓環進度 + 撒花特效
 */

import { useState, useEffect } from 'react';
import { Card, Space, Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import './OnboardingCard.css';

const { Title, Text } = Typography;

// SVG 圓環進度組件
const ProgressRing = ({ completed }) => {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  
  return (
    <svg className="onboarding-card__ring-svg" width="48" height="48" viewBox="0 0 48 48">
      <circle 
        className="onboarding-card__ring-bg" 
        cx="24" cy="24" r={r}
        fill="none"
        stroke="#f0f0f0"
        strokeWidth="3"
      />
      <circle
        className={`onboarding-card__ring-progress${completed ? ' onboarding-card__ring-progress--done' : ''}`}
        cx="24" cy="24" r={r}
        fill="none"
        stroke={completed ? "#52c41a" : "#d9d9d9"}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={completed ? 0 : circumference}
        transform="rotate(-90 24 24)"
      />
    </svg>
  );
};

// 撒花特效組件
const Confetti = () => {
  return (
    <div className="onboarding-card__confetti">
      {Array.from({ length: 30 }).map((_, i) => (
        <div 
          key={i} 
          className="onboarding-card__confetti-piece" 
          style={{ 
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: ['#52c41a', '#1890ff', '#fadb14', '#f5222d', '#722ed1'][Math.floor(Math.random() * 5)]
          }} 
        />
      ))}
    </div>
  );
};

const OnboardingCard = ({ 
  onClose, 
  progress = null,
  isVisible = true,
  onCelebrationTrigger = null
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
      
      // 檢查是否所有任務都完成了
      const allCompleted = Object.values(progress.tasks || {}).every(task => task.completed);
      const totalTasks = Object.keys(progress.tasks || {}).length;
      
      console.log('🔍 OnboardingCard 檢查完成狀態:', { allCompleted, totalTasks, achievement_sent: progress.achievement_sent });
      
      if (allCompleted && totalTasks === 3 && !progress.achievement_sent && onCelebrationTrigger) {
        console.log('🎊 OnboardingCard 觸發慶典！');
        setTimeout(() => {
          onCelebrationTrigger();
        }, 500);
      }
    }
  }, [progress, onCelebrationTrigger]);

  // 計算完成進度
  const completedCount = Object.values(currentProgress.tasks || {}).filter(
    task => task.completed
  ).length;
  const totalTasks = Object.keys(currentProgress.tasks || {}).length;
  const progressPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  
  // 只在 completedCount 變化時記錄，減少重複日誌
  useEffect(() => {
    console.log('🔍 OnboardingCard 渲染詳情:', {
      tasks: currentProgress.tasks,
      photo_upload_completed: currentProgress.tasks?.photo_upload?.completed,
      mark_consumed_completed: currentProgress.tasks?.mark_consumed?.completed, 
      recipe_view_completed: currentProgress.tasks?.recipe_view?.completed,
      completedCount,
      totalTasks,
      progressPercentage
    });
  }, [completedCount]);

  // 任務配置 - 按照邏輯順序排列
  const tasks = [
    {
      key: 'photo_upload',
      icon: '📸',
      doneIcon: '✅',
      title: '拍照入庫',
      description: '使用AI辨識食材',
      step: 1
    },
    {
      key: 'recipe_view',
      icon: '🍳',
      doneIcon: '✅', 
      title: 'AI食譜',
      description: '查看智能推薦',
      step: 2
    },
    {
      key: 'mark_consumed',
      icon: '✅',
      doneIcon: '✅',
      title: '標記用完',
      description: '移出已使用食材',
      step: 3
    }
  ];

  // 檢查是否剛完成所有任務（用於觸發撒花）
  const allCompleted = completedCount === totalTasks;
  const [celebrationShown, setCelebrationShown] = useState(false);
  
  useEffect(() => {
    if (allCompleted && !celebrationShown) {
      setCelebrationShown(true);
      // 3秒後自動關閉撒花效果
      setTimeout(() => {
        setCelebrationShown(false);
      }, 3000);
    }
  }, [allCompleted, celebrationShown]);

  // 如果已完成或不可見，不渲染
  if (!isVisible || currentProgress.is_completed) {
    return null;
  }

  return (
    <Card className="onboarding-card">
      {/* 撒花特效 - 只在完成所有任務時顯示 */}
      {allCompleted && celebrationShown && <Confetti />}
      
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

      {/* 任務區域 - 使用 SVG 圓環設計 */}
      <div className="tasks-container">
        <Space size="large" className="tasks-row">
          {tasks.map((task) => {
            const isCompleted = currentProgress.tasks[task.key]?.completed || false;
            return (
              <div key={task.key} className="task-item">
                <div className="task-ring-wrapper">
                  <ProgressRing completed={isCompleted} />
                  <span className="task-icon-overlay">
                    {isCompleted ? task.doneIcon : task.icon}
                  </span>
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

      {/* 進度統計文字 */}
      <div className="progress-section">
        <Text className="progress-text">
          已完成 {completedCount} / {totalTasks} 項任務
          {allCompleted && <span className="completion-badge"> 🎊 全部完成！</span>}
        </Text>
      </div>
      
      {/* 完成慶祝訊息 */}
      {allCompleted && (
        <div className="celebration-message">
          <Text strong style={{ color: '#52c41a' }}>🏆 恭喜完成新手三部曲！解鎖所有功能</Text>
        </div>
      )}
    </Card>
  );
};

export default OnboardingCard;