/**
 * 即梦账号管理服务
 * 负责账号存储、积分查询、Cookie 管理
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const JIMENG_BASE = 'https://jimeng.jianying.com';

/**
 * 从 storage-state.json 读取 jimeng 的 cookie 字符串
 */
function getCookiesFromStorageState(userDataDir) {
  const statePath = path.join(userDataDir, 'storage-state.json');
  if (!fs.existsSync(statePath)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const cookies = (state.cookies || [])
      .filter(c => c.domain && c.domain.includes('jimeng'))
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    return cookies || null;
  } catch { return null; }
}

/**
 * Node.js 原生 HTTPS GET（不依赖浏览器）
 */
function httpsGet(url, cookie) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'Cookie': cookie },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 401) return resolve({ success: false, error: '未登录', isLoggedIn: false });
        if (!res.statusCode || res.statusCode >= 400) return resolve({ success: false, error: `HTTP ${res.statusCode}` });
        try { resolve({ success: true, data: JSON.parse(body) }); }
        catch { resolve({ success: false, error: '解析响应失败' }); }
      });
    });
    req.on('error', err => reject(err));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

class AccountManager {
  constructor(userDataPath, browserManager) {
    this.userDataPath = userDataPath;
    this.browserManager = browserManager;
    this.userDataDir = path.join(userDataPath, 'jimeng-profile');
    this.accountsFile = path.join(userDataPath, 'accounts.json');
    this.accounts = null;
    this.activeAccountId = null;
    this._loadAccounts();
  }

  /**
   * 加载账号列表（从 accounts.json）
   */
  _loadAccounts() {
    try {
      if (fs.existsSync(this.accountsFile)) {
        const data = JSON.parse(fs.readFileSync(this.accountsFile, 'utf8'));
        this.accounts = data.accounts || [];
        this.activeAccountId = data.activeAccountId || null;
      } else {
        this.accounts = [];
        this.activeAccountId = null;
      }
    } catch (err) {
      console.warn('[账号管理] 加载账号列表失败:', err.message);
      this.accounts = [];
      this.activeAccountId = null;
    }
  }

  /**
   * 保存账号列表（到 accounts.json）
   */
  _saveAccounts() {
    try {
      const data = {
        accounts: this.accounts,
        activeAccountId: this.activeAccountId,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.accountsFile, JSON.stringify(data, null, 2));
      console.log('[账号管理] 账号列表已保存');
    } catch (err) {
      console.error('[账号管理] 保存账号列表失败:', err.message);
    }
  }

  /**
   * 获取账号列表 + 当前激活账号
   */
  listAccounts() {
    return {
      accounts: this.accounts.map(acc => ({
        id: acc.id,
        nickname: acc.nickname,
        avatarUrl: acc.avatarUrl,
        addedAt: acc.addedAt,
        isActive: acc.id === this.activeAccountId,
      })),
      activeAccountId: this.activeAccountId,
    };
  }

  /**
   * 查询当前账号的积分余额
   * 使用即梦官方 CLI (dreamina user_credit)
   */
  async getCredits() {
    const DREAMINA_BIN = path.join(process.env.HOME, '.local', 'bin', 'dreamina');
    try {
      const { stdout } = await execFileAsync(DREAMINA_BIN, ['user_credit'], { timeout: 15000 });
      const raw = JSON.parse(stdout.trim());
      const creditData = {
        vipCredit: raw.vip_credit || 0,
        giftCredit: raw.gift_credit || 0,
        purchaseCredit: raw.purchase_credit || 0,
        totalCredit: raw.total_credit || 0,
        fetchedAt: Date.now(),
      };
      console.log('[账号管理] 积分查询成功(CLI):', creditData);
      if (this.activeAccountId) {
        const acc = this.accounts.find(a => a.id === this.activeAccountId);
        if (acc) { acc.creditsCache = creditData; this._saveAccounts(); }
      }
      return { success: true, data: creditData };
    } catch (err) {
      const msg = err.stderr || err.message || '';
      if (msg.includes('not logged in') || msg.includes('login')) {
        return { success: false, error: '未登录，请先在设置页登录即梦' };
      }
      console.error('[账号管理] CLI 积分查询失败:', msg);
      return { success: false, error: `积分查询失败: ${msg.slice(0, 100)}` };
    }
  }

