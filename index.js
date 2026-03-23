const { Plugin } = require("siyuan");
let fs, path;
try {
  fs = require("fs");
  path = require("path");
} catch (e) {
  // Node.js 模块加载失败，将使用浏览器兼容模式
  fs = null;
  path = null;
}
const os = require("os");

// 思源笔记文件操作 API（兼容移动端）
const siyuanFS = {
  // 读取文件
  async readFile(filePath) {
    try {
      // 方案 1: 使用 fs 模块（PC 端）
      if (fs) {
        return fs.readFileSync(filePath, "utf8");
      }
      
      // 方案 2: 使用思源 API（移动端）
      // 注意：思源 API 需要使用完整路径
      if (window.siyuan && window.siyuan.api) {
        const response = await fetch('/api/file/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath })
        });
        const result = await response.json();
        if (result.code === 0) {
          return result.data.content;
        }
      }
      
      throw new Error('无法读取文件');
    } catch (e) {
      return null;
    }
  },
  
  // 写入文件
  async writeFile(filePath, content) {
    try {
      // 方案 1: 使用 fs 模块（PC 端）
      if (fs) {
        fs.writeFileSync(filePath, content, "utf8");
        return true;
      }
      
      // 方案 2: 使用思源 API（移动端）
      // 尝试多种 API 格式
      if (window.siyuan && window.siyuan.api) {
        // 尝试 1: putFile API
        let response = await fetch('/api/file/put', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: filePath,
            data: content
          })
        });
        let result = await response.json();
        if (result.code === 0) {
          return true;
        }
        
        // 尝试 2: writeFile API
        response = await fetch('/api/file/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: filePath,
            data: content,
            mode: 'w'
          })
        });
        result = await response.json();
        if (result.code === 0) {
          return true;
        }
      }
      
      throw new Error('无法写入文件：思源 API 不可用或无权限');
    } catch (e) {
      return false;
    }
  },
  
  // 检查文件是否存在
  async exists(filePath) {
    try {
      // 方案 1: 使用 fs 模块（PC 端）
      if (fs) {
        return fs.existsSync(filePath);
      }
      
      // 方案 2: 尝试通过思源 API 读取
      if (window.siyuan && window.siyuan.api) {
        const response = await fetch('/api/file/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath })
        });
        const result = await response.json();
        return result.code === 0;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  },
  
  // 创建目录
  async mkdir(dirPath) {
    try {
      // 方案 1: 使用 fs 模块（PC 端）
      if (fs) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
      }
      
      // 方案 2: 使用思源 API（移动端）
      if (window.siyuan && window.siyuan.api) {
        const response = await fetch('/api/file/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: dirPath })
        });
        const result = await response.json();
        return result.code === 0;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }
};

let pluginInstance = null;
let buttonConfig = [];
let panelConfig = {
  pc: { width: 140, height: "auto", fontSize: 14 },
  mobile: { width: 300, height: "auto", fontSize: 14 }
};
let activeConfigTab = "pc"; // 当前激活的配置端
let customIcons = []; // 自定义图标缓存
let editBtnIndex = -1; // 当前编辑的按钮索引（-1表示新增）

// ===================== 核心修复1：增强移动端检测 =====================
// 更精准的移动端检测（支持思源内置移动端判断）
const isMobile = () => {
  // 优先使用思源内置的移动端判断
  if (window?.siyuan?.config?.system?.isMobile) {
    return true;
  }
  // 备用检测方案
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /mobile|android|iphone|ipad|ipod|ios|windows phone|blackberry|webos|opera mini|iemobile|mobile safari|huawei|xiaomi|oppo|vivo|meizu/i.test(userAgent);
  const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 768;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return isMobileUA || (isSmallScreen && isTouchDevice);
};

// 思源完整分类Emoji库
const siyuanFullEmojis = {
  "笑脸和人类": [
    "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊",
    "😋", "😎", "😍", "😘", "🥰", "😗", "😙", "😚", "🙂", "🤗",
    "🤩", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😣", "😥",
    "😮", "🤐", "😯", "😪", "😫", "🥱", "😴", "😌", "😛", "😜",
    "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲", "☹️",
    "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨"
  ],
  "动物和自然": [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒",
    "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇",
    "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐚", "🐞",
    "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙"
  ],
  "食物和饮料": [
    "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
    "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑",
    "🥦", "🥬", "🥒", "🌶️", "🫑", "🧄", "🧅", "🥔", "🥕", "🌽",
    "🌾", "🫘", "🥜", "🫐", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯",
    "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕"
  ],
  "活动": [
    "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🎱", "🏓",
    "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳", "🏹", "🎣", "🥊",
    "🥋", "🥿", "🎽", "🛼", "🛹", "🛶", "🚣‍♂️", "🏊‍♂️", "🤽‍♂️", "🏄‍♂️",
    "🏌️‍♂️", "🚴‍♂️", "🚵‍♂️", "🏎️", "🏇", "🧘‍♂️", "🧗‍♂️", "🚶‍♂️", "🧍‍♂️", "🧎‍♂️"
  ],
  "旅行和地点": [
    "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐",
    "🚚", "🚛", "🚜", "🛵", "🏍️", "🚲", "🛺", "🚡", "🚠", "🚟",
    "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇",
    "🚊", "🚉", "✈️", "🛫", "🛬", "🚀", "🛸", "🚁", "🛶", "⛵",
    "🚤", "🛥️", "🚢", "⛴️", "🗺️", "🗿", "🗼", "🏰", "🏯", "🏟️"
  ],
  "物品": [
    "⌚", "📱", "📲", "💻", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️",
    "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️",
    "🎞️", "🔍", "🔎", "🕯️", "🪔", "📔", "📕", "📖", "📗", "📘",
    "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "🗞️", "📑"
  ],
  "符号": [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "⭐",
    "🌟", "✨", "⚡", "🔥", "💥", "💫", "💦", "💨", "🕳️", "💣",
    "💬", "💭", "🗨️", "🗯️", "♠️", "♥️", "♦️", "♣️", "♨️", "◼️"
  ],
  "思源功能图标": [
    "📝", "⚡", "📊", "📁", "🔍", "✏️", "💾", "📤", "📥", "🔗",
    "✅", "❌", "⚠️", "ℹ️", "🔥", "💡", "🎯", "📈", "📉", "🔧",
    "⚙️", "🗑️", "↩️", "↪️", "🔄", "⏩", "⏪", "🔀", "📌", "📍"
  ]
};

// 示例文本
const exampleTexts = {
  selector: "例: 菜单1|菜单2|最终按钮（|分隔多级）",
  document: "例: 20240320150000-123456（文档ID）",
  block: "例: 20240320150000-123456（块ID）"
};

