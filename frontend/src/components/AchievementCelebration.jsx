/**
 * 成就慶典組件
 * 
 * 顯示 confetti 動畫和欣梅爾台詞的慶典效果
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Typography, Button, Space } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import './AchievementCelebration.css';

const { Title, Text } = Typography;

const AchievementCelebration = ({ 
  visible, 
  onClose, 
  onConfirm 
}) => {
  const confettiRef = useRef(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (visible) {
      // 播放慶祝音效
      playSuccessSound();
      
      // 啟動 confetti 動畫
      startConfetti();
      
      // 3秒後自動停止 confetti
      const timer = setTimeout(() => {
        stopConfetti();
      }, 3000);

      // 10秒後顯示引導提示
      const guideTimer = setTimeout(() => {
        setShowGuide(true);
      }, 10000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(guideTimer);
      };
    } else {
      setShowGuide(false);
    }
  }, [visible]);

  const playSuccessSound = () => {
    try {
      // 使用 Web Audio API 創建成功音效
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 創建一系列音符來模擬成功音效
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        }, index * 100);
      });
    } catch (error) {
      console.log('音效播放失敗（可忽略）:', error);
    }
  };

  const startConfetti = () => {
    // 簡單的 CSS 動畫 confetti
    const confettiCount = 50;
    const colors = ['#ffd700', '#ffeb3b', '#4caf50', '#2196f3', '#ff9800'];
    
    for (let i = 0; i < confettiCount; i++) {
      setTimeout(() => {
        createConfettiParticle(colors[i % colors.length]);
      }, i * 20);
    }
  };

  const createConfettiParticle = (color) => {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    particle.style.backgroundColor = color;
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 0.5 + 's';
    particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
    
    if (confettiRef.current) {
      confettiRef.current.appendChild(particle);
      
      // 動畫結束後移除粒子
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 5000);
    }
  };

  const stopConfetti = () => {
    if (confettiRef.current) {
      confettiRef.current.innerHTML = '';
    }
  };

  const handleConfirm = () => {
    console.log('🎯 慶典按鈕被點擊');
    stopConfetti();
    
    // 執行父元件的回調函數來關閉新手卡
    if (onConfirm) {
      onConfirm();
    }
    
    // 關閉慶典彈窗
    onClose();
  };

  return (
    <>
      {/* Confetti 容器 */}
      <div 
        ref={confettiRef} 
        className={`confetti-container ${visible ? 'active' : ''}`}
      />
      
      {/* 慶典彈窗 */}
      <Modal
        open={visible}
        footer={null}
        closable={false}
        centered
        className="celebration-modal"
        styles={{ mask: { backgroundColor: 'rgba(255, 255, 255, 0.8)' } }}
      >
        <div className="celebration-content">
          {/* 獎盃圖示 */}
          <div className="trophy-container">
            <TrophyOutlined className="trophy-icon" />
          </div>
          
          {/* 標題 */}
          <Title level={2} className="celebration-title">
            🎊 恭喜完成新手三部曲！
          </Title>
          
          {/* 欣梅爾台詞 */}
          <div className="quote-container">
            <Text className="quote-text">
              "如果是勇者欣梅爾的話一定會繼續這麼做的"
            </Text>
          </div>
          
          {/* 成就說明 */}
          <div className="achievement-info">
            <Space direction="vertical" align="center">
              <Text className="achievement-text">
                🏆 你已經解鎖達人模式！
              </Text>
              <Text className="achievement-text">
                ✨ 從今天起，你就是食材管理大師
              </Text>
            </Space>
          </div>
          
          {/* 確認按鈕 */}
          <div className="celebration-actions">
            <Button 
              type="primary"
              size="large"
              className="celebration-button"
              onClick={handleConfirm}
            >
              🏆 恭喜完成！請繼續探索新功能
            </Button>
          </div>

          {/* 10秒後顯示的引導提示 */}
          {showGuide && (
            <div className="close-guide">
              <div className="guide-arrow">↗️</div>
              <Text className="guide-text">點擊右上角 ✖️ 關閉新手卡片</Text>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default AchievementCelebration;