  /**
   * 切换账号
   * 1. 保存当前账号的 cookie
   * 2. 清除所有 cookie
   * 3. 注入目标账号的 cookie
   * 4. 刷新页面
   */
  async switchAccount(accountId) {
    const targetAccount = this.accounts.find(a => a.id === accountId);
    if (!targetAccount) {
      return { success: false, error: '账号不存在' };
    }

    if (!this.browserManager || !this.browserManager.isReady()) {
      return { success: false, error: '浏览器未就绪' };
    }

    const context = this.browserManager.context;
    if (!context) {
      return { success: false, error: '浏览器 context 未初始化' };
    }

    try {
      const page = this.browserManager.getPage();

      // 1. 保存当前账号的 cookie（如果有）
      if (this.activeAccountId) {
        const currentAccount = this.accounts.find(a => a.id === this.activeAccountId);
        if (currentAccount) {
          try {
            const cookies = await context.cookies();
            currentAccount.sessionData = { cookies };
            console.log(`[账号管理] 已保存账号 ${currentAccount.nickname} 的 cookie`);
          } catch (err) {
            console.warn('[账号管理] 保存当前账号 cookie 失败:', err.message);
          }
        }
      }

      // 2. 清除所有 cookie
      await context.clearCookies();
      console.log('[账号管理] 已清除浏览器 cookie');

      // 3. 注入目标账号的 cookie
      if (targetAccount.sessionData && targetAccount.sessionData.cookies) {
        await context.addCookies(targetAccount.sessionData.cookies);
        console.log(`[账号管理] 已注入账号 ${targetAccount.nickname} 的 cookie`);
      } else {
        console.warn(`[账号管理] 账号 ${targetAccount.nickname} 无 cookie，需要重新登录`);
      }

      // 4. 刷新页面
      if (page) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log('[账号管理] 页面已刷新');
      }

      // 5. 更新激活账号
      this.activeAccountId = accountId;
      this._saveAccounts();

      return {
        success: true,
        accountId,
        nickname: targetAccount.nickname,
        hasCookie: targetAccount.sessionData && targetAccount.sessionData.cookies.length > 0,
      };
    } catch (err) {
      console.error('[账号管理] 切换账号失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 添加新账号（触发扫码登录流程）
   * 1. 保存当前账号 cookie
   * 2. 清除 cookie，让用户重新登录
   * 3. 登录成功后保存新账号
   */
  async addAccount() {
    if (!this.browserManager || !this.browserManager.isReady()) {
      return { success: false, error: '浏览器未就绪' };
    }

    const context = this.browserManager.context;
    const page = this.browserManager.getPage();

    try {
      // 保存当前账号的 cookie（如果有）
      if (this.activeAccountId) {
        const currentAccount = this.accounts.find(a => a.id === this.activeAccountId);
        if (currentAccount) {
          try {
            const cookies = await context.cookies();
            currentAccount.sessionData = { cookies };
            this._saveAccounts();
            console.log(`[账号管理] 已保存账号 ${currentAccount.nickname} 的 cookie`);
          } catch (err) {
            console.warn('[账号管理] 保存当前账号 cookie 失败:', err.message);
          }
        }
      }

      // 清除所有 cookie，让用户重新登录
      await context.clearCookies();
      console.log('[账号管理] 已清除浏览器 cookie，等待用户扫码登录');

      // 刷新页面，触发登录界面
      if (page) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      }

      return {
        success: true,
        message: '请扫码登录新账号',
        waitForLogin: true,
      };
    } catch (err) {
      console.error('[账号管理] 添加账号失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 保存登录后的账号（登录成功后调用）
   */
  async saveNewAccount(nickname = '新账号') {
    if (!this.browserManager || !this.browserManager.isReady()) {
      return { success: false, error: '浏览器未就绪' };
    }

    const context = this.browserManager.context;
    if (!context) {
      return { success: false, error: '浏览器 context 未初始化' };
    }

    try {
      // 获取当前 cookie
      const cookies = await context.cookies();
      if (!cookies || cookies.length === 0) {
        return { success: false, error: '未检测到登录态' };
      }

      // 生成账号 ID
      const id = `acc_${Date.now().toString(36)}`;
      const newAccount = {
        id,
        nickname,
        avatarUrl: '',
        sessionData: { cookies },
        addedAt: new Date().toISOString(),
        creditsCache: null,
      };

      this.accounts.push(newAccount);
      this.activeAccountId = id;
      this._saveAccounts();

      console.log(`[账号管理] 新账号 ${nickname} 已保存，ID: ${id}`);

      return {
        success: true,
        account: {
          id,
          nickname,
          avatarUrl: '',
          addedAt: newAccount.addedAt,
          isActive: true,
        },
      };
    } catch (err) {
      console.error('[账号管理] 保存新账号失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 删除账号
   */
  removeAccount(accountId) {
    const index = this.accounts.findIndex(a => a.id === accountId);
    if (index === -1) {
      return { success: false, error: '账号不存在' };
    }

    // 如果删除的是当前激活账号，先切换到其他账号
    if (accountId === this.activeAccountId) {
      const remaining = this.accounts.filter(a => a.id !== accountId);
      this.activeAccountId = remaining.length > 0 ? remaining[0].id : null;
      console.log(`[账号管理] 删除激活账号，自动切换到 ${this.activeAccountId || '无账号'}`);
    }

    this.accounts.splice(index, 1);
    this._saveAccounts();

    console.log(`[账号管理] 账号 ${accountId} 已删除`);
    return { success: true };
  }

  /**
   * 检查账号登录状态
   */
  async checkAccountLogin(accountId) {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) {
      return { success: false, error: '账号不存在', isLoggedIn: false };
    }

    // 快速检查：通过积分 API 判断
    if (accountId === this.activeAccountId) {
      const result = await this.getCredits();
      return {
        success: true,
        isLoggedIn: result.success,
        error: result.error,
      };
    }

    // 非当前账号：检查 cookie 是否存在（不保证有效性）
    const hasCookie = account.sessionData && account.sessionData.cookies && account.sessionData.cookies.length > 0;
    return {
      success: true,
      isLoggedIn: hasCookie ? 'unknown' : false, // unknown 表示需要切换后验证
      hasCookie,
    };
  }

  /**
   * 更新账号昵称
   */
  updateNickname(accountId, nickname) {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) {
      return { success: false, error: '账号不存在' };
    }

    account.nickname = nickname;
    this._saveAccounts();
    return { success: true };
  }

  /**
   * 获取当前账号信息
   */
  getCurrentAccount() {
    if (!this.activeAccountId) return null;
    return this.accounts.find(a => a.id === this.activeAccountId);
  }
}

module.exports = { AccountManager };