class FangcunToolbox extends Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    pluginInstance = this;
    this.app = app;
    this.initTimer = null;
    // 插件目录配置（核心：将数据保存在插件目录下）
    this.pluginDir = this.getPluginDir(manifest);
    // 使用兼容方式拼接路径（避免 path 模块未定义）
    this.customIconPath = path ? path.join(this.pluginDir, "custom-icons") : `${this.pluginDir}/custom-icons`;
    this.configFilePath = path ? path.join(this.pluginDir, "config.json") : `${this.pluginDir}/config.json`; // 配置文件路径
  }

  // 获取插件目录（兼容移动端）
  getPluginDir(manifest) {
    const pluginName = manifest?.name || "fangcun-toolbox";
    
    // 如果 path 模块可用，使用 Node.js 路径处理
    if (path) {
      // 方案 1: 使用 app.config.dataDir（PC 端优先）
      if (this.app?.config?.dataDir) {
        return path.join(this.app.config.dataDir, "plugins", pluginName);
      }
      // 方案 2: 使用 window.siyuan.config.dataDir（备用）
      if (window?.siyuan?.config?.dataDir) {
        return path.join(window.siyuan.config.dataDir, "plugins", pluginName);
      }
      // 方案 3: 降级到相对路径
      return path.join("./data/plugins", pluginName);
    }
    
    // path 模块不可用时，使用字符串拼接（移动端浏览器兼容）
    // 方案 1: 使用 app.config.dataDir
    if (this.app?.config?.dataDir) {
      // 确保路径分隔符统一为 / （思源 API 要求）
      const dataDir = this.app.config.dataDir.replace(/\\/g, '/');
      return `${dataDir}/plugins/${pluginName}`;
    }
    // 方案 2: 使用 window.siyuan.config.dataDir
    if (window?.siyuan?.config?.dataDir) {
      const dataDir = window.siyuan.config.dataDir.replace(/\\/g, '/');
      return `${dataDir}/plugins/${pluginName}`;
    }
    // 方案 3: 降级到相对路径
    return `./data/plugins/${pluginName}`;
  }

  async onload() {
    try {
      // 新增：提前检查 app 是否初始化
      if (!this.app) {
        setTimeout(() => this.onload(), 1000);
        return;
      }
          
      // 输出调试信息
      // 插件启动信息
      const dataDir = this.app?.config?.dataDir || window.siyuan?.config?.dataDir;
          
      // 确保插件目录存在（异步调用）
      await this.ensureDirExists(this.pluginDir);
      await this.ensureDirExists(this.customIconPath);
          
      // 核心修复：从插件目录加载配置（异步调用）
      const savedConfig = await this.loadConfigFromFile();
        
      if (savedConfig) {
        // 兼容旧配置格式
        let loadedButtons = savedConfig.buttons || savedConfig.button_config?.buttons || [];
          
        // 如果加载的按钮没有 targetTab 字段，说明是旧配置，需要同时创建 PC 和移动端版本
        const hasTargetTab = loadedButtons.some(btn => btn.targetTab);
          
        if (!hasTargetTab && loadedButtons.length > 0) {
          // 旧配置：为每个按钮创建 PC 和移动端两个版本
          // 为每个按钮创建双端版本（PC 端和移动端）
          const pcButtons = loadedButtons.map(btn => ({ ...btn, targetTab: "pc" }));
          const mobileButtons = loadedButtons.map(btn => ({ ...btn, targetTab: "mobile" }));
          buttonConfig = [...pcButtons, ...mobileButtons];
        } else if (loadedButtons.length > 0) {
          // 新配置：检查是否同时有 PC 和移动端按钮
          const hasPcButtons = loadedButtons.some(btn => btn.targetTab === "pc");
          const hasMobileButtons = loadedButtons.some(btn => btn.targetTab === "mobile");
            
          // 如果只有一边有按钮，复制另一边
          if (hasPcButtons && !hasMobileButtons) {
            const pcBtns = loadedButtons.filter(btn => btn.targetTab === "pc");
            const mobileBtns = pcBtns.map(btn => ({ ...btn, targetTab: "mobile" }));
            buttonConfig = [...loadedButtons, ...mobileBtns];
          } else if (!hasPcButtons && hasMobileButtons) {
            const mobileBtns = loadedButtons.filter(btn => btn.targetTab === "mobile");
            const pcBtns = mobileBtns.map(btn => ({ ...btn, targetTab: "pc" }));
            buttonConfig = [...loadedButtons, ...pcBtns];
          } else {
            buttonConfig = loadedButtons;
          }
        } else {
          // 空配置，使用默认值
          buttonConfig = [];
        }
          
        panelConfig = savedConfig.panel_config || savedConfig.panelConfig || {
          pc: { width: 140, height: "auto", fontSize: 14 },
          mobile: { width: 300, height: "auto", fontSize: 14 }
        };
      } else {
        // 默认配置（同时创建 PC 和移动端按钮）
        buttonConfig = [
          // PC 端默认按钮
          {
            name: "命令面板",
            emoji: "⚡",
            type: "selector",
            value: ".b3-menu-item[title*='命令面板']",
            bgColor: "#e8f4ff",
            color: "#1377EB",
            sort: 0,
            targetTab: "pc",
            displayMode: "both",
            isCustomIcon: false,
            customIconPath: ""
          },
          // 移动端默认按钮（强制添加）
          {
            name: "命令面板",
            emoji: "⚡",
            type: "selector",
            value: ".b3-menu-item[title*='命令面板']",
            bgColor: "#e8f4ff",
            color: "#1377EB",
            sort: 0,
            targetTab: "mobile",
            displayMode: "both",
            isCustomIcon: false,
            customIconPath: ""
          }
        ];
        // 立即保存默认配置
        this.saveConfigToFile({
          buttons: buttonConfig,
          panelConfig: panelConfig
        });
      }
        
      // 兼容旧配置，补全缺失字段（但不修改 targetTab）
      buttonConfig = buttonConfig.map(btn => ({
        name: btn.name || "未命名按钮",
        emoji: btn.emoji || "⚡",
        type: btn.type || "selector",
        value: btn.value || "",
        bgColor: this.formatColor(btn.bgColor || "#f8f9fa"),
        color: this.formatColor(btn.color || "#333333"),
        sort: typeof btn.sort === "number" ? btn.sort : 0,
        targetTab: btn.targetTab, // 保持原有的 targetTab，不覆盖
        displayMode: btn.displayMode || "both",
        isCustomIcon: btn.isCustomIcon || false,
        customIconPath: btn.customIconPath || ""
      }));
        
      // 加载自定义图标（异步调用）
      await this.loadCustomIcons();
              
      // 根据配置决定是否启用悬浮按钮
      const enabled = savedConfig?.enabled ?? true; // 如果没有 enabled 字段，默认为 true
            
      // 重要：将 loaded config 保存到 this.config，确保后续保存时包含所有字段
      this.config = {
        enabled: enabled,
        buttons: buttonConfig,
        panel_config: panelConfig
      };
            
      if (enabled) {
        // 创建悬浮按钮
        this.createFloatButton(true);
                
        // 强制刷新按钮
        setTimeout(() => {
          this.rebuildFloatButton(true);
        }, 100);
      }
    } catch (e) {
      // 强制创建移动端按钮
      buttonConfig = [
        {
          name: "命令面板",
          emoji: "⚡",
          type: "selector",
          value: ".b3-menu-item[title*='命令面板']",
          bgColor: "#e8f4ff",
          color: "#1377EB",
          sort: 0,
          targetTab: "pc",
          displayMode: "both",
          isCustomIcon: false,
          customIconPath: ""
        },
        {
          name: "命令面板",
          emoji: "⚡",
          type: "selector",
          value: ".b3-menu-item[title*='命令面板']",
          bgColor: "#e8f4ff",
          color: "#1377EB",
          sort: 0,
          targetTab: "mobile",
          displayMode: "both",
          isCustomIcon: false,
          customIconPath: ""
        }
      ];
      this.saveConfigToFile({
        buttons: buttonConfig,
        panelConfig: panelConfig
      });
      this.rebuildFloatButton(true);
    }
  }

  // 确保目录存在（递归创建）
  async ensureDirExists(dirPath) {
    try {
      const exists = await siyuanFS.exists(dirPath);
      if (!exists) {
        await siyuanFS.mkdir(dirPath);
      }
    } catch (e) {
      // 静默失败
    }
  }

  // 从插件目录加载配置文件 - 核心修复：使用思源自带的持久化 API
  async loadConfigFromFile() {
    try {
      // 方案 1: 使用思源插件的 loadData 方法（自动处理跨平台存储）
      const savedConfig = await this.loadData("config");
      if (savedConfig) {
        return savedConfig;
      }
      
      // 方案 2: 降级方案：从 localStorage 加载
      const backup = localStorage.getItem("fc_config_backup");
      if (backup) {
        return JSON.parse(backup);
      }
      
      return null;
      
    } catch (e) {
      return null;
    }
  }

  // 保存配置到插件目录 - 核心修复：使用思源自带的持久化 API
  async saveConfigToFile(data) {
    try {
      // 使用思源插件的 saveData 方法（自动处理跨平台存储）
      await this.saveData("config", data);
      return true;
    } catch (e) {
      // 降级方案：保存到 localStorage
      localStorage.setItem("fc_config_backup", JSON.stringify(data));
      return false;
    }
  }

  // 加载自定义图标
  async loadCustomIcons() {
    try {
      customIcons = [];
      if (!await siyuanFS.exists(this.customIconPath)) {
        return;
      }
      
      // 注意：readdirSync 在移动端可能不可用，暂时保留 fs 检查
      if (fs && path) {
        const files = fs.readdirSync(this.customIconPath);
        files.forEach(file => {
          const ext = path.extname(file).toLowerCase();
          if ([".jpg", ".jpeg", ".png", ".svg", ".gif"].includes(ext)) {
            const fullPath = path.join(this.customIconPath, file);
            const relativePath = `plugins/${this.manifest?.name || "fangcun-toolbox"}/custom-icons/${file}`;
            customIcons.push({
              name: file,
              path: fullPath,
              relativePath: relativePath
            });
          }
        });
      }
    } catch (e) {
      // 静默失败
    }
  }

  async onunload() {
    if (this.initTimer) clearTimeout(this.initTimer);
    document.getElementById("fc-btn")?.remove();
    document.getElementById("fc-panel")?.remove();
    document.getElementById("fc-settings-mask")?.remove();
  }

  // 颜色格式化
  formatColor(color) {
    if (!color) return "#333333";
    if (color.match(/^#[0-9a-fA-F]{3}$/)) {
      const r = color[1], g = color[2], b = color[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (color.match(/^#[0-9a-fA-F]{6}$/)) return color;
    return "#333333";
  }

  rebuildFloatButton(forceMobile = false) {
    document.getElementById("fc-btn")?.remove();
    document.getElementById("fc-panel")?.remove();
    this.createFloatButton(forceMobile);
  }

  // ===================== 核心修复1：重写移动端按钮创建逻辑 =====================
  createFloatButton(forceMobile = false) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    
    const currentIsMobile = forceMobile || isMobile();
    // 强制显示所有按钮，不再过滤
    const targetButtons = buttonConfig.filter(btn => {
      return currentIsMobile ? btn.targetTab === "mobile" : btn.targetTab === "pc";
    });

    const oldBtn = document.getElementById("fc-btn");
    if (oldBtn) oldBtn.remove();

    // 创建主悬浮按钮（完全重构移动端样式）
    const btn = document.createElement("div");
    btn.id = "fc-btn";
    btn.innerHTML = "+";
    btn.setAttribute("data-mobile", currentIsMobile ? "true" : "false");
    
    // ===================== 核心修复 1：移动端按钮强制显示样式 =====================
    const btnStyle = currentIsMobile ? `
      bottom: 100px !important;
      right: 40px !important;
      width: 60px !important;  /* 更大的移动端按钮 */
      height: 60px !important;
      font-size: 28px !important;
      z-index: 999999999 !important; /* 最高层级 */
      opacity: 1 !important; 
      visibility: visible !important;
      pointer-events: auto !important;
      display: flex !important;
    ` : `
      bottom: 120px !important;
      right: 100px !important;
      width: 50px !important;
      height: 50px !important;
      font-size: 20px !important;
    `;

    btn.style.cssText = `
      position: fixed !important;
      ${btnStyle}
      border-radius: 50% !important;
      background: #1377EB !important;
      color: white !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      z-index: 999999999 !important;
      pointer-events: auto !important;
      box-shadow: 0 6px 16px rgba(0,0,0,.2) !important;
      user-select: none !important;
      touch-action: none !important;
      border: none !important;
      outline: none !important;
      transform: translateZ(0) !important;
      backface-visibility: hidden !important;
      perspective: 1000 !important;
      transition: all 0.2s ease !important;
      opacity: 1 !important;
      visibility: visible !important;
    `;

    // ===================== 核心修复1：强制添加到body最前面 =====================
    setTimeout(() => {
      if (document.body.firstChild) {
        document.body.insertBefore(btn, document.body.firstChild);
      } else {
        document.body.appendChild(btn);
      }
      // 强制显示
      btn.style.display = "flex";
      btn.style.opacity = "1";
      btn.style.visibility = "visible";
      
      // 移动端额外强制显示
      if (currentIsMobile) {
        btn.style.position = "fixed";
        btn.style.display = "flex !important";
        btn.style.opacity = "1 !important";
      }
    }, 0);

    // 拖拽逻辑（优化移动端触摸）
    let isDragging = false;
    let startX, startY;
    let isClick = true;
    const dragThreshold = 8; // 加大拖动距离，需要移动 8px 才触发拖动

    btn.addEventListener("mousedown", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      isDragging = true;
      isClick = true;
      startX = e.clientX;
      startY = e.clientY;
      btn.style.cursor = "grabbing";
    }, { passive: false });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > dragThreshold || dy > dragThreshold) {
        isClick = false;
        const rect = btn.getBoundingClientRect();
        btn.style.left = `${rect.left + (e.clientX - startX)}px`;
        btn.style.top = `${rect.top + (e.clientY - startY)}px`;
        btn.style.bottom = "auto";
        btn.style.right = "auto";
        startX = e.clientX;
        startY = e.clientY;
      }
    }, { passive: true });

    document.addEventListener("mouseup", (e) => {
      if (!isDragging) return;
      isDragging = false;
      btn.style.cursor = "pointer";
      if (isClick) {
        this.togglePanel(btn);
      }
    }, { passive: true });

    // ===================== 核心修复1：增强移动端触摸事件 =====================
    btn.addEventListener("touchstart", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      const touch = e.touches[0];
      isDragging = true;
      isClick = true;
      startX = touch.clientX;
      startY = touch.clientY;
      btn.style.transform = "scale(0.95)"; // 触摸反馈
    }, { passive: false });

    btn.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);
      if (dx > dragThreshold || dy > dragThreshold) {
        isClick = false;
        const rect = btn.getBoundingClientRect();
        btn.style.left = `${rect.left + (touch.clientX - startX)}px`;
        btn.style.top = `${rect.top + (touch.clientY - startY)}px`;
        btn.style.bottom = "auto";
        btn.style.right = "auto";
        startX = touch.clientX;
        startY = touch.clientY;
      }
    }, { passive: false });

    btn.addEventListener("touchend", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      isDragging = false;
      btn.style.transform = "scale(1)"; // 恢复大小
      if (isClick) {
        this.togglePanel(btn);
      }
    }, { passive: false });

    // ===================== 核心修复1：最后兜底 - 强制显示 =====================
    setTimeout(() => {
      if (btn.style.display !== "flex") {
        btn.style.display = "flex";
        btn.style.opacity = "1";
        btn.style.visibility = "visible";
      }
      // 移动端滚动时也保持显示
      window.addEventListener("scroll", () => {
        if (currentIsMobile) {
          btn.style.display = "flex";
          btn.style.opacity = "1";
        }
      }, { passive: true });
    }, 300);
  }

  // 切换面板显示/隐藏
  togglePanel(btn) {
    const currentIsMobile = isMobile();
    const currentPanelConfig = currentIsMobile ? panelConfig.mobile : panelConfig.pc;
    const visibleButtons = buttonConfig.filter(btn => {
      return currentIsMobile ? btn.targetTab === "mobile" : btn.targetTab === "pc";
    }).sort((a, b) => a.sort - b.sort);
    
    let panel = document.getElementById("fc-panel");
    if (panel) {
      if (panel.style.display !== "none") {
        panel.style.opacity = "0";
        setTimeout(() => panel.style.display = "none", 200);
        btn.innerHTML = "+";
        return;
      } else {
        // 面板已存在但隐藏，需要更新位置后再显示
        const btnRect = btn.getBoundingClientRect();
        const panelWidth = currentPanelConfig.width;
        const rightPos = window.innerWidth - (btnRect.right);
        const bottomPos = window.innerHeight - btnRect.top + 10;
        
        panel.style.right = `${rightPos}px`;
        panel.style.bottom = `${bottomPos}px`;
        panel.style.opacity = "1";
        panel.style.display = "flex";
        btn.innerHTML = "−";
        return;
      }
    } else {
      // 创建面板
      panel = document.createElement("div");
      panel.id = "fc-panel";
      
      // 获取悬浮按钮的位置
      const btnRect = btn.getBoundingClientRect();
      const panelWidth = currentPanelConfig.width;
            
      // 计算面板位置：靠在悬浮按钮上方，靠右对齐（面板右侧与按钮右侧对齐）
      // 这样面板不会被按钮遮挡，且视觉更统一
      const rightPos = window.innerWidth - (btnRect.right); // 面板右侧与按钮右侧对齐
      const bottomPos = window.innerHeight - btnRect.top + 10; // 按钮顶部上方 10px
      
      const panelStyle = `
        bottom: ${bottomPos}px !important;
        right: ${rightPos}px !important;
        width: ${panelWidth}px !important;
        max-width: ${currentIsMobile ? 'calc(100% - 40px)' : panelWidth + 'px'} !important;
        z-index: 999999998 !important;
      `;
      
      panel.style.cssText = `
        position: fixed !important;
        ${panelStyle}
        height: ${currentPanelConfig.height} !important;
        max-height: 400px !important;
        background: white !important;
        border-radius: 14px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.15) !important;
        padding: 10px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        z-index: 999999998 !important;
        opacity: 0 !important;
        transition: opacity 0.2s ease !important;
        pointer-events: auto !important;
        overflow-y: auto !important;
      `;
      document.body.appendChild(panel);
    }

    panel.innerHTML = "";

    // 无按钮时显示提示
    if (visibleButtons.length === 0) {
      const emptyTip = document.createElement("div");
      emptyTip.style.cssText = `
        padding: 12px;
        text-align: center;
        color: #999;
        font-size: ${currentPanelConfig.fontSize}px;
      `;
      emptyTip.innerText = "当前无可见按钮，前往设置添加";
      panel.appendChild(emptyTip);
    } else {
      // 渲染按钮列表
      visibleButtons.forEach((cfg) => {
        const btnItem = document.createElement("div");
        btnItem.style.cssText = `
          padding: 9px 12px !important;
          background: ${cfg.bgColor} !important;
          color: ${cfg.color} !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: ${currentPanelConfig.fontSize}px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
        `;
        
        // 图标渲染
        if (cfg.isCustomIcon && cfg.customIconPath) {
          if (cfg.displayMode === "text") {
            btnItem.appendChild(document.createTextNode(cfg.name));
          } else if (cfg.displayMode === "emoji") {
            const iconImg = document.createElement("img");
            iconImg.src = cfg.customIconPath;
            iconImg.style.cssText = "width:24px;height:24px;border-radius:4px;";
            iconImg.alt = "自定义图标";
            btnItem.appendChild(iconImg);
          } else {
            const iconImg = document.createElement("img");
            iconImg.src = cfg.customIconPath;
            iconImg.style.cssText = "width:24px;height:24px;border-radius:4px;";
            iconImg.alt = "自定义图标";
            btnItem.appendChild(iconImg);
            btnItem.appendChild(document.createTextNode(cfg.name));
          }
        } else {
          if (cfg.displayMode === "text") {
            btnItem.appendChild(document.createTextNode(cfg.name));
          } else if (cfg.displayMode === "emoji") {
            const emojiSpan = document.createElement("span");
            emojiSpan.style.cssText = "display: inline-flex; align-items: center; justify-content: center; min-width: 20px;";
            emojiSpan.textContent = cfg.emoji || "⚡";
            btnItem.appendChild(emojiSpan);
          } else {
            const emojiSpan = document.createElement("span");
            emojiSpan.style.cssText = "display: inline-flex; align-items: center; justify-content: center; min-width: 20px;";
            emojiSpan.textContent = cfg.emoji || "⚡";
            btnItem.appendChild(emojiSpan);
            const textNode = document.createTextNode(cfg.name);
            btnItem.appendChild(textNode);
          }
        }
        
        btnItem.onclick = async () => {
          // 先关闭面板和恢复按钮状态
          panel.style.opacity = "0";
          setTimeout(() => {
            panel.style.display = "none";
            btn.innerHTML = "+";
          }, 200);
          
          // 执行按钮动作
          await this.triggerButtonAction(cfg);
        };
        panel.appendChild(btnItem);
      });
    }

    // 设置按钮
    const settingBtn = document.createElement("div");
    settingBtn.style.cssText = `
      padding: 8px !important;
      background: #f1f1f1 !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-size: ${currentPanelConfig.fontSize}px !important;
      text-align: center !important;
      margin-top: 8px !important;
    `;
    settingBtn.innerText = "⚙️ 设置";
    settingBtn.onclick = () => {
      panel.style.display = "none";
      btn.innerHTML = "+";
      this.openSettings();
    };
    panel.appendChild(settingBtn);

    panel.style.display = "flex";
    setTimeout(() => panel.style.opacity = "1", 10);
    btn.innerHTML = "-";
  }

  // 触发按钮动作
  async triggerButtonAction(cfg) {
    try {
      if (!cfg || !cfg.value) {
        this.showToast("配置不完整", "error");
        return;
      }
      const cleanValue = cfg.value.trim();
  
      switch (cfg.type) {
        case "selector":
          await this.execByMultiSelector(cleanValue, cfg.name);
          break;
        case "document":
          await this.openDocByTab(cleanValue, cfg.name);
          break;
        case "block":
          await this.openBlockDirect(cleanValue, cfg.name);
          break;
        default:
          this.showToast(`不支持的类型：${cfg.type}`, "error");
          break;
      }
    } catch (e) {
      this.showToast(`触发失败：${e.message}`, "error");
    }
  }

  // 多级选择器执行
  async execByMultiSelector(selectorStr, btnName) {
    try {
      const selectors = selectorStr.split("|").map(s => s.trim()).filter(s => s);
      if (selectors.length === 0) {
        this.showToast("选择器不能为空", "error");
        return;
      }

      const mainContainer = document.querySelector(".layout__wnd") || document.body;
      mainContainer.focus();

      for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        let target = null;
        let validSelector = selector.replace(/''/g, "'");

        // 快速轮询查找元素
        const maxWaitTime = 1000;
        const startTime = Date.now();
        while (!target && Date.now() - startTime < maxWaitTime) {
          target = document.querySelector(validSelector);
          if (!target) {
            const cleanSelector = validSelector.replace(/\[|]|'|"/g, "");
            target = document.querySelector(`.b3-menu-item[title*='${cleanSelector}']`);
          }
          if (!target) await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (!target) {
          if (validSelector.includes("openCommandPalette")) {
            this.openCommandPaletteByShortcut();
            continue;
          }
          this.showToast(`第${i+1}级未找到: ${validSelector}`, "error");
          return;
        }

        // 触发点击 - 修复移动端选择器问题
        if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
          // 移动端：使用更可靠的方式
          target.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          // 确保元素可见并聚焦
          if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (typeof target.focus === 'function') {
            target.focus();
          }
          
          // 触发点击（如果元素有 click 方法）
          if (typeof target.click === 'function') {
            target.click();
          } else {
            // 否则直接触发点击事件
            target.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            }));
          }
          
          // 触发 mouseup
          target.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          // 额外触发 pointerup 事件（某些移动端需要）
          target.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
        } else {
          // PC 端：直接点击
          if (typeof target.click === 'function') {
            target.click();
          } else {
            // 否则触发点击事件
            target.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            }));
          }
        }

        if (i < selectors.length - 1) {
          // 极短延迟，让点击更连贯（几乎无感知）
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      // 最后再等待一下，确保所有操作完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 智能关闭残留菜单（排除刚打开的命令面板）
      setTimeout(() => {
        const menus = document.querySelectorAll(".b3-menu");
        menus.forEach(menu => {
          // 检查是否是命令面板，如果是则保留
          const isCommandPalette = menu.querySelector('[data-type="command"]');
          if (!isCommandPalette) {
            menu.style.display = "none";
          }
        });
        
        // 关闭展开的面板（如果有）
        const panels = document.querySelectorAll(".layout__wnd--active");
        panels.forEach(panel => {
          panel.classList.remove("layout__wnd--active");
        });
      }, 300);

      this.showToast(`执行成功：${btnName}`, "success");
    } catch (e) {
      this.showToast(`执行失败：${e.message}`, "error");
    }
  }

  // 快捷键打开命令面板
  openCommandPaletteByShortcut() {
    const editor = document.querySelector(".prosemirror-editor") || document.body;
    editor.focus();
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const modifierKey = isMac ? "metaKey" : "ctrlKey";

    const downEvent = new KeyboardEvent("keydown", {
      key: "/", code: "Slash", [modifierKey]: true,
      bubbles: true, cancelable: true, view: window
    });
    editor.dispatchEvent(downEvent);

    setTimeout(() => {
      const upEvent = new KeyboardEvent("keyup", {
        key: "/", code: "Slash", [modifierKey]: false,
        bubbles: true, cancelable: true, view: window
      });
      editor.dispatchEvent(upEvent);
    }, 20);
  }

  // 通过文档ID打开文档
  async openDocByTab(docId, btnName) {
    try {
      if (this.app?.tabs?.openTab) {
        this.app.tabs.openTab({
          app: this.app,
          doc: { id: docId }
        });
        this.showToast(`执行成功: ${btnName}`, "success");
        return;
      }
      if (window.openFileByURL) {
        window.openFileByURL(`siyuan://blocks/${docId}`);
        this.showToast(`执行成功: ${btnName}`, "success");
        return;
      }
      window.location.hash = `#/d/${docId}`;
      this.showToast(`执行成功：${btnName}`, "success");
    } catch (e) {
      this.showToast(`打开失败`, "error");
    }
  }

  // 通过块ID打开块
  async openBlockDirect(blockId, btnName) {
    try {
      if (window.openFileByURL) {
        window.openFileByURL(`siyuan://blocks/${blockId}`);
        this.showToast(`执行成功: ${btnName}`, "success");
        return;
      }
      if (this.app?.tabs?.openTab) {
        this.app.tabs.openTab({
          app: this.app,
          doc: { id: blockId, action: ["cb-get-focus", "cb-get-hl"] }
        });
        this.showToast(`执行成功: ${btnName}`, "success");
        return;
      }
      window.location.hash = `#/b/${blockId}`;
      this.showToast(`执行成功：${btnName}`, "success");
    } catch (e) {
      this.showToast(`打开失败`, "error");
    }
  }

  // 提示框
  showToast(msg, type = "success") {
    if (typeof window.siyuan?.notification?.showToast === 'function') {
      window.siyuan.notification.showToast(msg, type);
      return;
    }
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      padding: 8px 16px !important;
      background: ${type === "success" ? "#52c41a" : "#ff4d4f"} !important;
      color: white !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      z-index: 999999999 !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease !important;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = "1", 10);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  async onDisable() {
    document.getElementById("fc-btn")?.remove();
    document.getElementById("fc-panel")?.remove();
    document.getElementById("fc-settings-mask")?.remove();
    return true;
  }

  // ===================== 核心修复2&3：重写设置界面 =====================
  openSettings() {
    activeConfigTab = "pc";
    editBtnIndex = -1;
    
    document.getElementById("fc-settings-mask")?.remove();
    const mask = document.createElement("div");
    mask.id = "fc-settings-mask";
    mask.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      background: rgba(0,0,0,.35) !important;
      z-index: 999999997 !important;
      display: flex !important;
      align-items: flex-start !important; /* 改为顶部对齐 */
      justify-content: center !important;
      padding-top: 20px !important; /* 顶部内边距 */
      overflow-y: auto !important; /* 允许滚动 */
    `;
    
    const settings = document.createElement("div");
    const isMobileDevice = window.innerWidth < 768;
    settings.style.cssText = `
      width: ${isMobileDevice ? "95%" : "800px"} !important;
      background: white !important;
      border-radius: 16px !important;
      padding: 20px !important;
      max-height: 85vh !important;
      overflow-y: auto !important;
      position: relative !important;
      margin: 20px auto !important;
      box-sizing: border-box !important;
    `;
    
    // 关闭按钮容器（包含标题和关闭按钮）
    const closeContainer = document.createElement("div");
    closeContainer.style.cssText = `
      position: sticky !important;
      top: 0 !important;
      width: 100% !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 0 0 10px 0 !important;
      margin: -10px 0 10px 0 !important;
      z-index: 10 !important;
      background: transparent !important;
      border-radius: 16px 16px 0 0 !important;
    `;
    
    // 方寸工具箱标题
    const titleDiv = document.createElement("div");
    titleDiv.innerHTML = "方寸工具箱";
    titleDiv.style.cssText = `
      font-size: 18px !important;
      color: #1377EB !important;
      font-weight: 600 !important;
      line-height: 1 !important;
      padding: 6px 12px !important;
      background: white !important;  /* 白色背景 */
      border-radius: 8px !important;
      display: inline-block !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;  /* 添加轻微阴影 */
    `;
    closeContainer.appendChild(titleDiv);
    
    // 关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.id = "fc-close-settings";
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText = `
      width: 36px !important;
      height: 36px !important;
      border-radius: 50% !important;
      background: #f1f1f1 !important;
      border: none !important;
      cursor: pointer !important;
      z-index: 10 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 18px !important;
      line-height: 1 !important;
      color: #666 !important;
      margin-left: auto !important; /* 靠右 */
      transition: all 0.2s ease !important;
    `;
    closeContainer.appendChild(closeBtn);
    
    // 设置界面主体内容
    settings.innerHTML = `
      <!-- 头部：快捷按钮设置标题 + 切换按钮 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h4 style="margin:0;font-size:15px;color:#333;font-weight:500;">🔧 快捷按钮设置</h4>
        <!-- 切换按钮容器：z-index确保不被遮挡 -->
        <div style="display:flex;align-items:center;gap:10px;z-index:1 !important;">
          <div style="display:flex;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
            <button id="tab-pc" style="padding:6px 16px;background:#1377EB;color:white;border:none;cursor:pointer;font-size:14px;">PC端</button>
            <button id="tab-mobile" style="padding:6px 16px;background:#f5f5f5;color:#666;border:none;border-left:1px solid #ddd;cursor:pointer;font-size:14px;">手机端</button>
          </div>
        </div>
      </div>

      <!-- PC端样式配置 -->
      <div id="config-pc" style="margin-bottom:20px;">
        <h4 style="margin:0 0 15px 0;font-size:14px;">🖥️ PC端样式配置</h4>
        <div style="display:flex;gap:20px;margin-bottom:15px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:100px;max-width:140px;">
            <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">面板宽度 (px)</label>
            <input type="number" id="fc-pc-width" value="${panelConfig.pc.width}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
          </div>
          <div style="flex:1;min-width:100px;max-width:140px;">
            <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">字体大小 (px)</label>
            <input type="number" id="fc-pc-font" value="${panelConfig.pc.fontSize}" min="12" max="24" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
          </div>
          <div style="flex:1;min-width:100px;max-width:140px;">
            <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">面板高度</label>
            <select id="fc-pc-height" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
              <option value="auto" ${panelConfig.pc.height === "auto" ? "selected" : ""}>自动</option>
              <option value="200px" ${panelConfig.pc.height === "200px" ? "selected" : ""}>200px</option>
              <option value="300px" ${panelConfig.pc.height === "300px" ? "selected" : ""}>300px</option>
              <option value="400px" ${panelConfig.pc.height === "400px" ? "selected" : ""}>400px</option>
            </select>
          </div>
        </div>
        <button id="save-pc-config" style="padding:8px 16px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">保存 PC 端配置</button>
      </div>
      
      <!-- 手机端样式配置 -->
      <div id="config-mobile" style="margin-bottom:20px;display:none;">
        <h4 style="margin:0 0 15px 0;font-size:14px;">📱 手机端样式配置</h4>
        <div style="display:flex;gap:20px;margin-bottom:15px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:100px;max-width:140px;">
            <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">面板宽度 (px)</label>
            <input type="number" id="fc-mobile-width" value="${panelConfig.mobile.width}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
          </div>
          <div style="flex:1;min-width:100px;max-width:140px;">
            <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">字体大小 (px)</label>
            <input type="number" id="fc-mobile-font" value="${panelConfig.mobile.fontSize}" min="12" max="24" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
          </div>
          <div style="flex:1;min-width:100px;max-width:140px;">
            <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">面板高度</label>
            <select id="fc-mobile-height" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
              <option value="auto" ${panelConfig.mobile.height === "auto" ? "selected" : ""}>自动</option>
              <option value="200px" ${panelConfig.mobile.height === "200px" ? "selected" : ""}>200px</option>
              <option value="300px" ${panelConfig.mobile.height === "300px" ? "selected" : ""}>300px</option>
              <option value="400px" ${panelConfig.mobile.height === "400px" ? "selected" : ""}>400px</option>
            </select>
          </div>
        </div>
        <button id="save-mobile-config" style="padding:8px 16px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">保存手机端配置</button>
      </div>

      <div style="border-top:1px solid #eee;padding-top:20px;">
        <h4 style="margin:0 0 12px 0;font-size:14px;display:inline-block;" id="btn-group-title">🔧 按钮生成</h4>
        <span id="btn-gen-device-label" style="display:inline-block;margin-left:10px;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">💻 PC端</span>
        <div style="margin-bottom:15px;">
          <!-- 基础信息 -->
          <div style="display:flex;gap:10px;margin-bottom:12px;">
            <input id="fc-btn-name" placeholder="按钮名称（如：直接新建文档）" style="flex:2;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
            <select id="fc-btn-type" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;min-width:100px;">
              <option value="selector" selected>元素选择器</option>
              <option value="document">文档 ID</option>
              <option value="block">块 ID</option>
            </select>
          </div>
                  
          <!-- 选择器/ID 输入框 -->
          <div style="margin-bottom:12px;">
            <input id="fc-btn-value" placeholder="${exampleTexts.selector}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
          </div>
          
          <!-- 图标选择区域 -->
          <div style="margin-bottom:10px;">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
              <label style="font-size:12px;color:#666;">图标类型：</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="radio" name="icon-type" id="icon-emoji" value="emoji" checked style="cursor:pointer;">
                <span>系统Emoji</span>
              </label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="radio" name="icon-type" id="icon-custom" value="custom" style="cursor:pointer;">
                <span>自定义图标</span>
              </label>
            </div>
            
            <!-- Emoji TAB 分组容器 -->
            <div id="emoji-selector-container" style="border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:10px;">
              <!-- Emoji TAB 栏 -->
              <div style="display:flex;background:#f5f5f5;border-bottom:1px solid #ddd;overflow-x:auto;flex-wrap:wrap;gap:2px;">
                ${Object.keys(siyuanFullEmojis).map((category, idx) => `
                  <button class="emoji-tab" data-category="${category}" style="padding:6px 10px;border:none;background:${idx===0?'#e8f4ff':'transparent'};color:${idx===0?'#1377EB':'#666'};cursor:pointer;font-size:12px;white-space:nowrap;transition:all 0.2s;">${category}</button>
                `).join("")}
              </div>
              <!-- Emoji 内容区 -->
              <div id="emoji-content" style="padding:8px;max-height:150px;overflow-y:auto;">
                ${this.renderEmojiTabContent(Object.keys(siyuanFullEmojis)[0])}
              </div>
            </div>
            
            <!-- 自定义图标选择器 -->
            <div id="custom-icon-container" style="display:none;border:1px solid #ddd;border-radius:6px;padding:10px;">
              <!-- 上传区域 -->
              <div style="margin-bottom:10px;">
                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">上传自定义图标（支持jpg/png/svg/gif）</label>
                <input type="file" id="custom-icon-upload" accept=".jpg,.jpeg,.png,.svg,.gif" style="width:100%;padding:8px;border:1px dashed #ddd;border-radius:6px;font-size:14px;">
              </div>
              
              <!-- 已上传图标列表 -->
              <div id="custom-icon-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
                ${customIcons.length > 0 ? customIcons.map(icon => `
                  <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                    <img src="${icon.relativePath}" style="width:32px;height:32px;border:2px solid transparent;border-radius:6px;padding:2px;" data-path="${icon.relativePath}" alt="${icon.name}">
                    <span style="font-size:10px;color:#999;margin-top:4px;">${icon.name}</span>
                  </div>
                `).join("") : '<div style="color:#999;font-size:12px;">暂无自定义图标，请先上传</div>'}
              </div>
              <input type="hidden" id="fc-btn-custom-icon-path" value="">
            </div>
            
            <input type="hidden" id="fc-btn-emoji" value="⚡">
          </div>
          
          <!-- 显示模式和颜色选择 - 并列一行 -->
          <div style="display:flex;gap:15px;margin-bottom:15px;align-items:flex-end;flex-wrap:wrap;">
            <div style="flex:1;min-width:100px;max-width:140px;">
              <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">显示模式</label>
              <select id="fc-btn-display" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                <option value="both" selected>图标 + 文字</option>
                <option value="text">仅文字</option>
                <option value="emoji">仅图标</option>
              </select>
            </div>
            <div style="flex:1;min-width:100px;max-width:140px;">
              <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">背景色</label>
              <input type="color" id="fc-btn-bgcolor" value="#f8f9fa" style="width:100%;height:40px;border:1px solid #ddd;border-radius:6px;cursor:pointer;">
            </div>
            <div style="flex:1;min-width:100px;max-width:140px;">
              <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">文字色</label>
              <input type="color" id="fc-btn-color" value="#333333" style="width:100%;height:40px;border:1px solid #ddd;border-radius:6px;cursor:pointer;">
            </div>
            <div style="flex:1;min-width:100px;">
              <button id="add-btn" style="width:100%;padding:10px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;height:40px;">生成按钮</button>
            </div>
          </div>
        </div>
        
        <!-- 按钮列表分隔线 + 标题 -->
        <div style="margin:25px 0 12px 0;">
          <div style="height:1px;background:#eee;width:100%;margin-bottom:12px;"></div>
          <h4 style="margin:0;font-size:14px;color:#666;display:inline-block;" id="btn-list-title">🔧 按钮管理</h4>
          <span id="btn-manage-device-label" style="display:inline-block;margin-left:10px;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">💻 PC端</span>
        </div>
                
        <!-- 按钮列表 -->
        <div id="btn-list-container" style="border:1px solid #ddd;border-radius:6px;padding:10px;max-height:300px;overflow-y:auto;">
          ${this.renderButtonList()}
        </div>
                
        <!-- 提示信息移到这里 -->
        <div style="margin-top:10px;font-size:12px;color:#666;text-align:center;">
          <i>💡 提示：按钮可拖拽排序，也可点击↑↓按钮调整顺序</i>
        </div>
      </div>
    `;
    
    // ===================== 核心修复3：添加悬浮关闭按钮 =====================
    settings.insertBefore(closeContainer, settings.firstChild);
    mask.appendChild(settings);
    document.body.appendChild(mask);

    // 绑定设置界面事件
    this.bindSettingsEvents();
  }

  // 渲染Emoji TAB内容
  renderEmojiTabContent(activeCategory) {
    const emojis = siyuanFullEmojis[activeCategory] || [];
    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${emojis.map(emoji => `
          <span style="font-size:24px;cursor:pointer;padding:6px;border-radius:6px;transition:background 0.2s;" data-emoji="${emoji}">${emoji}</span>
        `).join("")}
      </div>
    `;
  }

  // 渲染按钮列表
  renderButtonList() {
    // 只显示当前端的按钮
    const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
    
    if (currentButtons.length === 0) {
      return '<div style="color:#999;font-size:12px;text-align:center;padding:20px;">暂无按钮，点击上方“生成按钮”创建</div>';
    }
    
    return currentButtons.map((btn, index) => `
      <div draggable="true" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #f5f5f5;cursor:move;" data-index="${index}" id="btn-item-${index}">
        <div style="width:20px;height:20px;background:#e8f4ff;color:#1377EB;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;">
          ${index + 1}
        </div>
        <div style="color:#ccc;margin-right:6px;flex-shrink:0;">☰</div>
        <div style="flex:1;display:flex;align-items:center;gap:6px;">
          ${btn.isCustomIcon && btn.customIconPath 
            ? `<img src="${btn.customIconPath}" style="width:24px;height:24px;border-radius:4px;" alt="图标">` 
            : `<span style="font-size:20px;">${btn.emoji}</span>`}
          <span style="font-size:14px;">${btn.name}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn-copy" style="padding:4px 8px;background:#52c41a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
            ${activeConfigTab === 'pc' ? '复制到手机端' : '复制到 PC 端'}
          </button>
          <button class="btn-up" style="padding:4px 8px;background:#f1f1f1;border:none;border-radius:4px;cursor:pointer;font-size:12px;">↑</button>
          <button class="btn-down" style="padding:4px 8px;background:#f1f1f1;border:none;border-radius:4px;cursor:pointer;font-size:12px;">↓</button>
          <button class="btn-edit" style="padding:4px 8px;background:#40a9ff;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">编辑</button>
          <button class="btn-delete" style="padding:4px 8px;background:#ff4d4f;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">删除</button>
        </div>
      </div>
    `).join("");
  }

  // 绑定设置界面所有事件
  bindSettingsEvents() {
    const mask = document.getElementById("fc-settings-mask");
    const tabPc = document.getElementById("tab-pc");
    const tabMobile = document.getElementById("tab-mobile");
    const configPc = document.getElementById("config-pc");
    const configMobile = document.getElementById("config-mobile");
    const btnGroupTitle = document.getElementById("btn-group-title");
    const closeBtn = document.getElementById("fc-close-settings");
    const savePcConfig = document.getElementById("save-pc-config");
    const saveMobileConfig = document.getElementById("save-mobile-config");
    const iconEmoji = document.getElementById("icon-emoji");
    const iconCustom = document.getElementById("icon-custom");
    const emojiContainer = document.getElementById("emoji-selector-container");
    const customIconContainer = document.getElementById("custom-icon-container");
    const customIconUpload = document.getElementById("custom-icon-upload");
    const customIconList = document.getElementById("custom-icon-list");
    const addBtn = document.getElementById("add-btn");
    const btnType = document.getElementById("fc-btn-type");
    const btnValue = document.getElementById("fc-btn-value");
    const btnListContainer = document.getElementById("btn-list-container");
    const emojiTabs = document.querySelectorAll(".emoji-tab");
    const emojiContent = document.getElementById("emoji-content");

    // 关闭设置
    closeBtn?.addEventListener("click", () => {
      mask?.remove();
    });

    // 切换PC/移动端配置
    tabPc?.addEventListener("click", () => {
      activeConfigTab = "pc";
      tabPc.style.background = "#1377EB";
      tabPc.style.color = "white";
      tabMobile.style.background = "#f5f5f5";
      tabMobile.style.color = "#666";
      configPc.style.display = "block";
      configMobile.style.display = "none";
      btnGroupTitle.innerText = "🔧 按钮生成";
      const deviceLabel = document.getElementById("btn-gen-device-label");
      if (deviceLabel) deviceLabel.innerText = "💻 PC 端";
      const manageDeviceLabel = document.getElementById("btn-manage-device-label");
      if (manageDeviceLabel) manageDeviceLabel.innerText = "💻 PC端";
      const btnListTitle = document.getElementById("btn-list-title");
      if (btnListTitle) btnListTitle.innerText = "🔧 按钮管理";
      btnValue.placeholder = exampleTexts.selector;
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    });
    
    tabMobile?.addEventListener("click", () => {
      activeConfigTab = "mobile";
      tabMobile.style.background = "#1377EB";
      tabMobile.style.color = "white";
      tabPc.style.background = "#f5f5f5";
      tabPc.style.color = "#666";
      configPc.style.display = "none";
      configMobile.style.display = "block";
      btnGroupTitle.innerText = "🔧 按钮生成";
      const deviceLabel = document.getElementById("btn-gen-device-label");
      if (deviceLabel) deviceLabel.innerText = "📱 手机端";
      const manageDeviceLabel = document.getElementById("btn-manage-device-label");
      if (manageDeviceLabel) manageDeviceLabel.innerText = "📱 手机端";
      const btnListTitle = document.getElementById("btn-list-title");
      if (btnListTitle) btnListTitle.innerText = "🔧 按钮管理";
      btnValue.placeholder = exampleTexts.selector;
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    });

    // 保存PC端配置
    savePcConfig?.addEventListener("click", () => {
      const width = parseInt(document.getElementById("fc-pc-width").value) || 140;
      const fontSize = parseInt(document.getElementById("fc-pc-font").value) || 14;
      const height = document.getElementById("fc-pc-height").value || "auto";
      
      panelConfig.pc = { width, fontSize, height };
      // 保存到插件目录
      this.saveConfigToFile({
        buttons: buttonConfig,
        panelConfig: panelConfig
      });
      this.rebuildFloatButton();
      this.showToast("PC端配置保存成功", "success");
    });

    // 保存手机端配置
    saveMobileConfig?.addEventListener("click", () => {
      const width = parseInt(document.getElementById("fc-mobile-width").value) || 300;
      const fontSize = parseInt(document.getElementById("fc-mobile-font").value) || 14;
      const height = document.getElementById("fc-mobile-height").value || "auto";
      
      panelConfig.mobile = { width, fontSize, height };
      // 保存到插件目录
      this.saveConfigToFile({
        buttons: buttonConfig,
        panelConfig: panelConfig
      });
      this.rebuildFloatButton();
      this.showToast("手机端配置保存成功", "success");
    });

    // 切换图标类型
    iconEmoji?.addEventListener("change", () => {
      emojiContainer.style.display = "block";
      customIconContainer.style.display = "none";
    });

    iconCustom?.addEventListener("change", () => {
      emojiContainer.style.display = "none";
      customIconContainer.style.display = "block";
    });

    // Emoji TAB切换
    emojiTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        emojiTabs.forEach(t => {
          t.style.background = "transparent";
          t.style.color = "#666";
        });
        tab.style.background = "#e8f4ff";
        tab.style.color = "#1377EB";
        emojiContent.innerHTML = this.renderEmojiTabContent(tab.dataset.category);
        this.bindEmojiSelectEvent();
      });
    });

    // 初始绑定Emoji选择事件
    this.bindEmojiSelectEvent();

    // 绑定自定义图标选择事件
    this.bindCustomIconSelectEvent();

    // 切换按钮类型时更新示例文本
    btnType?.addEventListener("change", () => {
      const type = btnType.value;
      btnValue.placeholder = exampleTexts[type] || exampleTexts.selector;
    });

    // 添加/保存按钮
    addBtn?.addEventListener("click", () => {
      const name = document.getElementById("fc-btn-name").value.trim();
      const type = document.getElementById("fc-btn-type").value;
      const value = document.getElementById("fc-btn-value").value.trim();
      const displayMode = document.getElementById("fc-btn-display").value;
      const bgColor = document.getElementById("fc-btn-bgcolor").value;
      const color = document.getElementById("fc-btn-color").value;
      const emoji = document.getElementById("fc-btn-emoji").value;
      const isCustomIcon = document.getElementById("icon-custom").checked;
      const customIconPath = document.getElementById("fc-btn-custom-icon-path").value;

      if (!name) {
        this.showToast("按钮名称不能为空", "error");
        return;
      }
      if (!value) {
        this.showToast("值不能为空", "error");
        return;
      }

      if (editBtnIndex >= 0) {
        // 编辑模式：只更新当前端的按钮
        const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
        const sourceBtnName = currentButtons[editBtnIndex].name;
        
        const updatedBtn = {
          name,
          emoji: isCustomIcon ? "" : emoji,
          type,
          value,
          bgColor: this.formatColor(bgColor),
          color: this.formatColor(color),
          displayMode,
          isCustomIcon,
          customIconPath: isCustomIcon ? customIconPath : ""
        };
        
        // 只更新当前端的按钮
        buttonConfig = buttonConfig.map(btn => {
          if (btn.name === sourceBtnName && btn.targetTab === activeConfigTab) {
            return { ...btn, ...updatedBtn };
          }
          return btn;
        });
        
        editBtnIndex = -1;
        addBtn.innerText = "生成按钮";
        this.showToast("按钮编辑成功", "success");
      } else {
        // 新增模式：只在当前端生成按钮
        const newBtn = {
          name,
          emoji: isCustomIcon ? "" : emoji,
          type,
          value,
          bgColor: this.formatColor(bgColor),
          color: this.formatColor(color),
          sort: buttonConfig.filter(btn => btn.targetTab === activeConfigTab).length,
          targetTab: activeConfigTab, // 只添加到当前端
          displayMode,
          isCustomIcon,
          customIconPath: isCustomIcon ? customIconPath : ""
        };

        buttonConfig.push(newBtn);
        this.showToast(`按钮添加成功（${activeConfigTab === 'pc' ? 'PC端' : '手机端'}）`, "success");
      }

      // 核心：保存到插件目录
      this.saveConfigToFile({
        buttons: buttonConfig,
        panelConfig: panelConfig
      });
      this.rebuildFloatButton();

      // 清空输入框
      document.getElementById("fc-btn-name").value = "";
      document.getElementById("fc-btn-value").value = "";
      document.getElementById("icon-emoji").checked = true;
      emojiContainer.style.display = "block";
      customIconContainer.style.display = "none";
      
      // 重新渲染按钮列表
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    });

    // 绑定按钮列表事件
    this.bindButtonListEvents();
  }

    // 绑定Emoji选择事件
  bindEmojiSelectEvent() {
    const emojiItems = document.querySelectorAll("#emoji-content span[data-emoji]");
    emojiItems.forEach(item => {
      item.addEventListener("click", () => {
        const emoji = item.dataset.emoji;
        document.getElementById("fc-btn-emoji").value = emoji;
        // 高亮选中的Emoji
        emojiItems.forEach(i => i.style.background = "transparent");
        item.style.background = "#e8f4ff";
        this.showToast(`已选择: ${emoji}`, "success");
      });
    });
  }

  // 绑定自定义图标选择事件
  bindCustomIconSelectEvent() {
    const iconItems = document.querySelectorAll("#custom-icon-list img[data-path]");
    iconItems.forEach(item => {
      item.addEventListener("click", () => {
        const path = item.dataset.path;
        document.getElementById("fc-btn-custom-icon-path").value = path;
        // 高亮选中的图标
        iconItems.forEach(i => i.style.borderColor = "transparent");
        item.style.borderColor = "#1377EB";
        this.showToast(`已选择自定义图标: ${item.alt}`, "success");
      });
    });
  }

  // 绑定按钮列表事件（拖拽、编辑、删除、复制等）
  bindButtonListEvents() {
    const btnListContainer = document.getElementById("btn-list-container");
    const btnItems = document.querySelectorAll("#btn-list-container [draggable='true']");
    const btnCopy = document.querySelectorAll(".btn-copy");
    const btnUp = document.querySelectorAll(".btn-up");
    const btnDown = document.querySelectorAll(".btn-down");
    const btnEdit = document.querySelectorAll(".btn-edit");
    const btnDelete = document.querySelectorAll(".btn-delete");

    // ===================== 核心修复2：实现跨端复制功能 =====================
    btnCopy.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest("[data-index]").dataset.index);
        const sourceTab = activeConfigTab; // 源端（pc/mobile）
        const targetTab = sourceTab === "pc" ? "mobile" : "pc"; // 目标端
        
        // 获取源端按钮配置
        const sourceButtons = buttonConfig.filter(btn => btn.targetTab === sourceTab).sort((a, b) => a.sort - b.sort);
        const sourceBtn = sourceButtons[index];
        
        // 创建目标端按钮配置（复制并修改targetTab）
        const newBtn = {
          ...sourceBtn,
          targetTab: targetTab, // 切换到目标端
          sort: buttonConfig.filter(btn => btn.targetTab === targetTab).length, // 追加到目标端最后
          name: `${sourceBtn.name}（复制）` // 标记复制的按钮
        };
        
        // 添加到配置中
        buttonConfig.push(newBtn);
        
        // 保存到插件目录
        this.saveConfigToFile({
          buttons: buttonConfig,
          panelConfig: panelConfig
        });
        
        // 刷新按钮列表
        btnListContainer.innerHTML = this.renderButtonList();
        this.bindButtonListEvents();
        
        // 提示成功
        this.showToast(`已复制到${targetTab === "pc" ? "PC端" : "手机端"}`, "success");
      });
    });

    // 上移按钮
    btnUp.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest("[data-index]").dataset.index);
        if (index <= 0) return;
        
        const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
        const temp = currentButtons[index];
        currentButtons[index] = currentButtons[index - 1];
        currentButtons[index - 1] = temp;
        
        // 更新排序
        currentButtons.forEach((btn, idx) => btn.sort = idx);
        
        // 同步到主配置
        buttonConfig = buttonConfig.filter(btn => btn.targetTab !== activeConfigTab).concat(currentButtons);
        
        // 保存到插件目录
        this.saveConfigToFile({
          buttons: buttonConfig,
          panelConfig: panelConfig
        });
        
        // 刷新列表
        btnListContainer.innerHTML = this.renderButtonList();
        this.bindButtonListEvents();
        
        this.showToast("按钮已上移", "success");
      });
    });

    // 下移按钮
    btnDown.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest("[data-index]").dataset.index);
        const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
        if (index >= currentButtons.length - 1) return;
        
        const temp = currentButtons[index];
        currentButtons[index] = currentButtons[index + 1];
        currentButtons[index + 1] = temp;
        
        // 更新排序
        currentButtons.forEach((btn, idx) => btn.sort = idx);
        
        // 同步到主配置
        buttonConfig = buttonConfig.filter(btn => btn.targetTab !== activeConfigTab).concat(currentButtons);
        
        // 保存到插件目录
        this.saveConfigToFile({
          buttons: buttonConfig,
          panelConfig: panelConfig
        });
        
        // 刷新列表
        btnListContainer.innerHTML = this.renderButtonList();
        this.bindButtonListEvents();
        
        this.showToast("按钮已下移", "success");
      });
    });

    // 编辑按钮
    btnEdit.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest("[data-index]").dataset.index);
        const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
        const btnData = currentButtons[index];
        
        editBtnIndex = index;
        
        // 填充表单
        document.getElementById("fc-btn-name").value = btnData.name;
        document.getElementById("fc-btn-type").value = btnData.type;
        document.getElementById("fc-btn-value").value = btnData.value;
        document.getElementById("fc-btn-display").value = btnData.displayMode;
        document.getElementById("fc-btn-bgcolor").value = btnData.bgColor;
        document.getElementById("fc-btn-color").value = btnData.color;
        
        // 图标类型处理
        if (btnData.isCustomIcon) {
          document.getElementById("icon-custom").checked = true;
          document.getElementById("emoji-selector-container").style.display = "none";
          document.getElementById("custom-icon-container").style.display = "block";
          document.getElementById("fc-btn-custom-icon-path").value = btnData.customIconPath;
          
          // 高亮选中的自定义图标
          const customIconItems = document.querySelectorAll("#custom-icon-list img[data-path]");
          customIconItems.forEach(item => {
            if (item.dataset.path === btnData.customIconPath) {
              item.style.borderColor = "#1377EB";
            } else {
              item.style.borderColor = "transparent";
            }
          });
        } else {
          document.getElementById("icon-emoji").checked = true;
          document.getElementById("emoji-selector-container").style.display = "block";
          document.getElementById("custom-icon-container").style.display = "none";
          document.getElementById("fc-btn-emoji").value = btnData.emoji;
          
          // 高亮选中的Emoji
          const emojiItems = document.querySelectorAll("#emoji-content span[data-emoji]");
          emojiItems.forEach(item => {
            if (item.dataset.emoji === btnData.emoji) {
              item.style.background = "#e8f4ff";
            } else {
              item.style.background = "transparent";
            }
          });
        }
        
        // 更新按钮文本
        document.getElementById("add-btn").innerText = "保存修改";
        
        // 更新示例文本
        const type = btnData.type;
        document.getElementById("fc-btn-value").placeholder = exampleTexts[type] || exampleTexts.selector;
      });
    });

    // 删除按钮
    btnDelete.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest("[data-index]").dataset.index);
        const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
        const btnName = currentButtons[index].name;
        
        // 创建自定义确认对话框
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999999999;
        `;
        
        const confirmDialog = document.createElement('div');
        confirmDialog.style.cssText = `
          background: white;
          border-radius: 8px;
          padding: 24px;
          min-width: 300px;
          max-width: 400px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        `;
        
        confirmDialog.innerHTML = `
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 20px; color: #333;">
            ⚠️ 确认删除
          </div>
          <div style="font-size: 14px; color: #666; margin-bottom: 24px; line-height: 1.6;">
            确定要删除按钮「${btnName}」吗？<br>此操作不可恢复。
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-start;">
            <button id="confirm-delete-btn" style="
              flex: 1;
              padding: 10px 20px;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
              transition: background 0.2s;
            ">确定</button>
            <button id="cancel-delete-btn" style="
              flex: 1;
              padding: 10px 20px;
              background: #f0f0f0;
              color: #666;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
              transition: background 0.2s;
            ">取消</button>
          </div>
        `;
        
        confirmModal.appendChild(confirmDialog);
        document.body.appendChild(confirmModal);
        
        // 绑定确定按钮
        const deleteBtn = confirmModal.querySelector('#confirm-delete-btn');
        deleteBtn.onmouseover = () => deleteBtn.style.background = '#c82333';
        deleteBtn.onmouseout = () => deleteBtn.style.background = '#dc3545';
        
        deleteBtn.addEventListener('click', () => {
          // 移除按钮
          currentButtons.splice(index, 1);
          
          // 重新排序
          currentButtons.forEach((btn, idx) => btn.sort = idx);
          
          // 同步到主配置
          buttonConfig = buttonConfig.filter(btn => btn.targetTab !== activeConfigTab).concat(currentButtons);
          
          // 保存到插件目录
          this.saveConfigToFile({
            buttons: buttonConfig,
            panelConfig: panelConfig
          });
          
          // 刷新列表
          btnListContainer.innerHTML = this.renderButtonList();
          this.bindButtonListEvents();
          
          this.showToast(`按钮「${btnName}」已删除`, "success");
          document.body.removeChild(confirmModal);
        });
        
        // 绑定取消按钮
        const cancelBtn = confirmModal.querySelector('#cancel-delete-btn');
        cancelBtn.onmouseover = () => cancelBtn.style.background = '#e0e0e0';
        cancelBtn.onmouseout = () => cancelBtn.style.background = '#f0f0f0';
        
        cancelBtn.addEventListener('click', () => {
          document.body.removeChild(confirmModal);
        });
        
        // 点击背景关闭
        confirmModal.onclick = (e) => {
          if (e.target === confirmModal) {
            document.body.removeChild(confirmModal);
          }
        };
      });
    });

    // 拖拽排序
    let dragSrcEl = null;
    btnItems.forEach(item => {
      item.addEventListener("dragstart", (e) => {
        dragSrcEl = item;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", item.innerHTML);
        item.style.opacity = "0.4";
      });

      item.addEventListener("dragover", (e) => {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        return false;
      });

      item.addEventListener("dragenter", () => {
        item.style.background = "#e8f4ff";
      });

      item.addEventListener("dragleave", () => {
        item.style.background = "transparent";
      });

      item.addEventListener("drop", (e) => {
        e.stopPropagation();
        if (dragSrcEl !== item) {
          const srcIndex = parseInt(dragSrcEl.dataset.index);
          const targetIndex = parseInt(item.dataset.index);
          
          const currentButtons = buttonConfig.filter(btn => btn.targetTab === activeConfigTab).sort((a, b) => a.sort - b.sort);
          
          // 交换位置
          const temp = currentButtons[srcIndex];
          currentButtons[srcIndex] = currentButtons[targetIndex];
          currentButtons[targetIndex] = temp;
          
          // 更新排序
          currentButtons.forEach((btn, idx) => btn.sort = idx);
          
          // 同步到主配置
          buttonConfig = buttonConfig.filter(btn => btn.targetTab !== activeConfigTab).concat(currentButtons);
          
          // 保存到插件目录
          this.saveConfigToFile({
            buttons: buttonConfig,
            panelConfig: panelConfig
          });
          
          // 刷新列表
          btnListContainer.innerHTML = this.renderButtonList();
          this.bindButtonListEvents();
          
          this.showToast("按钮排序已更新", "success");
        }
        return false;
      });

      item.addEventListener("dragend", () => {
        btnItems.forEach(i => {
          i.style.opacity = "1";
          i.style.background = "transparent";
        });
      });
    });
  }

  // 打开设置界面
  async openSetting() {
    // 获取当前配置
    const config = this.config || {};
    const enabled = config.enabled !== false;
    
    // 创建设置界面的 HTML 内容
    const content = `
