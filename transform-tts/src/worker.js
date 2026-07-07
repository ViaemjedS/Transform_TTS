// 从 Transformers.js 库中导入所需模块
import {
    env,                      // 环境配置对象，用于设置 AI 模型的运行环境（本地/远程）
    Tensor,                   // 张量类，AI 模型处理数据的基本数据结构（多维数组）
    AutoTokenizer,            // 自动分词器，根据模型 ID 自动选择合适的分词器
    SpeechT5ForTextToSpeech,  // SpeechT5 文本转语音模型，将文本转换为语音特征
    SpeechT5HifiGan           // HiFi-GAN 声码器模型，将语音特征合成为高质量音频波形
} from '@xenova/transformers'
// 导入 WAV 编码工具函数，用于将音频采样数据打包为 WAV 文件格式
import {
    encodeWAV
} from './utils'

// 配置 Transformers.js 运行环境
// 禁用本地模型加载，强制从 HuggingFace Hub 远程下载模型文件
env.allowLocalModels = false;

// ============================================================
// 文本转语音流水线类（单例模式）
// ============================================================
// 核心设计思路：
// 1. TTS 模型实例化开销极大（模型文件数百 MB），多次实例化不可取
// 2. 采用单例模式确保整个 Web Worker 生命周期内只创建一次模型实例
// 3. 所有 TTS 请求复用同一个分词器、模型、声码器实例
class MyTextToSpeechPipeline {
    // 说话人嵌入向量的远程数据源根地址（HuggingFace 数据集）
    // 每个说话人的 .bin 文件包含一个 1×512 维的特征向量，用于控制合成语音的音色
    static BASE_URL = 'https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors-extracted/resolve/main/';
    // SpeechT5 TTS 模型的 HuggingFace ID（文本 → 语音特征）
    static model_id = 'Xenova/speecht5_tts'
    // HiFi-GAN 声码器的 HuggingFace ID（语音特征 → 真实音频波形）
    static vocoder_id = 'Xenova/speecht5_hifigan'
    // 分词器单例实例，初始为 null（懒加载，首次使用时才初始化）
    static tokenizer_instance = null;
    // TTS 模型单例实例，初始为 null
    static model_instance = null;
    // 声码器单例实例，初始为 null
    static vocoder_instance = null;

    // 获取流水线实例（静态异步方法）
    // progress_callback: 下载进度回调函数，用于向主线程报告模型下载进度
    static async getInstance(progress_callback=null){
        // 如果分词器尚未实例化，则先从 HuggingFace 加载
        if (this.tokenizer_instance === null) {
            // 使用 AutoTokenizer 根据 model_id 自动选择并加载预训练的分词器
            this.tokenizer = AutoTokenizer.from_pretrained(this.model_id, {
                progress_callback  // 传入进度回调，实时报告下载进度
            })
        }

        // 如果 TTS 模型尚未实例化，则加载模型和声码器
        if (this.model_instance===null) {
            // 加载 SpeechT5 文本转语音模型（从 HuggingFace 远程下载）
            this.model_instance = SpeechT5ForTextToSpeech.from_pretrained(
                this.model_id,           // 模型 ID
                {
                    dtype: 'fp32',       // 使用 32 位浮点精度（权衡精度与性能）
                    progress_callback    // 下载进度回调
                }
            )
            // 加载 HiFi-GAN 声码器（将频谱特征转为音频波形）
            if (this.vocoder_instance === null) {
                this.vocoder_instance = SpeechT5HifiGan.from_pretrained(
                    this.vocoder_id,      // 声码器模型 ID
                    {
                        dtype: 'fp32',    // 使用 32 位浮点精度
                        progress_callback // 下载进度回调
                    }
                )
            }

            // 返回一个 Promise，等待所有三个组件（分词器、模型、声码器）加载完成后 resolve
            return new Promise(async (resolve, reject) => {
                // 使用 Promise.all 并行等待所有异步加载任务完成
                const result = await Promise.all([
                    this.tokenizer,        // 等待分词器加载
                    this.model_instance,   // 等待 TTS 模型加载
                    this.vocoder_instance  // 等待声码器加载
                ])
                // 所有模型加载完成后，通过 postMessage 通知主线程"准备就绪"
                self.postMessage({
                    status: 'ready'  // 状态标记：模型已就绪
                });
                // resolve 返回加载结果数组
                resolve(result);
            })
        }
    }

