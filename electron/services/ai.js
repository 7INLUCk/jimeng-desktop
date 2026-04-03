const https = require('https');

// 即梦提示词改写系统 Prompt（普通模式）
const SYSTEM_PROMPT = `你是一个即梦（jimeng.jianying.com）AI 视频/图片生成的提示词专家。

用户会用自然语言描述想要生成的内容。你需要将其改写为即梦最优的英文提示词，并提取参数。

## 输出格式（严格 JSON）
{
  "prompt": "英文提示词，包含画面描述、风格、运镜等细节",
  "duration": 5,
  "aspectRatio": "16:9",
  "type": "video",
  "style": "写实"
}

## 提示词写作规则
1. 用英文，不用中文
2. 包含：主体 + 动作 + 场景 + 光线 + 风格 + 运镜
3. 具体、可视觉化，避免抽象描述
4. 适合视频生成的提示词，强调运动和时间维度
5. 如果用户说的是中文场景，翻译为最优英文表达
6. 默认生成视频（type: "video"），用户明确说"图片/照片"时用 "image"
7. 默认 5 秒，用户明确指定其他时长时调整
8. 默认 16:9 横屏，用户说"竖屏/手机"时用 "9:16"

## 示例
用户："帮我生成一段猫咪在樱花树下奔跑的视频"
输出：{"prompt": "A cute orange tabby cat running gracefully through a tunnel of cherry blossom trees, petals falling gently in the warm golden sunlight, soft bokeh background, cinematic slow motion, 4K, warm color grading", "duration": 5, "aspectRatio": "16:9", "type": "video", "style": "写实"}

用户："一张赛博朋克风格的城市夜景图"
输出：{"prompt": "Cyberpunk city nightscape, neon lights reflecting on wet streets, towering skyscrapers with holographic advertisements, flying cars in the distance, rain, moody atmosphere, Blade Runner style, cinematic composition", "duration": null, "aspectRatio": "16:9", "type": "image", "style": "赛博朋克"}
`;

// Seedance 2.0 全能参考模式提示词改写系统 Prompt
const SEEDANCE_SYSTEM_PROMPT = `你是即梦 Seedance 2.0「全能参考」模式的提示词专家。

用户会上传素材（图片、视频、音频）并用自然语言描述需求。你需要将其改写为专业的 Seedance 2.0 @引用格式提示词。

## 输出格式（严格 JSON）
{
  "prompt": "带@引用的中文提示词",
  "reason": "改写理由（简洁说明为什么这样写）",
  "duration": 5,
  "aspectRatio": "16:9"
}

## @引用规则
- 用 @图片1、@图片2、@视频1、@视频2、@音频1 引用素材
- 图片：负责人物形象、穿着、背景、场景
- 视频：负责动作、运镜、转场、节奏
- 音频：负责配乐、音效

## 提示词黄金公式
@素材 + 用途说明 + 具体画面描述 + 时间线（可选）

## 提示词写作规则
1. 用中文写，即梦支持中文
2. 明确分配每个素材的职责
3. 保持简洁，不要冗余
4. 有视频素材时，强调「参考」动作/运镜
5. 有图片素材时，强调「保持」形象/背景

## 示例

用户上传：图片1（人像）、视频1（舞蹈）
用户输入："让这个人跳舞"

输出：
{
  "prompt": "@图片1 的人物参考 @视频1 的舞蹈动作，保持人物形象和背景完全不变，流畅完成整套舞蹈动作",
  "reason": "你上传了人像图和舞蹈视频，我生成了「全能参考」模式的标准提示词。图片负责人物形象，视频负责动作参考。",
  "duration": 5,
  "aspectRatio": "9:16"
}

用户上传：图片1（女生）、图片2（男生）、视频1（对话场景）
用户输入："让她跟他对话"

输出：
{
  "prompt": "@图片1 的女生作为主角，@图片2 的男生作为配角，参考 @视频1 的对话动作和运镜方式，在室内场景进行自然对话",
  "reason": "双人物场景，我明确分配了主角和配角，并参考视频中的对话节奏。",
  "duration": 8,
  "aspectRatio": "16:9"
}

用户上传：图片1（风景）、音频1（音乐）
用户输入："做一个音乐卡点视频"

输出：
{
  "prompt": "@图片1 的风景场景，根据 @音频1 的音乐节奏进行画面切换和动态展示",
  "reason": "你提供了静态风景和音乐，我生成了音乐卡点视频的提示词。",
  "duration": 10,
  "aspectRatio": "16:9"
}

用户上传：无素材
用户输入："一个女孩在雨中跳舞"

输出：
{
  "prompt": "一个穿着白色连衣裙的女孩在雨中翩翩起舞，雨水顺着裙摆飞溅，背景是朦胧的城市夜景，霓虹灯倒映在积水中，浪漫唯美风格",
  "reason": "没有素材参考，我生成了完整的场景描述提示词。",
  "duration": 5,
  "aspectRatio": "9:16"
}
`;

