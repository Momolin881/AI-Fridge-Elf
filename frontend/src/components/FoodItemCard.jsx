/**
 * FoodItemCard 元件
 *
 * 顯示單一食材的卡片元件，包含圖片、名稱、效期等資訊。
 * 支援點擊查看詳情和快速操作（編輯、刪除）。
 */

import { Card, Tag, Button, Space, Image } from 'antd';
import { EditOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

const FoodItemCard = ({
  item,
  onEdit,
  onDelete,
  onClick,
  showActions = true,
}) => {
  // 計算剩餘天數
  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    return diff;
  };

  // 獲取效期標籤顏色
  const getExpiryTagColor = (daysRemaining) => {
    if (daysRemaining === null) return 'default';
    if (daysRemaining < 0) return 'error'; // 已過期
    if (daysRemaining <= 3) return 'warning'; // 即將過期
    return 'success'; // 正常
  };

  // 獲取效期文字
  const getExpiryText = (daysRemaining) => {
    if (daysRemaining === null) return '無效期';
    if (daysRemaining < 0) return `已過期 ${Math.abs(daysRemaining)} 天`;
    if (daysRemaining === 0) return '今天到期';
    if (daysRemaining === 1) return '明天到期';
    return `剩餘 ${daysRemaining} 天`;
  };

  const daysRemaining = getDaysRemaining(item.expiry_date);
  const expiryTagColor = getExpiryTagColor(daysRemaining);
  const expiryText = getExpiryText(daysRemaining);

  return (
    <Card
      hoverable
      onClick={onClick}
      cover={
        item.image_url ? (
          <Image
            alt={item.name}
            src={item.image_url}
            style={{ height: 200, objectFit: 'cover' }}
            preview={false}
          />
        ) : (
          <div
            style={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              color: '#999',
            }}
          >
            無圖片
          </div>
        )
      }
      actions={
        showActions
          ? [
              <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); onEdit?.(item); }} />,
              <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); onDelete?.(item); }} />,
            ]
          : undefined
      }
    >
      <Card.Meta
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{item.name}</span>
            {item.quantity && (
              <Tag color="blue">x{item.quantity}</Tag>
            )}
          </div>
        }
        description={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {/* 儲存類型標籤 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {item.storage_type && (
                <Tag
                  color={item.storage_type === '冷凍' ? 'blue' : 'cyan'}
                  icon={item.storage_type === '冷凍' ? '❄️' : '🧊'}
                >
                  {item.storage_type === '冷凍' ? '❄️ 冷凍' : '🧊 冷藏'}
                </Tag>
              )}
              {item.compartment && (
                <Tag color="purple">{item.compartment}</Tag>
              )}
            </div>

            {item.expiry_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ClockCircleOutlined />
                <Tag color={expiryTagColor}>{expiryText}</Tag>
              </div>
            )}

            {item.price && (
              <div>價格: NT$ {item.price}</div>
            )}

            {item.volume_liters && (
              <div>體積: {item.volume_liters} L</div>
            )}
          </Space>
        }
      />
    </Card>
  );
};

FoodItemCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    quantity: PropTypes.number,
    expiry_date: PropTypes.string,
    storage_type: PropTypes.string,
    compartment: PropTypes.string,
    price: PropTypes.number,
    volume_liters: PropTypes.number,
    image_url: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onClick: PropTypes.func,
  showActions: PropTypes.bool,
};

export default FoodItemCard;
