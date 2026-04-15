/**
 * coze.js — Coze API integration for Kling O1 image-to-video
 *
 * Flow:
 *   1. Upload local images → Coze Files API → signed CDN URLs
 *   2. Call Kling O1 workflow via SSE stream
 *   3. Download the resulting video
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { makeVideoName } = require('./videoName');

const COZE_PAT = 'pat_L2D1vL70dC5LMMgwhVkiEOcBCn7TIJdUfXYVlk7MkLnSaeDPaegPFnloxdXGcsiK';
const KLING_O1_WORKFLOW_ID = '7579615132323233807';
const COZE_HOST = 'api.coze.cn';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cozeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ── Step 1: Upload image file to Coze ────────────────────────────────────────

async function uploadFileToCoze(filePath) {
  const filename = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  const contentType = mimeMap[ext] || 'image/jpeg';

  const boundary = '----CozeFormBoundary' + Date.now().toString(16) + Math.random().toString(16).slice(2);
  const headerPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
  const bodyBuf = Buffer.concat([headerPart, fileData, footerPart]);

  const { body } = await cozeRequest({
    hostname: COZE_HOST,
    path: '/v1/files/upload',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COZE_PAT}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuf.length,
    },
  }, bodyBuf);

  const resp = JSON.parse(body);
  if (resp.code !== 0 || !resp.data?.id) {
    throw new Error(`上传失败: ${JSON.stringify(resp).slice(0, 200)}`);
  }

  const fileId = resp.data.id;

  // Retrieve file info to get the signed CDN URL
  const infoResp = await cozeRequest({
    hostname: COZE_HOST,
    path: `/v1/files/${fileId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${COZE_PAT}` },
  });

  const fileInfo = JSON.parse(infoResp.body);
  const url = fileInfo.data?.url;
  if (!url) {
    throw new Error(`获取文件URL失败: ${infoResp.body.slice(0, 200)}`);
  }

  return url;
}

// ── Step 2: Call Kling O1 workflow (SSE) ─────────────────────────────────────

function callKlingWorkflow(imageUrls, prompt, duration, aspectRatio, onProgress) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify({
      workflow_id: KLING_O1_WORKFLOW_ID,
      parameters: {
        aspect_ratio: aspectRatio || '16:9',
        duration: String(duration || 5),
        image: imageUrls,
        prompt: prompt || '',
      },
    });

    const options = {
      hostname: COZE_HOST,
      path: '/v1/workflow/stream_run',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      let buffer = '';
      const allContent = [];
      let resolved = false;

      const tryResolve = (result) => {
        if (!resolved) { resolved = true; resolve(result); }
      };

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';

        let currentEvent = '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);

              // Progress updates
              if ((data.event === 'Message' || currentEvent === 'Message') && data.content) {
                allContent.push(data.content);
                if (onProgress) {
                  onProgress(data.node_title === 'End' ? '生成完成，处理中...' : `生成中: ${data.node_title || '处理中'}...`);
                }
                // Check for End node which contains the final output
                if (data.node_type === 'End' || data.node_title === 'End') {
                  try {
                    const parsed = JSON.parse(data.content);
                    const url = parsed.output?.[0] || parsed.video_url || parsed.url;
                    if (url) tryResolve({ success: true, videoUrl: url });
                  } catch {}
                }
              }

              // Workflow done
              if (data.event === 'Done' || currentEvent === 'Done') {
                // Find URL in collected content
                for (const c of allContent) {
                  try {
                    const p = JSON.parse(c);
                    const url = p.output?.[0] || p.video_url || p.url;
                    if (url) { tryResolve({ success: true, videoUrl: url }); break; }
                  } catch {
                    const m = c.match(/https?:\/\/\S+\.(mp4|mov|webm)/i);
                    if (m) { tryResolve({ success: true, videoUrl: m[0] }); break; }
                  }
                }
                tryResolve({ success: false, error: '工作流完成但未返回视频URL', debug: allContent.slice(-2).join('\n') });
              }

              // Error
              if (data.event === 'Error' || currentEvent === 'Error') {
                tryResolve({ success: false, error: data.error_message || `Coze错误 ${data.error_code}` });
              }
            } catch {} // ignore JSON parse errors on individual lines
          }
        }
      });

      res.on('end', () => {
        for (const c of allContent) {
          try {
            const p = JSON.parse(c);
            const url = p.output?.[0] || p.video_url;
            if (url) { tryResolve({ success: true, videoUrl: url }); return; }
          } catch {}
        }
        tryResolve({ success: false, error: '连接结束，未获得视频URL' });
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.setTimeout(300000, () => { // 5-minute timeout for video generation
      req.destroy();
      resolve({ success: false, error: '生成超时（5分钟）' });
    });
    req.write(bodyStr);
    req.end();
  });
}

// ── Step 3: Download video ────────────────────────────────────────────────────

function downloadVideo(videoUrl, outputPath, _redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    if (_redirectDepth > 10) return reject(new Error('Too many redirects'));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const urlObj = new URL(videoUrl);
    const transport = urlObj.protocol === 'https:' ? https : http;

    const file = fs.createWriteStream(outputPath);

    const handleResponse = (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(outputPath); } catch {}
        const location = response.headers.location;
        if (!location) return reject(new Error('Redirect without location'));
        return downloadVideo(location, outputPath, _redirectDepth + 1).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    };

    transport.get(videoUrl, handleResponse).on('error', (err) => {
      try { fs.unlinkSync(outputPath); } catch {}
      reject(err);
    });
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Full Kling O1 generation pipeline:
 *   local images → upload → call workflow → download video → return local path
 *
 * @param {object} params
 *   imagePaths:   string[]  — absolute paths to local image files
 *   prompt:       string    — motion description
 *   duration:     number    — video duration in seconds (3–15)
 *   aspectRatio:  string    — '16:9' | '9:16' | '1:1'
 *   downloadDir:  string    — directory to save the downloaded video
 * @param {function} onProgress  (message: string) => void
 * @returns {Promise<{ success: boolean, videoUrl?: string, localPath?: string, error?: string }>}
 */
