// 将音频采样数据编码为 WAV 格式的 ArrayBuffer
// samples: Float32Array 类型的音频采样数组，采样率为 16000Hz
export function encodeWAV(samples) {
    // WAV 文件头的固定偏移量（44 字节为标准 WAV 头大小）
    let offset = 44;
    // 创建足够大小的 ArrayBuffer：头部 44 字节 + 每个采样 4 字节（32 位浮点）
    const buffer = new ArrayBuffer(offset + samples.length * 4);
    // 使用 DataView 来操作 ArrayBuffer，方便按字节写入不同类型的数据
    const view = new DataView(buffer);
    // 音频采样率，固定为 16000Hz（16kHz，适合语音合成场景）
    const sampleRate = 16000;

    // 写入 RIFF 块标识符（4 字节，ASCII 码 "RIFF"）
    writeString(view, 0, 'RIFF')
    // 写入 RIFF 块大小：文件总大小 - 8 字节（不含 RIFF 标识和自身大小字段）
    view.setUint32(4, 36 + samples.length * 4, true)
    // 写入 RIFF 格式类型标识符（4 字节，ASCII 码 "WAVE"）
    writeString(view, 8, 'WAVE')
    // 写入 fmt 子块标识符（4 字节，ASCII 码 "fmt "，注意末尾有空格）
    writeString(view, 12, 'fmt ')
    // 写入 fmt 子块大小（4 字节，固定为 16，表示 PCM 格式块大小）
    view.setUint32(16, 16, true)
    // 写入音频格式（2 字节，3 = IEEE float 格式，即 32 位浮点 PCM）
    view.setUint16(20, 3, true)
    // 写入声道数（2 字节，1 = 单声道）
    view.setUint16(22, 1, true)
    // 写入采样率（4 字节，每秒采样次数，16000Hz）
    view.setUint32(24, sampleRate, true)
    // 写入字节率（4 字节）：采样率 × 声道数 × 每样本字节数 = 16000 × 1 × 4
    view.setUint32(28, sampleRate * 4, true)
    // 写入块对齐（2 字节）：声道数 × 每样本字节数 = 1 × 4 = 4 字节
    view.setUint16(32, 4, true)
    // 写入每个样本的位数（2 字节，32 表示每个采样用 32 位存储）
    view.setUint16(34, 32, true)
    // 写入 data 子块标识符（4 字节，ASCII 码 "data"）
    writeString(view, 36, 'data')
    // 写入 data 子块大小（4 字节）：采样总数 × 每样本字节数（4 字节）
    view.setUint32(40, samples.length * 4, true)

    // 遍历所有采样数据，将每个浮点采样值按小端序写入 data 区域
    for (let i = 0; i < samples.length; ++i, offset += 4) {
        // 写入一个 32 位浮点采样值到当前偏移位置（小端序）
        view.setFloat32(offset, samples[i], true)
    }

    // 返回构建好的完整 WAV 文件 ArrayBuffer
    return buffer
}

// 辅助函数：将 ASCII 字符串逐字节写入 DataView 的指定偏移位置
// view: 目标 DataView 对象
// offset: 开始写入的字节偏移量
// string: 要写入的 ASCII 字符串
function writeString(view, offset, string) {
    // 遍历字符串中的每个字符
    for (let i = 0; i < string.length; ++i) {
        // 将字符的 ASCII 码（0-255）作为 8 位无符号整数写入对应位置
        view.setUint8(offset + i, string.charCodeAt(i))
    }
}