    // 获取指定说话人的嵌入向量（静态异步方法）
    // speaker_id: 说话人唯一标识符（如 "cmu_us_slt_arctic-wav-arctic_a0001"）
    static async getSpeakerEmbeddings(speaker_id) {
        // 拼接完整的说话人嵌入向量下载地址
        const speaker_embeddings_url = `${this.BASE_URL}${speaker_id}.bin`;
        // 步骤说明：
        // 1. fetch 下载 .bin 二进制文件
        // 2. arrayBuffer() 将响应转为 ArrayBuffer
        // 3. 用 Float32Array 包装二进制数据
        // 4. 创建 Tensor（1×512 维的特征向量）
        const speaker_embeddings = new Tensor(
            'float32',                                                       // 数据类型：32 位浮点
            new Float32Array(await (await fetch(speaker_embeddings_url)).arrayBuffer()),  // 下载并转换二进制数据
            [1,512]                                                          // 张量形状：1 行 × 512 列（一个说话人特征向量）
        );
        // 返回构建好的说话人嵌入张量
        return speaker_embeddings
    }
}

// 说话人嵌入向量缓存 Map
// ES6 Map 数据结构，用于缓存已下载的说话人特征向量，避免重复网络请求
// key: 说话人 ID（字符串），value: 对应的嵌入向量 Tensor
const speaker_embeddings_cache = new Map();

// Web Worker 消息监听器：接收主线程发来的 TTS 合成任务
self.onmessage = async (e) => {
    // 懒加载模式：首次收到消息时才触发 AI 模型的初始化和下载
    // 解构获取分词器、TTS 模型、声码器三个核心组件
    const [tokenizer, model, vocoder] = await MyTextToSpeechPipeline.getInstance(x => {
        // 将下载进度信息转发给主线程，用于显示进度条
        self.postMessage(x)
    })

    // 使用分词器将输入文本转换为 token ID 数组
    // 分词过程：将自然语言文本 → 逐个字/词 → 对应的数字编码
    const {
        input_ids  // 解构获取分词后的 token ID 数组
    } = tokenizer(e.data.text);
    // AI 文本生成流程概述：
    // prompt（输入文本） → tokenizer（分词） → LLM（向量计算，参数十亿+） → outputs（输出结果）

    // 尝试从缓存中获取当前说话人的嵌入向量
    let speaker_embeddings = speaker_embeddings_cache.get(e.data.speaker_id);
    // 如果缓存未命中（首次使用该音色），则需要从远程下载
    if (speaker_embeddings === undefined) {
        // 调用静态方法下载说话人的特征向量（.bin 文件）
        speaker_embeddings = await MyTextToSpeechPipeline.getSpeakerEmbeddings(e.data.speaker_id);
        // 将下载的特征向量存入缓存 Map，下次相同音色直接使用
        speaker_embeddings_cache.set(e.data.speaker_id, speaker_embeddings);
    }

    // 调用 TTS 模型的 generate_speech 方法生成语音
    const { waveform } = await model.generate_speech(
        input_ids,            // 分词后的 token ID 输入
        speaker_embeddings,   // 512 维的说话人特征向量（控制音色）
        {vocoder}             // 传入声码器，用于将频谱特征转为音频波形
    );

    // 将模型输出的波形数据编码为 WAV 文件格式
    const wav = encodeWAV(waveform.data);
    // 调试日志：输出编码后的 WAV 数据
    console.log(wav ,'????');
    // 将合成结果发送给主线程
    self.postMessage({
        status: 'complete',               // 状态标记：合成完成
        output: new Blob([wav],{          // 将 WAV ArrayBuffer 包装为 Blob 对象
            type: 'audio/wav'             // 指定 MIME 类型为 WAV 音频
        })
    })
}