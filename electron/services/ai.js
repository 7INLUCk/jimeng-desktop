const https = require('https');

// 即梦提示词改写系统 Prompt（普通模式，适配 Seedance 2.0）
const SYSTEM_PROMPT = `你是即梦 Seedance 2.0 的提示词优化专家。

用户会用自然语言描述想要生成的内容。你的任务不是翻译，而是把用户的模糊需求改写成能让 Seedance 2.0 生成最佳效果的提示词。

## 输出格式（严格 JSON）
{
  "prompt": "优化后的提示词",
  "duration": 5,
  "aspectRatio": "16:9",
  "type": "video",
  "style": "写实"
}

## 改写原则
1. 用中文写，Seedance 2.0 原生支持中文
2. 不要翻译用户的内容，而是**丰富和优化**：补充画面细节、运镜方式、光影氛围、风格质感
3. 结构：主体 + 动作 + 场景 + 光线 + 风格 + 运镜
4. 具体可视觉化，避免抽象描述（❌"好看的" → ✅"晨光透过树叶的丁达尔效应"）
5. 强调运动和时间维度（视频生成需要动态描述）
6. 默认生成视频（type: "video"），用户明确说"图片/照片"时用 "image"
7. 默认 5 秒，用户明确指定其他时长时调整
8. 默认 16:9 横屏，用户说"竖屏/手机"时用 "9:16"
9. 控制在 100 字以内，精炼有力

## 示例
用户："帮我生成一段猫咪在樱花树下奔跑的视频"
输出：{"prompt": "一只橘猫在樱花隧道中奔跑，花瓣随风飘落，温暖的金色阳光透过花枝洒下，浅景深柔焦背景，电影级慢镜头，4K画质，暖色调", "duration": 5, "aspectRatio": "16:9", "type": "video", "style": "写实"}

用户："一张赛博朋克风格的城市夜景图"
输出：{"prompt": "赛博朋克未来都市夜景，霓虹灯在湿漉漉的街道上反射，摩天大楼表面投射全息广告，远处有飞行器穿梭，细雨蒙蒙，阴郁氛围，银翼杀手风格，电影构图", "duration": null, "aspectRatio": "16:9", "type": "image", "style": "赛博朋克"}
`;

// Seedance 2.0 全能参考模式提示词改写系统 Prompt（有素材时使用 @引用格式）
const SEEDANCE_SYSTEM_PROMPT = `你是即梦 Seedance 2.0「全能参考」模式的提示词专家。

用户会上传素材（图片、视频、音频）并用自然语言描述需求。你需要将其改写为专业的 @引用格式提示词。

## 输出格式（严格 JSON）
{
  "prompt": "带@引用的中文提示词",
  "reason": "改写理由（简洁说明为什么这样写）",
  "duration": 5,
  "aspectRatio": "16:9"
}

## 素材编号规则（必须遵守）
素材编号按类型独立计数：
- @图片1 = 第1张图片，@图片2 = 第2张图片（图片单独计数）
- @视频1 = 第1个视频，@视频2 = 第2个视频（视频单独计数）
- @音频1 = 第1个音频（音频单独计数）
- 绝对不能跨类型混用编号（如不能出现"@视频3"而实际只上传了1个视频）

## 从文件名推断素材内容
用户消息中会列出每个素材的文件名。你需要根据文件名猜测素材的大致内容，并合理分配职责。
- 例：文件名「portrait_girl.jpg」→ 人物照片 → 负责人物形象
- 例：文件名「dance_ref.mp4」→ 舞蹈参考视频 → 负责动作/运镜
- 例：文件名「bgm_happy.mp3」→ 背景音乐 → 负责节奏/氛围
- 文件名不明确时，按类型默认推断（图片→外貌/场景，视频→动作/运镜，音频→配乐）

## @引用职责分配
- @图片N：负责人物形象、穿着、外貌特征、背景场景、画面风格
- @视频N：只负责动作、运镜、节奏、转场（不涉及外貌）
- @音频N：负责配乐、音效、对话音色

## @引用可读化规则（必须遵守）
每次使用 @引用时，必须在后面加括号说明该素材的内容摘要。
格式：@图片1（红裙女生）、@视频1（街舞动作）、@音频1（欢快BGM）
括号内用简短中文描述素材核心内容（3-8个字），这是你根据文件名推断出来的内容描述。

## 提示词写作规则
1. 用中文写，即梦支持中文
2. 明确每个 @引用素材的职责，不混用
3. 保持简洁，不要冗余描述
4. 有视频素材时，强调「参考 @视频N（描述）的动作/运镜」
5. 有图片素材时，强调「保持 @图片N（描述）的形象/背景」
6. 多素材场景必须指定「谁做什么」，不要让模型猜
7. 默认 5 秒，用户明确指定其他时长时调整
8. 默认 16:9 横屏，用户说「竖屏/手机」时用 9:16
9. 无素材时直接写纯文本创意提示词

## 示例

用户消息：
让这个人跳舞
## 已上传素材
- @图片1：文件名「girl_portrait.jpg」
- @视频1：文件名「street_dance.mp4」

输出：
{
  "prompt": "保持 @图片1（女生人像）的人物外貌、穿着和背景完全不变。参考 @视频1（街舞动作）的运镜节奏，人物流畅完成整套舞蹈。",
  "reason": "图片1负责人物形象，视频1只负责动作参考，职责明确。",
  "duration": 5,
  "aspectRatio": "9:16"
}

用户消息：
让这个人换上这件衣服，照着视频跳舞
## 已上传素材
- @图片1：文件名「girl.jpg」
- @图片2：文件名「dress_red.jpg」
- @视频1：文件名「dance.mp4」

输出：
{
  "prompt": "使用 @图片1（女生照片）作为人物参考，保持人物外貌和背景不变。人物穿着换成 @图片2（红色连衣裙）中的衣服。参考 @视频1（舞蹈动作）的节奏和运镜完成整套舞蹈。",
  "reason": "图片1=人物，图片2=换装，视频1=动作，三个职责明确分开。",
  "duration": 5,
  "aspectRatio": "9:16"
}

用户消息：
做一个音乐卡点视频
## 已上传素材
- @图片1：文件名「scenery_beach.jpg」
- @音频1：文件名「bgm.mp3」

输出：
{
  "prompt": "以 @图片1（海边风景）的场景为画面基础，根据 @音频1（背景音乐）的节奏进行镜头切换和动态展示，画面随音乐律动。",
  "reason": "图片做视觉基础，音频控制节奏卡点。",
  "duration": 10,
  "aspectRatio": "16:9"
}`;

