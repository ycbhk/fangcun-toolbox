const { Plugin } = require("siyuan");

// 思源笔记文件操作 API（完全使用思源 API，不依赖 Node.js 模块）
const siyuanFS = {
  // 读取文件
  async readFile(filePath) {
    try {
      // 使用思源 API
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
      // 使用思源 API
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
      // 尝试通过思源 API 读取
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
      // 使用思源 API
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
  pc: { width: 120, height: "auto", fontSize: 14 },
  mobile: { width: 100, height: "auto", fontSize: 14 }
};
let activeConfigTab = "pc"; // 当前激活的配置端
let editBtnIndex = -1; // 当前编辑的按钮索引（-1 表示新增）

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
    this.configFilePath = `${this.pluginDir}/config.json`; // 配置文件路径
  }

  // 获取插件目录（兼容移动端）
  getPluginDir(manifest) {
    const pluginName = manifest?.name || "fangcun-toolbox";
    
    // 使用字符串拼接路径（移动端浏览器兼容）
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
          pc: { width: 120, height: "auto", fontSize: 14 },
          mobile: { width: 100, height: "auto", fontSize: 14 }
        };
      } else {
        // 默认配置（同时创建 PC 和移动端按钮）
        buttonConfig = [
          // PC 端默认按钮
          {
            name: "命令面板",
            emoji: "⚡",
            type: "selector",
            value: "#barCommand",
            bgColor: "#e8f4ff",
            color: "#1377EB",
            sort: 0,
            targetTab: "pc",
            displayMode: "both"
          },
          {
            name: "立即同步",
            emoji: "🔄",
            type: "selector",
            value: "#barCommand|#commands > li:nth-child(52)",
            bgColor: "#e8f8e8",
            color: "#52c41a",
            sort: 1,
            targetTab: "pc",
            displayMode: "both"
          },
          {
            name: "新建日记",
            emoji: "📔",
            type: "selector",
            value: "#barCommand|#commands > li:nth-child(11)",
            bgColor: "#fff7e6",
            color: "#fa8c16",
            sort: 2,
            targetTab: "pc",
            displayMode: "both"
          },
          {
            name: "锁屏",
            emoji: "🔒",
            type: "selector",
            value: "#barCommand|#commands > li:nth-child(36)",
            bgColor: "#f5f5f5",
            color: "#666666",
            sort: 3,
            targetTab: "pc",
            displayMode: "both"
          },
          // 移动端默认按钮（强制添加）
          {
            name: "命令面板",
            emoji: "⚡",
            type: "selector",
            value: "#toolbarMore > use|#menuCommand",
            bgColor: "#e8f4ff",
            color: "#1377EB",
            sort: 0,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "立即同步",
            emoji: "🔄",
            type: "selector",
            value: "#toolbarMore > use|#menuSyncNow",
            bgColor: "#e8f8e8",
            color: "#52c41a",
            sort: 1,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "新建日记",
            emoji: "📔",
            type: "selector",
            value: "#toolbarMore > use|#menuNewDaily",
            bgColor: "#fff7e6",
            color: "#fa8c16",
            sort: 2,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "锁屏",
            emoji: "🔒",
            type: "selector",
            value: "#toolbarMore > use|#menuLock",
            bgColor: "#f5f5f5",
            color: "#666666",
            sort: 3,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "退出",
            emoji: "🚪",
            type: "selector",
            value: "#toolbarMore > use|#menuSafeQuit",
            bgColor: "#fff0f0",
            color: "#ff4d4f",
            sort: 4,
            targetTab: "mobile",
            displayMode: "both"
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
        displayMode: btn.displayMode || "both"
      }));
        

              
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
          displayMode: "both"
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
          displayMode: "both"
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
        const config = JSON.parse(backup);
        return config;
      }
      
      return null;
      
    } catch (e) {
      return null;
    }
  }

  // 保存配置到插件目录 - 核心修复：使用思源自带的持久化 API
  async saveConfigToFile(data) {
    try {
      // 核心修复：使用思源插件的 saveData 方法（自动处理跨平台存储）
      const result = await this.saveData("config", data);
      
      return true;
    } catch (e) {
      // 降级方案：保存到 localStorage
      localStorage.setItem("fc_config_backup", JSON.stringify(data));
      
      // 显示错误提示
      this.showToast(`保存失败，已保存到本地缓存：${e.message}`, "warning");
      return false;
    }
  }

  

  async onunload() {
    if (this.initTimer) clearTimeout(this.initTimer);
    document.getElementById("fc-btn")?.remove();
    document.getElementById("fc-panel")?.remove();
    document.getElementById("fc-settings-mask")?.remove();
    
    // 卸载插件时删除插件数据
    await this.removeData("config").catch(e => {
      this.showToast(`卸载时删除数据失败：${e.message}`, "error");
    });
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
        const maxWaitTime = 800;
        const startTime = Date.now();
        while (!target && Date.now() - startTime < maxWaitTime) {
          target = document.querySelector(validSelector);
          if (!target) {
            const cleanSelector = validSelector.replace(/\[|]|'|"/g, "");
            target = document.querySelector(`.b3-menu-item[title*='${cleanSelector}']`);
          }
          if (!target) await new Promise(resolve => setTimeout(resolve, 16)); // 缩短轮询间隔（约 1 帧）
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
          await new Promise(resolve => setTimeout(resolve, 16)); // 进一步优化，接近 1 帧的延迟
        }
      }

      // 最后再等待一下，确保所有操作完成
      await new Promise(resolve => setTimeout(resolve, 50)); // 减少最终等待时间

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
      align-items: center !important; /* 改为垂直居中 */
      justify-content: center !important;
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
        <h4 style="margin:0;font-size:15px;color:#333;font-weight:500;">快捷按钮设置</h4>
        <!-- 切换按钮容器：z-index确保不被遮挡 -->
        <div style="display:flex;align-items:center;gap:10px;z-index:1 !important;">
          <div style="display:flex;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
            <button id="tab-pc" style="padding:6px 16px;background:#1377EB;color:white;border:none;cursor:pointer;font-size:14px;">PC端</button>
            <button id="tab-mobile" style="padding:6px 16px;background:#f5f5f5;color:#666;border:none;border-left:1px solid #ddd;cursor:pointer;font-size:14px;">手机端</button>
          </div>
        </div>
      </div>

      <!-- PC 端样式配置 -->
      <div id="config-pc" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;margin-bottom:15px;">
          <h4 style="margin:0;font-size:14px;color:#333;">🔧样式配置</h4>
          <span style="display:inline-block;margin-left:10px;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">💻 PC 端</span>
        </div>
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
        <div style="display:flex;align-items:center;margin-bottom:15px;">
          <h4 style="margin:0;font-size:14px;color:#333;">🔧样式配置</h4>
          <span style="display:inline-block;margin-left:10px;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">📱 手机端</span>
        </div>
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
            
      <!-- 按钮列表分隔线 + 标题 -->
      <div style="margin:25px 0 12px 0;">
          <div style="height:1px;background:#eee;width:100%;margin-bottom:12px;"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h4 style="margin:0;font-size:14px;color:#666;display:inline-block;" id="btn-list-title">🔧 按钮管理</h4>
              <span id="btn-manage-device-label" style="display:inline-block;margin-left:10px;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">💻 PC 端</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button id="add-new-btn" style="padding:6px 12px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;" title="新增按钮">➕ 新增</button>
              <button id="reset-default-btn" style="padding:6px 12px;background:#ff9800;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;" title="恢复默认按钮">🔄 初始化</button>
              <button id="export-config-btn" style="padding:6px 12px;background:#4caf50;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;" title="导出配置">📤 导出</button>
              <button id="import-config-btn" style="padding:6px 12px;background:#2196f3;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;" title="导入配置">📥 导入</button>
            </div>
          </div>
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
      
      <!-- 导入配置对话框 -->
      <div id="import-config-dialog" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:20px;width:calc(100% - 40px);max-width:min(760px, 90vw);max-height:80vh;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          <h3 style="margin:0 0 20px 0;font-size:16px;color:#333;">📥 导入配置</h3>
          <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="import-clear-existing" style="cursor:pointer;">
              <span>清空当前所有按钮</span>
            </label>
            <textarea id="import-config-content" placeholder="请粘贴导出的配置 JSON 内容..." style="width:100%;min-height:180px;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace;resize:vertical;box-sizing:border-box;"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button id="import-cancel-btn" style="padding:8px 16px;background:#f5f5f5;color:#666;border:none;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
            <button id="import-confirm-btn" style="padding:8px 16px;background:#2196f3;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">导入</button>
          </div>
        </div>
      </div>
      
      <!-- 新增按钮对话框 -->
      <div id="add-new-dialog" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10002;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:20px;width:calc(100% - 40px);max-width:min(760px, 90vw);max-height:85vh;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 id="add-dialog-title" style="margin:0;font-size:16px;color:#333;">➕ 新增快捷按钮</h3>
            <button id="close-add-dialog" style="width:28px;height:28px;border-radius:50%;border:none;background:#f5f5f5;color:#666;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
          </div>
          <div id="add-new-form-container">
            <!-- 表单内容将通过 JS 动态插入 -->
          </div>
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
          <span style="font-size:20px;">${btn.emoji}</span>
          <span style="font-size:14px;">${btn.name}</span>
        </div>
        <div style="display:flex;gap:6px;">
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
    const closeBtn = document.getElementById("fc-close-settings");
    const savePcConfig = document.getElementById("save-pc-config");
    const saveMobileConfig = document.getElementById("save-mobile-config");
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
      const manageDeviceLabel = document.getElementById("btn-manage-device-label");
      if (manageDeviceLabel) manageDeviceLabel.innerText = "💻 PC 端";
      const btnListTitle = document.getElementById("btn-list-title");
      if (btnListTitle) btnListTitle.innerText = "🔧 按钮管理";
      if (btnValue) btnValue.placeholder = exampleTexts.selector;
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
      const manageDeviceLabel = document.getElementById("btn-manage-device-label");
      if (manageDeviceLabel) manageDeviceLabel.innerText = "📱 手机端";
      const btnListTitle = document.getElementById("btn-list-title");
      if (btnListTitle) btnListTitle.innerText = "🔧 按钮管理";
      if (btnValue) btnValue.placeholder = exampleTexts.selector;
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    });

    // 保存PC端配置
    savePcConfig?.addEventListener("click", () => {
      const width = parseInt(document.getElementById("fc-pc-width").value) || 140;
      const fontSize = parseInt(document.getElementById("fc-pc-font").value) || 14;
      const height = document.getElementById("fc-pc-height").value || "auto";
          
      panelConfig.pc = { width, fontSize, height };
          
      // 核心修复：确保配置对象完整
      const configData = {
        buttons: buttonConfig,
        panelConfig: panelConfig
      };
          
      // 保存到插件目录
      this.saveConfigToFile(configData);
      this.rebuildFloatButton();
      this.showToast("PC 端配置保存成功", "success");
    });

    // 保存手机端配置
    saveMobileConfig?.addEventListener("click", () => {
      const width = parseInt(document.getElementById("fc-mobile-width").value) || 300;
      const fontSize = parseInt(document.getElementById("fc-mobile-font").value) || 14;
      const height = document.getElementById("fc-mobile-height").value || "auto";
      
      panelConfig.mobile = { width, fontSize, height };
      
      // 核心修复：确保配置对象完整
      const configData = {
        buttons: buttonConfig,
        panelConfig: panelConfig
      };
      
      // 保存到插件目录
      this.saveConfigToFile(configData);
      this.rebuildFloatButton();
      this.showToast("手机端配置保存成功", "success");
    });
    
    // Emoji TAB 切换
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

    // 初始绑定 Emoji 选择事件
    this.bindEmojiSelectEvent();

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
          emoji,
          type,
          value,
          bgColor: this.formatColor(bgColor),
          color: this.formatColor(color),
          displayMode
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
          emoji,
          type,
          value,
          bgColor: this.formatColor(bgColor),
          color: this.formatColor(color),
          sort: buttonConfig.filter(btn => btn.targetTab === activeConfigTab).length,
          targetTab: activeConfigTab, // 只添加到当前端
          displayMode
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
      
      // 重新渲染按钮列表
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    });

    // 绑定按钮列表事件
    this.bindButtonListEvents();
  }

  // 创建新按钮（从新增对话框）
  createNewButton() {
    const name = document.getElementById("fc-btn-name")?.value || "";
    const type = document.getElementById("fc-btn-type")?.value || "selector";
    const value = document.getElementById("fc-btn-value")?.value || "";
    const displayMode = document.getElementById("fc-btn-display")?.value || "both";
    const bgColor = document.getElementById("fc-btn-bgcolor")?.value || "#f8f9fa";
    const color = document.getElementById("fc-btn-color")?.value || "#333333";
    const emoji = document.getElementById("fc-btn-emoji")?.value || "⚡";

    if (!name) {
      this.showToast("按钮名称不能为空", "error");
      return;
    }
    if (!value) {
      this.showToast("值不能为空", "error");
      return;
    }

    // 创建新按钮
    const newBtn = {
      name,
      emoji,
      type,
      value,
      bgColor: this.formatColor(bgColor),
      color: this.formatColor(color),
      sort: buttonConfig.filter(btn => btn.targetTab === activeConfigTab).length,
      targetTab: activeConfigTab, // 只添加到当前端
      displayMode
    };

    buttonConfig.push(newBtn);
    this.showToast(`按钮添加成功（${activeConfigTab === 'pc' ? 'PC 端' : '手机端'}）`, "success");

    // 保存到插件目录
    this.saveConfigToFile({
      buttons: buttonConfig,
      panelConfig: panelConfig
    });
    this.rebuildFloatButton();

    // 关闭新增对话框
    const addNewDialog = document.getElementById("add-new-dialog");
    if (addNewDialog) {
      addNewDialog.style.display = "none";
    }

    // 刷新按钮列表
    const btnListContainer = document.getElementById("btn-list-container");
    if (btnListContainer) {
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    }
  }

  // 更新现有按钮（从编辑对话框）
  updateExistingButton() {
    const name = document.getElementById("fc-btn-name")?.value || "";
    const type = document.getElementById("fc-btn-type")?.value || "selector";
    const value = document.getElementById("fc-btn-value")?.value || "";
    const displayMode = document.getElementById("fc-btn-display")?.value || "both";
    const bgColor = document.getElementById("fc-btn-bgcolor")?.value || "#f8f9fa";
    const color = document.getElementById("fc-btn-color")?.value || "#333333";
    const emoji = document.getElementById("fc-btn-emoji")?.value || "⚡";

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
        emoji,
        type,
        value,
        bgColor: this.formatColor(bgColor),
        color: this.formatColor(color),
        displayMode
      };
      
      // 只更新当前端的按钮
      buttonConfig = buttonConfig.map(btn => {
        if (btn.name === sourceBtnName && btn.targetTab === activeConfigTab) {
          return { ...btn, ...updatedBtn };
        }
        return btn;
      });
      
      editBtnIndex = -1;
      this.showToast("按钮已更新", "success");
    } else {
      this.showToast("编辑索引无效", "error");
      return;
    }

    // 保存到插件目录
    this.saveConfigToFile({
      buttons: buttonConfig,
      panelConfig: panelConfig
    });
    this.rebuildFloatButton();

    // 关闭新增对话框
    const addNewDialog = document.getElementById("add-new-dialog");
    if (addNewDialog) {
      addNewDialog.style.display = "none";
    }

    // 刷新按钮列表
    const btnListContainer = document.getElementById("btn-list-container");
    if (btnListContainer) {
      btnListContainer.innerHTML = this.renderButtonList();
      this.bindButtonListEvents();
    }
  }

  // 绑定 Emoji 选择事件
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
  
  // 绑定按钮列表事件（拖拽、编辑、删除等）
  bindButtonListEvents() {
    const btnListContainer = document.getElementById("btn-list-container");
    const btnItems = document.querySelectorAll("#btn-list-container [draggable='true']");
    const btnUp = document.querySelectorAll(".btn-up");
    const btnDown = document.querySelectorAll(".btn-down");
    const btnEdit = document.querySelectorAll(".btn-edit");
    const btnDelete = document.querySelectorAll(".btn-delete");
  
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
        
        // 设置编辑模式索引
        editBtnIndex = index;
        
        // 打开新增对话框并填充数据
        const addNewDialog = document.getElementById("add-new-dialog");
        const addDialogTitle = document.getElementById("add-dialog-title");
        const formContainer = document.getElementById("add-new-form-container");
        const currentTabLabel = activeConfigTab === 'pc' ? '💻 PC 端' : '📱 手机端';
        
        // 设置为编辑模式
        if (addDialogTitle) {
          addDialogTitle.innerText = "✏️ 编辑快捷按钮";
        }
        
        if (formContainer) {
          // 生成完整的编辑表单
          formContainer.innerHTML = `
            <div style="margin-bottom:15px;">
              <div style="display:flex;align-items:center;margin-bottom:12px;">
                <span style="display:inline-block;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">${currentTabLabel}</span>
                <span style="margin-left:10px;font-size:14px;color:#666;">✏️ 编辑按钮：<b style="color:#333;">${btnData.name}</b></span>
              </div>
              
              <!-- 基础信息 -->
              <div style="display:flex;gap:10px;margin-bottom:12px;">
                <input id="fc-btn-name" placeholder="按钮名称（如：直接新建文档）" style="flex:2;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;" value="${btnData.name}">
                <select id="fc-btn-type" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;min-width:100px;">
                  <option value="selector" ${btnData.type === 'selector' ? 'selected' : ''}>元素选择器</option>
                  <option value="document" ${btnData.type === 'document' ? 'selected' : ''}>文档 ID</option>
                  <option value="block" ${btnData.type === 'block' ? 'selected' : ''}>块 ID</option>
                </select>
              </div>
                      
              <!-- 选择器/ID 输入框 -->
              <div style="margin-bottom:12px;">
                <input id="fc-btn-value" placeholder="请输入元素选择器或 ID" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;" value="${btnData.value}">
              </div>
              
              <!-- 图标选择区域 -->
              <div style="margin-bottom:10px;">
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
                  <label style="font-size:12px;color:#666;">图标：</label>
                  <span style="font-size:12px;color:#999;">使用系统 Emoji</span>
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
                </div>
                
                <input type="hidden" id="fc-btn-emoji" value="${btnData.emoji}">
              </div>
              
              <!-- 显示模式和颜色选择 - 垂直排列 -->
              <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:15px;">
                <div style="width:100%;">
                  <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">显示模式</label>
                  <select id="fc-btn-display" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    <option value="both" ${btnData.displayMode === 'both' ? 'selected' : ''}>图标 + 文字</option>
                    <option value="text" ${btnData.displayMode === 'text' ? 'selected' : ''}>仅文字</option>
                    <option value="emoji" ${btnData.displayMode === 'emoji' ? 'selected' : ''}>仅图标</option>
                  </select>
                </div>
                <div style="width:100%;">
                  <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">背景色</label>
                  <input type="color" id="fc-btn-bgcolor" value="${btnData.bgColor}" style="width:100%;height:44px;border:1px solid #ddd;border-radius:6px;cursor:pointer;">
                </div>
                <div style="width:100%;">
                  <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">文字色</label>
                  <input type="color" id="fc-btn-color" value="${btnData.color}" style="width:100%;height:44px;border:1px solid #ddd;border-radius:6px;cursor:pointer;">
                </div>
                <div style="width:100%;margin-top:8px;">
                  <button id="confirm-add-btn" style="width:100%;padding:12px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;height:44px;">保存修改</button>
                </div>
              </div>
            </div>
          `;
          
          // 绑定 Emoji TAB 切换和选择事件
          this.bindEmojiSelectEvent();
          
          // 绑定 Emoji TAB 切换事件（新增对话框内）
          const emojiTabsInDialog = formContainer.querySelectorAll(".emoji-tab");
          const emojiContentInDialog = formContainer.querySelector("#emoji-content");
          emojiTabsInDialog.forEach(tab => {
            tab.addEventListener("click", () => {
              emojiTabsInDialog.forEach(t => {
                t.style.background = "transparent";
                t.style.color = "#666";
              });
              tab.style.background = "#e8f4ff";
              tab.style.color = "#1377EB";
              if (emojiContentInDialog) {
                emojiContentInDialog.innerHTML = this.renderEmojiTabContent(tab.dataset.category);
                this.bindEmojiSelectEvent();
              }
            });
          });
          
          // 高亮当前选中的 Emoji
          const emojiItems = formContainer.querySelectorAll("#emoji-content span[data-emoji]");
          emojiItems.forEach(item => {
            if (item.dataset.emoji === btnData.emoji) {
              item.style.background = "#e8f4ff";
              item.style.border = "2px solid #1377EB";
              item.style.borderRadius = "4px";
            } else {
              item.style.background = "transparent";
              item.style.border = "none";
            }
          });
          
          // 绑定确认添加按钮事件
          const confirmAddBtn = document.getElementById("confirm-add-btn");
          confirmAddBtn?.addEventListener("click", () => {
            this.updateExistingButton();
          });
        }
        
        if (addNewDialog) {
          addNewDialog.style.display = "block";
        }
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

    // ==================== 新增功能：初始化、导入导出 ====================
    
    // 初始化按钮（恢复默认）
    const resetDefaultBtn = document.getElementById("reset-default-btn");
    resetDefaultBtn?.addEventListener("click", () => {
      // 先移除已存在的旧对话框（如果有）
      const existingModal = document.querySelector('#reset-confirm-modal');
      if (existingModal && existingModal.parentNode) {
        document.body.removeChild(existingModal);
      }
      
      // 创建自定义确认对话框
      const confirmModal = document.createElement('div');
      confirmModal.id = 'reset-confirm-modal';
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
        border-radius: 12px;
        padding: 20px;
        width: calc(100% - 40px);
        max-width: min(760px, 90vw);
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      confirmDialog.innerHTML = `
        <h3 style="margin:0 0 16px 0;font-size:16px;color:#333;">⚠️ 确认初始化</h3>
        <p style="margin:0 0 20px 0;font-size:13px;color:#666;line-height:1.6;">
          此操作将清空当前所有自定义按钮，并恢复为默认配置。<br>
          <strong style="color:#ff4d4f;">此操作不可逆，请谨慎操作！</strong>
        </p>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="cancel-reset-btn" style="padding:8px 16px;background:#f5f5f5;color:#666;border:none;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
          <button id="confirm-reset-btn" style="padding:8px 16px;background:#ff4d4f;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">确定初始化</button>
        </div>
      `;
      
      confirmModal.appendChild(confirmDialog);
      document.body.appendChild(confirmModal);
      
      // 绑定取消按钮
      const cancelBtn = confirmModal.querySelector('#cancel-reset-btn');
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
      });
      
      // 绑定确认按钮
      const confirmBtn = confirmModal.querySelector('#confirm-reset-btn');
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // 恢复默认配置
        const defaultButtons = [
          // PC 端默认按钮
          {
            name: "命令面板",
            emoji: "⚡",
            type: "selector",
            value: "#barCommand",
            bgColor: "#e8f4ff",
            color: "#1377EB",
            sort: 0,
            targetTab: "pc",
            displayMode: "both"
          },
          {
            name: "立即同步",
            emoji: "🔄",
            type: "selector",
            value: "#barCommand|#commands > li:nth-child(52)",
            bgColor: "#e8f8e8",
            color: "#52c41a",
            sort: 1,
            targetTab: "pc",
            displayMode: "both"
          },
          {
            name: "新建日记",
            emoji: "📔",
            type: "selector",
            value: "#barCommand|#commands > li:nth-child(11)",
            bgColor: "#fff7e6",
            color: "#fa8c16",
            sort: 2,
            targetTab: "pc",
            displayMode: "both"
          },
          {
            name: "锁屏",
            emoji: "🔒",
            type: "selector",
            value: "#barCommand|#commands > li:nth-child(36)",
            bgColor: "#f5f5f5",
            color: "#666666",
            sort: 3,
            targetTab: "pc",
            displayMode: "both"
          },
          // 移动端默认按钮
          {
            name: "命令面板",
            emoji: "⚡",
            type: "selector",
            value: "#toolbarMore > use|#menuCommand",
            bgColor: "#e8f4ff",
            color: "#1377EB",
            sort: 0,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "立即同步",
            emoji: "🔄",
            type: "selector",
            value: "#toolbarMore > use|#menuSyncNow",
            bgColor: "#e8f8e8",
            color: "#52c41a",
            sort: 1,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "新建日记",
            emoji: "📔",
            type: "selector",
            value: "#toolbarMore > use|#menuNewDaily",
            bgColor: "#fff7e6",
            color: "#fa8c16",
            sort: 2,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "锁屏",
            emoji: "🔒",
            type: "selector",
            value: "#toolbarMore > use|#menuLock",
            bgColor: "#f5f5f5",
            color: "#666666",
            sort: 3,
            targetTab: "mobile",
            displayMode: "both"
          },
          {
            name: "退出",
            emoji: "🚪",
            type: "selector",
            value: "#toolbarMore > use|#menuSafeQuit",
            bgColor: "#fff0f0",
            color: "#ff4d4f",
            sort: 4,
            targetTab: "mobile",
            displayMode: "both"
          }
        ];
        
        buttonConfig = defaultButtons;
        
        // 保存到插件目录
        this.saveConfigToFile({
          buttons: buttonConfig,
          panelConfig: panelConfig
        });
        
        // 刷新按钮列表
        btnListContainer.innerHTML = this.renderButtonList();
        this.bindButtonListEvents();
        
        // 关闭对话框并移除 DOM
        if (confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
        
        // 提示成功
        this.showToast("已恢复为默认配置", "success");
      });
      
      // 点击背景关闭
      confirmModal.onclick = (e) => {
        if (e.target === confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
      };
    });
    
    // 导出配置
    const exportConfigBtn = document.getElementById("export-config-btn");
    exportConfigBtn?.addEventListener("click", () => {
      // 先移除已存在的旧对话框（如果有）
      const existingModal = document.querySelector('#export-config-modal');
      if (existingModal && existingModal.parentNode) {
        document.body.removeChild(existingModal);
      }
      
      // 只导出按钮配置
      const exportData = {
        buttons: buttonConfig
      };
      
      const jsonStr = JSON.stringify(exportData, null, 2);
      
      // 创建自定义对话框显示 JSON
      const confirmModal = document.createElement('div');
      confirmModal.id = 'export-config-modal';
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
        border-radius: 12px;
        padding: 20px;
        width: calc(100% - 40px);
        max-width: min(760px, 90vw);
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      confirmDialog.innerHTML = `
        <h3 style="margin:0 0 16px 0;font-size:16px;color:#333;">📤 导出配置</h3>
        <p style="margin:0 0 12px 0;font-size:13px;color:#666;">点击下方按钮复制配置，或手动选中文本复制：</p>
        <textarea id="export-textarea" readonly style="width:100%;min-height:250px;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace;resize:vertical;box-sizing:border-box;margin-bottom:16px;">${jsonStr}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="copy-export-btn" style="padding:8px 16px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">📋 复制配置</button>
          <button id="close-export-btn" style="padding:8px 16px;background:#f5f5f5;color:#666;border:none;border-radius:6px;cursor:pointer;font-size:13px;">关闭</button>
        </div>
      `;
      
      confirmModal.appendChild(confirmDialog);
      document.body.appendChild(confirmModal);
      
      // 绑定复制按钮
      const copyBtn = confirmModal.querySelector('#copy-export-btn');
      const textarea = confirmModal.querySelector('#export-textarea');
      
      copyBtn.addEventListener('click', () => {
        textarea.select();
        try {
          document.execCommand('copy');
          // 先关闭对话框
          if (confirmModal && confirmModal.parentNode) {
            document.body.removeChild(confirmModal);
          }
          // 延迟一点显示 Toast，确保它在最上层
          setTimeout(() => {
            this.showToast("配置已复制到剪贴板", "success");
          }, 10);
        } catch (err) {
          // 降级方案：使用现代 API
          navigator.clipboard.writeText(textarea.value).then(() => {
            // 先关闭对话框
            if (confirmModal && confirmModal.parentNode) {
              document.body.removeChild(confirmModal);
            }
            // 延迟一点显示 Toast，确保它在最上层
            setTimeout(() => {
              this.showToast("配置已复制到剪贴板", "success");
            }, 10);
          }).catch(() => {
            this.showToast("复制失败，请手动复制", "error");
          });
        }
      });
      
      // 绑定关闭按钮
      const closeBtn = confirmModal.querySelector('#close-export-btn');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
      });
      
      // 点击背景关闭
      confirmModal.onclick = (e) => {
        if (e.target === confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
      };
    });
    
    // 导入配置 - 改为动态创建对话框
    const importConfigBtn = document.getElementById("import-config-btn");
    
    importConfigBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      
      // 先移除已存在的旧对话框（如果有）
      const existingModal = document.querySelector('#import-config-modal');
      if (existingModal && existingModal.parentNode) {
        document.body.removeChild(existingModal);
      }
      
      // 创建自定义对话框
      const confirmModal = document.createElement('div');
      confirmModal.id = 'import-config-modal';
      confirmModal.style.cssText = 'display:block;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999998;';
      
      confirmModal.innerHTML = `
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:20px;width:calc(100% - 40px);max-width:min(760px, 90vw);max-height:80vh;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          <h3 style="margin:0 0 20px 0;font-size:16px;color:#333;">📥 导入配置</h3>
          <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="import-clear-existing" style="cursor:pointer;">
              <span>清空当前所有按钮</span>
            </label>
            <textarea id="import-config-content" placeholder="请粘贴导出的配置 JSON 内容..." style="width:100%;min-height:180px;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace;resize:vertical;box-sizing:border-box;"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button id="import-cancel-btn" style="padding:8px 16px;background:#f5f5f5;color:#666;border:none;border-radius:6px;cursor:pointer;font-size:13px;">取消</button>
            <button id="import-confirm-btn" style="padding:8px 16px;background:#2196f3;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">导入</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(confirmModal);
      
      // 绑定取消按钮
      const cancelBtn = confirmModal.querySelector('#import-cancel-btn');
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
      });
      
      // 绑定导入按钮
      const importBtn = confirmModal.querySelector('#import-confirm-btn');
      importBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const textarea = confirmModal.querySelector('#import-config-content');
        const jsonStr = textarea ? textarea.value.trim() : "";
        const clearExisting = confirmModal.querySelector('#import-clear-existing').checked;
        
        if (!jsonStr) {
          this.showToast("请输入配置内容", "error");
          return;
        }
        
        try {
          const importData = JSON.parse(jsonStr);
          
          // 验证数据格式
          if (!importData.buttons || !Array.isArray(importData.buttons)) {
            throw new Error("配置格式错误：缺少 buttons 数组");
          }
          
          if (clearExisting) {
            // 清空当前所有按钮
            buttonConfig = importData.buttons;
            this.showToast("已清空并导入配置", "success");
          } else {
            // 合并配置（添加新按钮）
            const existingKeys = buttonConfig.map(btn => `${btn.name}-${btn.targetTab}`);
            const newButtons = importData.buttons.filter(btn => {
              const key = `${btn.name}-${btn.targetTab}`;
              return !existingKeys.includes(key);
            });
            
            if (newButtons.length === 0) {
              this.showToast("没有新的按钮可导入", "warning");
              return;
            }
            
            buttonConfig = buttonConfig.concat(newButtons);
            this.showToast(`成功导入 ${newButtons.length} 个按钮`, "success");
          }
          
          // 保存配置
          this.saveConfigToFile({
            buttons: buttonConfig,
            panelConfig: panelConfig
          });
          
          // 刷新按钮列表
          btnListContainer.innerHTML = this.renderButtonList();
          this.bindButtonListEvents();
          
          // 关闭对话框
          if (confirmModal && confirmModal.parentNode) {
            document.body.removeChild(confirmModal);
          }
          
          // 重新生成悬浮按钮
          this.rebuildFloatButton();
          
        } catch (error) {
          this.showToast(`导入失败：${error.message}`, "error");
        }
      });
      
      // 点击背景关闭
      confirmModal.onclick = (e) => {
        if (e.target === confirmModal && confirmModal.parentNode) {
          document.body.removeChild(confirmModal);
        }
      };
    });
    
    // ==================== 新增按钮功能 ====================
    const addNewBtn = document.getElementById("add-new-btn");
    const addNewDialog = document.getElementById("add-new-dialog");
    const closeAddDialog = document.getElementById("close-add-dialog");
    const addDialogTitle = document.getElementById("add-dialog-title");
    
    // 点击新增按钮
    addNewBtn?.addEventListener("click", () => {
      if (addNewDialog) {
        // 设置为新增模式
        if (addDialogTitle) {
          addDialogTitle.innerText = "➕ 新增快捷按钮";
        }
        
        // 生成完整的按钮创建表单
        const formContainer = document.getElementById("add-new-form-container");
        const currentTabLabel = activeConfigTab === 'pc' ? '💻 PC 端' : '📱 手机端';
        
        if (formContainer) {
          formContainer.innerHTML = `
            <div style="margin-bottom:15px;">
              <div style="display:flex;align-items:center;margin-bottom:12px;">
                <span style="display:inline-block;padding:4px 12px;background:#e8f4ff;color:#1377EB;border-radius:6px;font-size:13px;font-weight:500;">${currentTabLabel}</span>
              </div>
              
              <!-- 基础信息 -->
              <div style="margin-bottom:12px;">
                <input id="fc-btn-name" placeholder="按钮名称（如：直接新建文档）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:10px;">
                <select id="fc-btn-type" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                  <option value="selector" selected>元素选择器</option>
                  <option value="document">文档 ID</option>
                  <option value="block">块 ID</option>
                </select>
              </div>
                      
              <!-- 选择器/ID 输入框 -->
              <div style="margin-bottom:12px;">
                <input id="fc-btn-value" placeholder="请输入元素选择器或 ID" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
              </div>
              
              <!-- 图标选择区域 -->
              <div style="margin-bottom:10px;">
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
                  <label style="font-size:12px;color:#666;">图标：</label>
                  <span style="font-size:12px;color:#999;">使用系统 Emoji</span>
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
                </div>
                
                <input type="hidden" id="fc-btn-emoji" value="⚡">
              </div>
              
              <!-- 显示模式和颜色选择 - 垂直排列 -->
              <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:15px;">
                <div style="width:100%;">
                  <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">显示模式</label>
                  <select id="fc-btn-display" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    <option value="both" selected>图标 + 文字</option>
                    <option value="text">仅文字</option>
                    <option value="emoji">仅图标</option>
                  </select>
                </div>
                <div style="width:100%;">
                  <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">背景色</label>
                  <input type="color" id="fc-btn-bgcolor" value="#f8f9fa" style="width:100%;height:44px;border:1px solid #ddd;border-radius:6px;cursor:pointer;">
                </div>
                <div style="width:100%;">
                  <label style="font-size:12px;color:#666;display:block;margin-bottom:6px;">文字色</label>
                  <input type="color" id="fc-btn-color" value="#333333" style="width:100%;height:44px;border:1px solid #ddd;border-radius:6px;cursor:pointer;">
                </div>
                <div style="width:100%;margin-top:8px;">
                  <button id="confirm-add-btn" style="width:100%;padding:12px;background:#1377EB;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;height:44px;">确认添加</button>
                </div>
              </div>
            </div>
          `;
          
          // 绑定 Emoji TAB 切换和选择事件
          this.bindEmojiSelectEvent();
          
          // 绑定 Emoji TAB 切换事件（新增对话框内）
          const emojiTabsInDialog = formContainer.querySelectorAll(".emoji-tab");
          const emojiContentInDialog = formContainer.querySelector("#emoji-content");
          emojiTabsInDialog.forEach(tab => {
            tab.addEventListener("click", () => {
              emojiTabsInDialog.forEach(t => {
                t.style.background = "transparent";
                t.style.color = "#666";
              });
              tab.style.background = "#e8f4ff";
              tab.style.color = "#1377EB";
              if (emojiContentInDialog) {
                emojiContentInDialog.innerHTML = this.renderEmojiTabContent(tab.dataset.category);
                this.bindEmojiSelectEvent();
              }
            });
          });
          
          // 绑定确认添加按钮事件
          const confirmAddBtn = document.getElementById("confirm-add-btn");
          confirmAddBtn?.addEventListener("click", () => {
            this.createNewButton();
          });
        }
        addNewDialog.style.display = "block";
      }
    });
    
    // 关闭新增对话框
    closeAddDialog?.addEventListener("click", () => {
      if (addNewDialog) {
        addNewDialog.style.display = "none";
      }
    });
    
    // 点击背景关闭
    addNewDialog?.addEventListener("click", (e) => {
      if (e.target === addNewDialog) {
        addNewDialog.style.display = "none";
      }
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
    <div class="tab-item" data-tab="donate">💖 赞赏支持</div>
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
      <h3 style="margin-top: 0;">🎯 方寸工具箱</h3>
      <p style="font-size: 14px; color: #666; line-height: 1.8;">
        一款为 <a href="https://b3log.org/siyuan/" target="_blank" style="color: #1377EB; text-decoration: none;">思源笔记</a> 打造的便捷工具箱插件，通过在屏幕右侧显示悬浮按钮，让你能够快速访问常用功能，提升笔记效率。
      </p>
      
      <h4 style="margin: 20px 0 10px 0; color: #333;">✨ 主要功能</h4>
      <ul style="padding-left: 20px; margin: 10px 0; line-height: 2;">
        <li><strong>悬浮快捷按钮：</strong>屏幕右侧悬浮，不遮挡笔记内容，随时可用</li>
        <li><strong>展开面板：</strong>一键打开常用功能面板，快速访问复制、收藏、导出等功能</li>
        <li><strong>自定义配置：</strong>TAB 式设置界面，支持颜色定制和样式调整</li>
        <li><strong>按钮管理：</strong>支持新增、编辑、删除快捷按钮，可导入导出配置</li>
        <li><strong>跨端适配：</strong>PC 端和移动端自动适配，完美支持各种设备</li>
      </ul>
      
      <h4 style="margin: 20px 0 10px 0; color: #333;">📦 技术特性</h4>
      <ul style="padding-left: 20px; margin: 10px 0; line-height: 2;">
        <li>✅ 跨平台支持：Windows / macOS / Linux / 移动端</li>
        <li>✅ 响应式设计：自适应不同屏幕尺寸</li>
        <li>✅ 本地存储：配置保存在本地，隐私安全</li>
        <li>✅ 低性能开销：轻量级实现，不影响思源笔记性能</li>
      </ul>
      
      <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #1377EB;">
        <p style="margin: 0; font-size: 13px; color: #666;">
          <strong>👨‍💻 作者：</strong>逆念<br>
          <strong>📧 QQ：</strong>499778277<br>
          <strong>👥 QQ 群：</strong>1091650569<br>
          <strong>🌐 主页：</strong><a href="https://ycb.cc" target="_blank" style="color: #1377EB; text-decoration: none;">HTTPS://YCB.CC</a><br>
          <strong>📄 许可证：</strong>MIT License
        </p>
      </div>
      
      <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">
        © 2026 方寸工具箱 | 版本：1.0.0
      </p>
    </div>
  </div>
  
  <!-- 赞赏支持 TAB -->
  <div class="tab-content" data-tab-content="donate">
    <div style="max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 40px; color: white; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4); text-align: center;">
        <h3 style="margin: 0 0 10px 0; font-size: 24px;">
          💖 赞赏支持
        </h3>
        <p style="font-size: 15px; margin-bottom: 30px; opacity: 0.95; line-height: 1.6;">
          如果这个插件对你有帮助，<br>欢迎请作者喝杯可乐 🥤
        </p>
        <div style="background: white; border-radius: 12px; padding: 35px; display: inline-block; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
          <img id="donate-qrcode" alt="打赏码" style="width: 360px; height: 500px; display: block; object-fit: contain;">
        </div>
        <p style="font-size: 14px; margin-top: 25px; opacity: 0.9;">
          感谢你的支持！ 🙏
        </p>
        <p style="font-size: 12px; margin-top: 15px; opacity: 0.7;">
          您的每一份支持，都是我继续优化的动力
        </p>
      </div>
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
      
      // 打赏码 Base64 数据
      const donateQrCodeBase64 = "data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAA8AAD/4QN/aHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA5LjEtYzAwMyA3OS45NjkwYTg3ZmMsIDIwMjUvMDMvMDYtMjA6NTA6MTYgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9IjM5OTNCNjIwMzMzQ0FDQjUzOTc2NDcxQUNGNDhBQjU2IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkJCREIxREM3MjdBRDExRjFCQzkxOEVGNzM5MTk4ODAxIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkJCREIxREM2MjdBRDExRjFCQzkxOEVGNzM5MTk4ODAxIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCAyMDI1IFdpbmRvd3MiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDowZjhiNDVhMC1kODI2LWVhNGYtODdiMy0yOGUzMzU1N2Y5MTIiIHN0UmVmOmRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo1OTY4YWFhNy0wNzJjLTEyNGEtOGQ3Yy00NGQ1ZGEwNDQ2MTgiLz4gPC9yZGY6RGVzY3JpcHRpb24+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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE3oIBd6iQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATeggF3qJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABN6CBVUXFdhZgUwXmJQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQMF5hQVRFxTYWIEwH6U+dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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";
      
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
            
            // 如果是赞赏支持 TAB，动态设置打赏码图片
            if (tabName === 'donate') {
              const qrcodeImg = document.getElementById('donate-qrcode');
              if (qrcodeImg && !qrcodeImg.src) {
                qrcodeImg.src = donateQrCodeBase64;
              }
            }
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