async function klingGenerate({ imagePaths, prompt, duration, aspectRatio, downloadDir }, onProgress) {
  console.log('[Coze] klingGenerate start — images:', imagePaths?.length, 'duration:', duration);

  // 1. Upload images in parallel
  if (onProgress) onProgress(`上传图片 (共 ${imagePaths.length} 张)...`);
  let imageUrls;
  try {
    imageUrls = await Promise.all(imagePaths.map(async (p, i) => {
      const url = await uploadFileToCoze(p);
      console.log(`[Coze] 图片 ${i + 1} 上传完成: ${url.slice(0, 60)}...`);
      return url;
    }));
  } catch (err) {
    console.error('[Coze] 图片上传失败:', err.message);
    return { success: false, error: `图片上传失败: ${err.message}` };
  }

  // 2. Call workflow
  if (onProgress) onProgress('已提交可灵 O1，等待生成...');
  const workflowResult = await callKlingWorkflow(imageUrls, prompt, duration, aspectRatio, onProgress);
  if (!workflowResult.success) {
    console.error('[Coze] 工作流失败:', workflowResult.error);
    return workflowResult;
  }

  const videoUrl = workflowResult.videoUrl;
  console.log('[Coze] 视频URL:', videoUrl.slice(0, 80));

  // 3. Download video
  const dir = downloadDir || path.join(require('os').homedir(), 'Downloads', '可灵O1');
  fs.mkdirSync(dir, { recursive: true });

  const filename = makeVideoName(prompt, 'kling', duration);
  const localPath = path.join(dir, filename);

  if (onProgress) onProgress('正在下载视频...');
  try {
    await downloadVideo(videoUrl, localPath);
    console.log('[Coze] 视频下载完成:', localPath);
    return { success: true, videoUrl, localPath };
  } catch (err) {
    console.error('[Coze] 下载失败:', err.message);
    // Return the remote URL even if download fails
    return { success: true, videoUrl, localPath: '', downloadError: err.message };
  }
}

module.exports = { klingGenerate };