class AIService {
  constructor(apiKey, model) {
    // 使用 DeepSeek API
    this.apiKey = apiKey || 'sk-4b2f09aa14204571b1b33a5d97839a63';
    this.model = model || 'deepseek-chat';
    this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
  }

  async rewritePrompt(userInput) {
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userInput }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'API 错误'));
              return;
            }
            const content = json.choices?.[0]?.message?.content;
            if (!content) {
              reject(new Error('AI 返回空内容'));
              return;
            }

            // 尝试从内容中提取 JSON
            const task = this._parseResponse(content);
            resolve(task);
          } catch (err) {
            reject(new Error(`解析失败: ${err.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * 智能推断素材用途
   * 
   * @param {string} userInput - 用户输入的需求
   * @param {Array} materials - 素材列表 [{type, name, path}]
   * @returns {Array} 推断后的素材列表 [{type, name, path, description, role}]
   */
  inferMaterialUsage(userInput, materials) {
    if (!materials || materials.length === 0) return [];

    const rules = [
      { keywords: ['跳舞', '舞蹈', '动作'], imageRole: '人物形象', videoRole: '舞蹈动作参考' },
      { keywords: ['换衣服', '穿搭', '衣服'], imageRole: '人物', image2Role: '衣服样式' },
      { keywords: ['换背景', '场景', '背景'], imageRole: '人物', image2Role: '背景场景' },
      { keywords: ['说话', '口播', '讲解', '配音'], imageRole: '人物形象', audioRole: '配音参考' },
      { keywords: ['唱歌', '演唱'], imageRole: '人物形象', audioRole: '歌曲参考' },
    ];

    // 匹配规则
    let matchedRule = null;
    for (const rule of rules) {
      if (rule.keywords.some(k => userInput.includes(k))) {
        matchedRule = rule;
        break;
      }
    }

    // 如果没有匹配，使用默认推断
    if (!matchedRule) {
      matchedRule = { imageRole: '参考图片', videoRole: '参考视频', audioRole: '参考音频' };
    }

    // 应用推断
    let imageIndex = 0;
    let videoIndex = 0;
    let audioIndex = 0;

    return materials.map((m, i) => {
      let description = m.name;
      let role = '';

      if (m.type === 'image') {
        imageIndex++;
        role = imageIndex === 1 ? matchedRule.imageRole : (matchedRule.image2Role || '参考图片');
        description = role;
      } else if (m.type === 'video') {
        videoIndex++;
        role = matchedRule.videoRole || '参考视频';
        description = role;
      } else if (m.type === 'audio') {
        audioIndex++;
        role = matchedRule.audioRole || '参考音频';
        description = role;
      }

      return { ...m, description, role };
    });
  }

  /**
   * 判断是否需要追问用户
   * 
   * @param {string} userInput - 用户输入
   * @param {Array} materials - 素材列表
   * @returns {boolean} 是否需要追问
   */
  needsClarification(userInput, materials) {
    // 单素材不需要追问
    if (!materials || materials.length <= 1) return false;

    // 多素材 + 需求模糊时追问
    const vagueKeywords = ['帮我', '做一个', '弄个', '搞个', '生成'];
    const hasVagueKeyword = vagueKeywords.some(k => userInput.includes(k));
    const hasSpecificKeyword = ['跳舞', '换衣服', '换背景', '唱歌', '说话'].some(k => userInput.includes(k));

    // 多素材 + 没有具体关键词 = 需要追问
    return hasVagueKeyword && !hasSpecificKeyword;
  }

  /**
   * 生成追问问题
   * 
   * @param {Array} materials - 素材列表
   * @returns {Object} 追问内容 {questions, options}
   */
  generateClarificationQuestions(materials) {
    const images = materials.filter(m => m.type === 'image');
    const videos = materials.filter(m => m.type === 'video');

    const questions = [];

    if (images.length > 1) {
      questions.push({
        id: 'mainImage',
        text: '哪张图片是主要人物？',
        options: images.map((m, i) => ({ label: `图片${i + 1}`, value: i }))
      });
    }

    if (videos.length > 0) {
      questions.push({
        id: 'videoRole',
        text: '视频是用来做什么的？',
        options: [
          { label: '动作参考', value: 'motion' },
          { label: '场景参考', value: 'scene' },
          { label: '其他', value: 'other' }
        ]
      });
    }

    return questions;
  }

  /**
   * 把 materials 对象 {images, videos, audios} 转成带正确编号和文件名的素材说明字符串
   */
  _buildMaterialContext(materials) {
    const images = materials.images || [];
    const videos = materials.videos || [];
    const audios = materials.audios || [];

    if (images.length === 0 && videos.length === 0 && audios.length === 0) {
      return null;
    }

    const lines = [];
    images.forEach((m, i) => {
      const hint = m.filename && m.filename !== m.name ? `文件名「${m.filename}」` : '（图片）';
      lines.push(`- @图片${i + 1}：${hint}`);
    });
    videos.forEach((m, i) => {
      const hint = m.filename && m.filename !== m.name ? `文件名「${m.filename}」` : '（视频）';
      lines.push(`- @视频${i + 1}：${hint}`);
    });
    audios.forEach((m, i) => {
      const hint = m.filename && m.filename !== m.name ? `文件名「${m.filename}」` : '（音频）';
      lines.push(`- @音频${i + 1}：${hint}`);
    });

    return `## 已上传素材（请根据文件名推断内容，为每个素材分配合理职责）\n${lines.join('\n')}`;
  }

  async rewritePromptForSeedance(userInput, materials = { images: [], videos: [], audios: [] }) {
    const materialContext = this._buildMaterialContext(materials);
    const userContent = materialContext
      ? `${userInput}\n\n${materialContext}`
      : userInput;

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: SEEDANCE_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'API 错误'));
              return;
            }
            const content = json.choices?.[0]?.message?.content;
            if (!content) {
              reject(new Error('AI 返回空内容'));
              return;
            }

            const task = this._parseResponse(content);
            // 确保有 reason 字段
            if (!task.reason) {
              task.reason = '已根据你的需求优化提示词';
            }
            resolve(task);
          } catch (err) {
            reject(new Error(`解析失败: ${err.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  _parseResponse(content) {
    // 尝试直接解析
    try {
      return JSON.parse(content);
    } catch {}

    // 尝试从 markdown 代码块中提取
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }

    // 尝试找 { } 包裹的内容
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {}
    }

    // 兜底：把用户输入当 prompt
    return {
      prompt: content,
      duration: 5,
      aspectRatio: '16:9',
      type: 'video',
      style: '默认',
    };
  }

  /**
   * 第一步：批量任务拆解计划
   * 根据用户需求，拆解成具体的任务计划（不生成提示词）
   *
   * @param {string} userInput - 用户输入的批量需求
   * @param {Object} materials - 已上传的素材信息
   * @returns {Promise<{subject: string, count: number, variations: Array, reasoning: string, questions?: Array}>}
   */
  async planBatchTasks(userInput, materials = { images: [], videos: [], audios: [] }) {
    const PLAN_SYSTEM_PROMPT = `你是批量视频任务规划专家。用户描述需求，你输出拆解计划。

输出格式（严格 JSON）：
{
  "subject": "核心主体（人物/形象）",
  "count": 3,
  "variations": [
    { "action": "挠屁股", "style": "轻松自然", "description": "卡通形象轻轻挠挠屁股" },
    { "action": "摇头", "style": "可爱生动", "description": "左右摇摇头" }
  ],
  "reasoning": "拆解逻辑说明",
  "questions": []
}

规则：
1. count 不超过 20
2. 每个 variation 必须有差异化
3. 如果用户信息不足，返回 questions 字段列出追问
4. variations 数组中的每个元素包含：action（动作）、style（风格）、description（详细描述）
5. subject 是核心主体，保持一致性
6. 如果有素材参考，在 reasoning 中说明如何利用素材`;

    // 构建素材描述
    const materialDesc = [];
    if (materials.images?.length > 0) {
      materialDesc.push(`图片素材：${materials.images.map((m, i) => `图片${i + 1}（${m.name}）`).join('、')}`);
    }
    if (materials.videos?.length > 0) {
      materialDesc.push(`视频素材：${materials.videos.map((m, i) => `视频${i + 1}（${m.name}）`).join('、')}`);
    }
    if (materials.audios?.length > 0) {
      materialDesc.push(`音频素材：${materials.audios.map((m, i) => `音频${i + 1}（${m.name}）`).join('、')}`);
    }

    const materialInfo = materialDesc.length > 0
      ? `\n\n## 已上传素材\n${materialDesc.join('\n')}`
      : '';

    const userContent = userInput + materialInfo;

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'API 错误'));
              return;
            }
            const content = json.choices?.[0]?.message?.content;
            if (!content) {
              reject(new Error('AI 返回空内容'));
              return;
            }
            const result = this._parseResponse(content);
            resolve(result);
          } catch (err) {
            reject(new Error(`解析失败: ${err.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * 第二步：批量任务生成（两步调用）
   * 先调用 planBatchTasks 获取拆解计划，再基于计划逐条调用 rewritePromptForSeedance
   *
   * @param {string} userInput - 用户输入的批量需求
   * @param {Object} materials - 已上传的素材信息
   * @returns {Promise<{success: boolean, batchName: string, description: string, tasks: Array}>}
   */
  async generateBatchTasks(userInput, materials = { images: [], videos: [], audios: [] }, defaults = {}) {
    const defaultModel = defaults.model || 'seedance2.0fast';
    const defaultDuration = defaults.duration || 5;
    const defaultAspectRatio = defaults.aspectRatio || '16:9';

    // 第一步：获取拆解计划
    const plan = await this.planBatchTasks(userInput, materials);

    // 如果有问题需要追问，返回问题列表
    if (plan.questions && plan.questions.length > 0) {
      return {
        success: false,
        batchName: plan.subject || '批量任务',
        description: plan.reasoning || '',
        tasks: [],
        questions: plan.questions,
      };
    }

    // 所有素材合并为扁平列表（每个子任务共享相同的参考素材）
    const allMaterialsList = [
      ...(materials.images || []),
      ...(materials.videos || []),
      ...(materials.audios || []),
    ];

    // 素材上下文只构建一次，所有子任务复用（避免重复推断）
    const sharedMaterialContext = this._buildMaterialContext(materials);

    // 第二步：基于计划逐条生成提示词
    const tasks = [];
    for (const variation of plan.variations || []) {
      try {
        // 构建单个任务的输入（已含共享素材上下文）
        const baseInput = `${plan.subject}，${variation.description}。风格：${variation.style}`;
        const taskInput = sharedMaterialContext
          ? `${baseInput}\n\n${sharedMaterialContext}`
          : baseInput;

        // 直接调用底层 API，跳过 rewritePromptForSeedance 中的素材拼接（已手动完成）
        const taskPrompt = await this.rewritePromptForSeedance(taskInput, {});

        tasks.push({
          prompt: taskPrompt.prompt,
          reason: variation.action,
          expectedEffect: variation.description,
          // 模型固定用工具栏选择的，不让 AI 自行决定
          model: defaultModel,
          // 时长/比例：AI 可以根据内容调整，否则沿用工具栏默认值
          duration: taskPrompt.duration || defaultDuration,
          aspectRatio: taskPrompt.aspectRatio || defaultAspectRatio,
          // 所有子任务共享参考素材
          materials: allMaterialsList,
        });
      } catch (err) {
        // 单个任务失败不影响其他任务，跳过并继续
        console.error(`生成任务失败 [${variation.action}]:`, err.message);
      }
    }

    return {
      success: true,
      batchName: plan.subject || '批量任务',
      description: plan.reasoning || '',
      tasks,
    };
  }
}

module.exports = { AIService };