/**
 * 模型文件下载脚本
 *
 * 用途：将 HuggingFace 上的 TTS 模型文件下载到 public/models/ 目录，
 *       实现完全本地离线运行，无需网络请求。
 *
 * 使用方式：node scripts/download-models.js
 *
 * 下载内容：
 *   - speecht5_tts 模型（分词器 + 编码器 + 解码器）约 400MB
 *   - speecht5_hifigan 声码器 约 30MB
 *   - 7 个说话人嵌入向量 每个约 2KB
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public', 'models');

// ===================== 配置 =====================

// HuggingFace 镜像站（国内可访问，Node.js 不受 CORS 限制）
const BASE_URL = 'https://hf-mirror.com';

// 需要下载的模型文件列表（model: HuggingFace 模型 ID, file: 模型内的相对路径）
const MODEL_FILES = [
  // speecht5_tts 模型文件（文本 → 语音特征）
  { model: 'Xenova/speecht5_tts', file: 'config.json' },
  { model: 'Xenova/speecht5_tts', file: 'tokenizer.json' },
  { model: 'Xenova/speecht5_tts', file: 'tokenizer_config.json' },
  { model: 'Xenova/speecht5_tts', file: 'generation_config.json' },
  { model: 'Xenova/speecht5_tts', file: 'onnx/encoder_model_quantized.onnx' },
  { model: 'Xenova/speecht5_tts', file: 'onnx/decoder_model_merged_quantized.onnx' },

  // speecht5_hifigan 声码器文件（语音特征 → 音频波形）
  { model: 'Xenova/speecht5_hifigan', file: 'config.json' },
  { model: 'Xenova/speecht5_hifigan', file: 'onnx/model_quantized.onnx' },
];

// 需要下载的说话人嵌入向量文件（每个约 2KB，共 7 个音色）
const SPEAKER_IDS = [
  'cmu_us_slt_arctic-wav-arctic_a0001',  // US female 1
  'cmu_us_clb_arctic-wav-arctic_a0001',  // US female 2
  'cmu_us_bdl_arctic-wav-arctic_a0003',  // US male 1
  'cmu_us_rms_arctic-wav-arctic_a0003',  // US male 2
  'cmu_us_jmk_arctic-wav-arctic_a0002',  // Canadian male
  'cmu_us_awb_arctic-wav-arctic_b0002',  // Scottish male
  'cmu_us_ksp_arctic-wav-arctic_a0007',  // Indian male
];

// ===================== 工具函数 =====================

/**
 * 下载单个文件并保存到本地
 * @param {string} url   - 远程文件 URL
 * @param {string} dest  - 本地保存路径
 */
async function downloadFile(url, dest) {
  // 确保目标目录存在
  await mkdir(dirname(dest), { recursive: true });

  console.log(`  ⬇ 下载中... ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  // 读取为 ArrayBuffer 并写入磁盘
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
  // 显示文件大小
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`  ✅ 已保存 (${sizeMB} MB): ${dest}`);
}

// ===================== 主流程 =====================

async function main() {
  console.log('🚀 开始下载 TTS 模型文件...\n');

  // ---------- 下载模型文件 ----------
  console.log('📦 模型文件 (共 8 个):');
  for (const { model, file } of MODEL_FILES) {
    // HuggingFace URL 格式: {base}/{model_id}/resolve/main/{file_path}
    // 例: https://hf-mirror.com/Xenova/speecht5_tts/resolve/main/onnx/encoder_model_quantized.onnx
    const url = `${BASE_URL}/${model}/resolve/main/${file}`;
    // 本地存储路径: public/models/{model_id}/{file_path}
    const dest = join(PUBLIC_DIR, model, file);

    // 检查文件是否已存在（跳过已下载的）
    try {
      await downloadFile(url, dest);
    } catch (err) {
      console.error(`  ❌ 失败: ${err.message}`);
      console.log('  提示: 如果网络不通，请确保能访问 hf-mirror.com，或使用代理');
    }
  }

  // ---------- 下载说话人嵌入向量 ----------
  console.log('\n🎤 说话人嵌入向量 (共 7 个):');
  const SPEAKER_BASE = `${BASE_URL}/datasets/Xenova/cmu-arctic-xvectors-extracted/resolve/main`;
  for (const id of SPEAKER_IDS) {
    const url = `${SPEAKER_BASE}/${id}.bin`;
    const dest = join(PUBLIC_DIR, 'speakers', `${id}.bin`);

    try {
      await downloadFile(url, dest);
    } catch (err) {
      console.error(`  ❌ 失败: ${err.message}`);
    }
  }

  console.log('\n🎉 全部下载完成！现在可以运行 npm run dev 启动项目。');
}

main().catch(err => {
  console.error('下载过程出错:', err.message);
  process.exit(1);
});
