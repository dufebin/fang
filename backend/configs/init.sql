-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(64) NOT NULL UNIQUE COMMENT '微信openid',
    unionid VARCHAR(64) DEFAULT '' COMMENT '微信unionid',
    nickname VARCHAR(64) NOT NULL DEFAULT '' COMMENT '微信昵称',
    avatar_url VARCHAR(512) DEFAULT '' COMMENT '头像',
    role ENUM('admin', 'agent', 'user') NOT NULL DEFAULT 'user' COMMENT '角色',
    phone VARCHAR(20) DEFAULT '' COMMENT '手机号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 销售员表
CREATE TABLE IF NOT EXISTS agents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL COMMENT '关联用户ID',
    name VARCHAR(50) NOT NULL COMMENT '销售员姓名',
    phone VARCHAR(20) NOT NULL COMMENT '联系电话',
    wechat_id VARCHAR(64) DEFAULT '' COMMENT '微信号',
    wechat_qr_url VARCHAR(512) DEFAULT '' COMMENT '微信二维码图片URL',
    avatar_url VARCHAR(512) DEFAULT '' COMMENT '头像URL',
    bio VARCHAR(200) DEFAULT '' COMMENT '个人简介',
    agent_code VARCHAR(10) NOT NULL UNIQUE COMMENT '销售员短码（分享链接用）',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' COMMENT '状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_agent_code (agent_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售员表';

-- 房源表
CREATE TABLE IF NOT EXISTS properties (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL COMMENT '标题',
    property_type ENUM('新房', '二手房', '租房', '商铺') NOT NULL DEFAULT '二手房' COMMENT '房源类型',
    city VARCHAR(30) NOT NULL DEFAULT '' COMMENT '城市',
    district VARCHAR(50) NOT NULL DEFAULT '' COMMENT '区域',
    address VARCHAR(200) NOT NULL DEFAULT '' COMMENT '详细地址',
    total_price DECIMAL(12,2) DEFAULT NULL COMMENT '总价（万元）',
    unit_price DECIMAL(10,2) DEFAULT NULL COMMENT '单价（元/㎡）',
    monthly_rent DECIMAL(10,2) DEFAULT NULL COMMENT '月租金（元，租房用）',
    area DECIMAL(8,2) NOT NULL DEFAULT 0 COMMENT '建筑面积（㎡）',
    bedrooms TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '卧室数',
    living_rooms TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '客厅数',
    bathrooms TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '卫生间数',
    floor SMALLINT DEFAULT NULL COMMENT '所在楼层',
    total_floors SMALLINT DEFAULT NULL COMMENT '总楼层',
    decoration ENUM('毛坯', '简装', '精装', '豪华装修') DEFAULT '精装' COMMENT '装修情况',
    direction VARCHAR(20) DEFAULT '' COMMENT '朝向',
    description TEXT COMMENT '详细描述',
    cover_image VARCHAR(512) DEFAULT '' COMMENT '封面图',
    status ENUM('available', 'sold', 'rented', 'offline') NOT NULL DEFAULT 'available' COMMENT '状态',
    view_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '浏览次数',
    created_by BIGINT UNSIGNED NOT NULL COMMENT '录入人user_id',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_type (property_type),
    INDEX idx_district (district),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房源表';

-- 房源图片表
CREATE TABLE IF NOT EXISTS property_images (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL COMMENT '房源ID',
    url VARCHAR(512) NOT NULL COMMENT '图片URL',
    sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_property_id (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房源图片表';

-- 销售员认领关系表（核心表）
CREATE TABLE IF NOT EXISTS agent_properties (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT UNSIGNED NOT NULL COMMENT '销售员ID',
    property_id BIGINT UNSIGNED NOT NULL COMMENT '房源ID',
    claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '认领时间',
    UNIQUE KEY uk_agent_property (agent_id, property_id),
    INDEX idx_property_id (property_id),
    INDEX idx_agent_id (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售员认领关系表';

-- 浏览记录表
CREATE TABLE IF NOT EXISTS property_views (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL COMMENT '房源ID',
    agent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '销售员ID（通过分享链接打开时）',
    viewer_openid VARCHAR(64) DEFAULT '' COMMENT '浏览者openid',
    ip VARCHAR(50) DEFAULT '' COMMENT 'IP地址',
    viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_property_id (property_id),
    INDEX idx_agent_id (agent_id),
    INDEX idx_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='浏览记录表';

-- 初始化管理员账号（实际使用时通过程序创建）
-- 默认admin账号需要通过微信openid绑定