class AIService {
  constructor(apiKey, model) {
    // 使用 DeepSeek V3.2（性价比最高，2026-04-01 配置）
    this.apiKey = apiKey || 'sk-4b2f09aa14204571b1b33a5d97839a63';
    this.model = model || 'deepseek-chat';
    this.baseUrl = 'https://api.deepseek.com/chat/completions';
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
          'HTTP-Referer': 'https://jimeng-desktop.local',
          'X-Title': 'Jimeng Desktop Assistant',
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
   * Seedance 2.0 全能参考模式提示词改写
   * 
   * @param {string} userInput - 用户输入的模糊需求
   * @param {Object} materials - 已上传的素材信息
   * @param {Array<{type: string, name: string}>} materials.images - 图片素材
   * @param {Array<{type: string, name: string}>} materials.videos - 视频素材
   * @param {Array<{type: string, name: string}>} materials.audios - 音频素材
   * @returns {Promise<{prompt: string, reason: string, duration: number, aspectRatio: string}>}
   */
  async rewritePromptForSeedance(userInput, materials = { images: [], videos: [], audios: [] }) {
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
      : '\n\n## 已上传素材\n无';

    const userContent = userInput + materialInfo;

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
          'HTTP-Referer': 'https://jimeng-desktop.local',
          'X-Title': 'Jimeng Desktop Assistant',
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
   * 批量任务生成
   */
  async generateBatchTasks(userInput, materials = null) {
    // 构建素材信息字符串
    let materialsInfo = '';
    if (materials && (materials.images?.length || materials.videos?.length)) {
      const parts = [];
      if (materials.images?.length) {
        parts.push(`图片素材：${materials.images.map(m => m.name).join('、')}`);
      }
      if (materials.videos?.length) {
        parts.push(`视频素材：${materials.videos.map(m => m.name).join('、')}`);
      }
      materialsInfo = `\n\n## 用户已上传素材\n${parts.join('\n')}\n\n注意：生成提示词时，请在 prompt 中使用 @引用 格式引用对应素材（如 @图片1、@视频1）`;
    }

    const BATCH_SYSTEM_PROMPT = `你是一个即梦 Seedance 2.0 批量视频生成任务规划专家。

用户会描述他们的批量生成需求。你需要根据需求拆分成具体的任务列表。
${materialsInfo}

## 输出格式（严格 JSON）
{
  "batchName": "批量任务名称（简短）",
  "description": "总体目标描述",
  "tasks": [
    {
      "prompt": "带@引用的提示词（如果有素材必须用@引用）",
      "reason": "测试目的",
      "expectedEffect": "预期效果",
      "duration": 5,
      "aspectRatio": "16:9",
      "materials": ["图片1", "视频1"]
    }
  ],
  "questions": []
}

## 规则
1. 任务数量不超过 20 个
2. 每个任务必须有明确的测试目的
3. 如果有素材，每个任务的 prompt 必须包含 @引用
4. materials 字段列出该任务使用的素材名称
5. 如果用户信息不足，在 questions 中列出需要追问的问题`;

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: BATCH_SYSTEM_PROMPT },
        { role: 'user', content: userInput }
      ],
      temperature: 0.7,
      max_tokens: 2000,
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
          'HTTP-Referer': 'https://jimeng-desktop.local',
          'X-Title': 'Jimeng Desktop Assistant',
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
}

module.exports = { AIService };