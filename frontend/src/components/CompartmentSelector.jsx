/**
 * CompartmentSelector 元件
 *
 * 冰箱分區選擇器元件，支援簡單模式（冷藏/冷凍）和細分模式（自訂區域）。
 * 根據使用者設定自動切換模式。
 */

import { Select, Radio, Space, Tag } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Option } = Select;

// 預設簡單模式選項
const SIMPLE_COMPARTMENTS = [
  { value: '冷藏', label: '🧊 冷藏', color: 'blue' },
  { value: '冷凍', label: '❄️ 冷凍', color: 'cyan' },
];

const CompartmentSelector = ({
  value,
  onChange,
  mode = 'simple', // 'simple' | 'detailed'
  customCompartments = [], // 細分模式的自訂區域
  disabled = false,
  style = {},
}) => {
  // 簡單模式：使用 Radio 按鈕
  if (mode === 'simple') {
    return (
      <Radio.Group
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        style={style}
      >
        <Space direction="vertical">
          {SIMPLE_COMPARTMENTS.map((compartment) => (
            <Radio key={compartment.value} value={compartment.value}>
              <Tag color={compartment.color}>{compartment.label}</Tag>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    );
  }

  // 細分模式：使用 Select 下拉選單
  const detailedOptions = customCompartments.length > 0
    ? customCompartments
    : [
        // 預設細分選項（3 分區）
        { value: '冷藏上層', label: '冷藏上層', parent: '冷藏' },
        { value: '冷藏下層', label: '冷藏下層', parent: '冷藏' },
        { value: '冷凍', label: '冷凍', parent: '冷凍' },
      ];

  // 按父類別分組（冷藏 vs 冷凍）
  const groupedOptions = detailedOptions.reduce((acc, option) => {
    const parent = option.parent || '其他';
    if (!acc[parent]) {
      acc[parent] = [];
    }
    acc[parent].push(option);
    return acc;
  }, {});

  // 固定順序：冷藏在前，冷凍在後
  const orderedGroups = ['冷藏', '冷凍', '其他'].filter((g) => groupedOptions[g]);

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="選擇冰箱區域"
      style={{ width: '100%', ...style }}
      suffixIcon={<FolderOutlined />}
    >
      {orderedGroups.map((parent) => (
        <Select.OptGroup key={parent} label={parent === '冷藏' ? '🧊 冷藏' : parent === '冷凍' ? '❄️ 冷凍' : parent}>
          {groupedOptions[parent].map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select.OptGroup>
      ))}
    </Select>
  );
};

CompartmentSelector.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  mode: PropTypes.oneOf(['simple', 'detailed']),
  customCompartments: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      parent: PropTypes.string,
    })
  ),
  disabled: PropTypes.bool,
  style: PropTypes.object,
};

export default CompartmentSelector;