<div style="padding: 20px;">
  <style>
    .tab-container {
      display: flex;
      border-bottom: 2px solid #e0e0e0;
      margin-bottom: 20px;
    }
    .tab-item {
      padding: 12px 24px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.3s;
      color: #666;
    }
    .tab-item:hover {
      color: #1377EB;
    }
    .tab-item.active {
      color: #1377EB;
      border-bottom-color: #1377EB;
      font-weight: 600;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }
    .setting-label {
      font-size: 14px;
      color: #333;
    }
    .setting-desc {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
    .toggle {
      width: 44px;
      height: 22px;
      background: #ddd;
      border-radius: 11px;
      cursor: pointer;
      transition: background 0.3s;
      position: relative;
      display: inline-block;
      vertical-align: middle;
    }
    .toggle.active {
      background: #409eff;
    }
    .toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .toggle.active::after {
      transform: translateX(22px);
    }
    .settings-icon {
      display: inline-block;
      width: 32px;
      height: 32px;
      margin-left: 10px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s;
      vertical-align: middle;
    }
    .settings-icon.visible {
      opacity: 1;
    }
    .settings-icon svg {
      width: 100%;
      height: 100%;
      fill: #666;
    }
    .settings-icon:hover svg {
      fill: #1377EB;
    }
    .about-content {
      line-height: 1.8;
      color: #333;
    }
    .about-content h3 {
      margin-bottom: 15px;
      color: #1377EB;
    }
    .about-content p {
      margin: 10px 0;
    }
    .about-content .version {
      color: #999;
      font-size: 12px;
    }
  </style>
  
  <!-- TAB 切换 -->
  <div class="tab-container">
    <div class="tab-item active" data-tab="basic">基础功能</div>
    <div class="tab-item" data-tab="about">关于插件</div>
  </div>
  
  <!-- 基础功能 TAB -->
  <div class="tab-content active" data-tab-content="basic">
    <div class="setting-item">
      <div>
        <div class="setting-label">启用悬浮按钮</div>
        <div class="setting-desc">开启后在屏幕右侧显示悬浮快捷按钮</div>
      </div>
      <div style="display: flex; align-items: center;">
        <div class="toggle ${enabled ? 'active' : ''}" data-setting="enabled"></div>
        <div class="settings-icon ${enabled ? 'visible' : ''}" id="floating-settings-btn" title="悬浮按钮设置">
          <svg viewBox="0 0 24 24">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 关于插件 TAB -->
  <div class="tab-content" data-tab-content="about">
    <div class="about-content">
      <h3>方寸工具箱</h3>
      <p>一款为思源笔记打造的便捷工具箱插件。</p>
      <p class="version">版本：1.0.0</p>
      <p><strong>主要功能：</strong></p>
      <ul style="padding-left: 20px; margin: 10px 0;">
        <li>悬浮快捷按钮：提供便捷的文档操作入口</li>
        <li>快速访问：一键复制、收藏、导出文档</li>
        <li>自定义配置：支持开关和样式调整</li>
      </ul>
      <p style="margin-top: 20px; color: #999; font-size: 13px;">
        © 2026 方寸工具箱 | 逆念YCB.CC
      </p>
    </div>
  </div>
</div>
    `;
    
    // 创建一个模态框容器
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999999;
    `;
    
    // 创建对话框内容
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    `;
    
    // 创建关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      width: 30px;
      height: 30px;
      text-align: center;
      line-height: 30px;
      border-radius: 50%;
      background: #f5f5f5;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = '#e0e0e0';
    closeBtn.onmouseout = () => closeBtn.style.background = '#f5f5f5';
    // 组装对话框
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
    `;
    header.innerHTML = '<h3 style="margin: 0; font-size: 18px;">方寸工具箱设置</h3>';
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.innerHTML = content;
    body.style.padding = '20px';
    
    dialog.innerHTML = '';
    dialog.appendChild(header);
    dialog.appendChild(body);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // 点击背景关闭
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
    
    // 关闭按钮事件
    closeBtn.onclick = () => {
      document.body.removeChild(modal);
    };
    
    // 绑定开关事件
    setTimeout(() => {
      const toggles = modal.querySelectorAll('.toggle');
      toggles.forEach(toggle => {
        toggle.addEventListener('click', async () => {
          toggle.classList.toggle('active');
          const settingName = toggle.dataset.setting;
          const isActive = toggle.classList.contains('active');
          
          if (settingName === 'enabled') {
            await this.updateConfig('enabled', isActive);
            // 更新设置图标的可见性
            const settingsIcon = modal.querySelector('#floating-settings-btn');
            if (settingsIcon) {
              if (isActive) {
                settingsIcon.classList.add('visible');
              } else {
                settingsIcon.classList.remove('visible');
              }
            }
          }
          
          this.showToast('设置已保存', 'success');
        });
      });
      
      // TAB 切换逻辑
      const tabItems = modal.querySelectorAll('.tab-item');
      const tabContents = modal.querySelectorAll('.tab-content');
      
      tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
          // 移除所有 active 类
          tabItems.forEach(t => t.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));
          
          // 添加 active 到当前选中的 TAB
          tab.classList.add('active');
          const tabName = tab.dataset.tab;
          const targetContent = modal.querySelector(`[data-tab-content="${tabName}"]`);
          if (targetContent) {
            targetContent.classList.add('active');
          }
        });
      });
      
      // 绑定设置图标点击事件
      const settingsIcon = modal.querySelector('#floating-settings-btn');
      if (settingsIcon && enabled) {
        settingsIcon.addEventListener('click', () => {
          // 关闭当前设置对话框
          document.body.removeChild(modal);
          // 打开悬浮按钮的设置（通过点击悬浮按钮来触发）
          const floatingBtn = document.getElementById('fc-btn');
          if (floatingBtn) {
            // 模拟点击悬浮按钮，打开展开面板
            this.togglePanel(floatingBtn);
            // 显示提示
            setTimeout(() => {
              this.showToast('请点击展开面板中的按钮进行编辑', 'success');
            }, 500);
          }
        });
      }
    }, 100);
  }

  // 更新配置
  async updateConfig(key, value) {
    if (!this.config) {
      this.config = {};
    }
    this.config[key] = value;
    
    try {
      // 使用思源 API 保存配置（确保跨平台同步）
      await this.saveData("config", this.config);
      
      // 根据配置更新 UI
      if (key === 'enabled') {
        if (value) {
          this.createFloatButton();
        } else {
          this.removeFloatingButton();
        }
      }
      
      this.showToast('设置已保存', 'success');
    } catch (e) {
      // 降级保存到 localStorage
      localStorage.setItem('fc_config_backup', JSON.stringify(this.config));
      this.showToast('保存失败，已保存到本地缓存', 'error');
    }
  }

  // 重新渲染面板按钮
  renderPanelButtons() {
    if (!this.panelElement) return;
    
    // 获取所有按钮容器
    const buttonsContainer = this.panelElement.querySelector('.fc-buttons-container');
    if (!buttonsContainer) return;
    
    // 清空现有按钮
    buttonsContainer.innerHTML = '';
    
    // 根据配置重新生成按钮
    const defaultButtons = [
      { name: 'copy', icon: '#iconCopy', label: '复制' },
      { name: 'favorite', icon: '#iconStar', label: '收藏' },
      { name: 'export', icon: '#iconExport', label: '导出' }
    ];
    
    defaultButtons.forEach(btnConfig => {
      const buttonSetting = this.config.buttons?.find(b => b.name === btnConfig.name);
      if (buttonSetting && buttonSetting.show !== false) {
        const btn = document.createElement('div');
        btn.className = 'fc-panel-button';
        btn.innerHTML = `
          <svg class="icon"><use xlink:href="${btnConfig.icon}"></use></svg>
          <span>${btnConfig.label}</span>
        `;
        btn.onclick = () => this.handlePanelButtonClick(btnConfig.name);
        buttonsContainer.appendChild(btn);
      }
    });
  }
  
  // 移除悬浮按钮
  removeFloatingButton() {
    // 通过 ID 移除悬浮按钮
    const btn = document.getElementById('fc-btn');
    if (btn) {
      btn.remove();
    }
    
    // 移除面板
    const panel = document.getElementById('fc-panel');
    if (panel) {
      panel.remove();
    }
    
    // 清空引用
    this.floatingButton = null;
    this.panelElement = null;
  }
}

module.exports = FangcunToolbox;