// 从 React 库中导入三个 Hook
// useEffect: 处理副作用（如创建 Worker、监听消息、清理资源）
// useRef:   保持对 Web Worker 实例的引用，避免重复创建
// useState: 管理组件的各种 UI 状态
import { useEffect, useRef, useState } from 'react'
// 导入进度条组件，用于显示模型下载进度
import Progress from './components/Progress';
// 导入音频播放器组件，用于播放合成后的语音
import AudioPlayer from './components/AudioPlayer';
// 导入说话人列表和默认说话人常量
import {
  SPEAKERS,          // 可用音色映射表
  DEFAULT_SPEAKER     // 默认音色 ID
} from './contains'

// 主应用组件
function App() {
  // ==================== 状态定义 ====================

  // 模型就绪状态：null=初始化中, false=加载中, true=已就绪
  const [ready, setReady] = useState(null);
  // 按钮禁用状态：防止模型加载期间或生成过程中重复点击
  const [disabled, setDisabled] = useState(false);
  // 下载进度项数组：存储各模型文件的下载进度信息
  const [progressItems, setProgressItems] = useState([]);
  // 输入文本状态：用户输入的要转换为语音的文本
  const [text, setText] = useState('I love Hugging Face!');
  // 选中的说话人（音色）状态：默认使用美国女性 SLT 音色
  const [selectedSpeaker,setSelectedSpeaker] = useState(DEFAULT_SPEAKER);
  // 音频输出状态：存储合成后的音频 Blob URL
  const [output, setOutput] = useState(null);

  // ==================== 副作用：释放 Blob URL ====================

  // 当 output 变化时，注册清理函数以释放旧的 Blob URL（防止内存泄漏）
  useEffect(() => {
    // 返回清理函数：组件卸载时或 output 变化前自动调用
    return () => {
      // 如果存在旧的 Blob URL，调用 revokeObjectURL 释放内存
      if (output) {
        URL.revokeObjectURL(output);
      }
    };
  }, [output]); // 依赖 output，当 output 变化时先执行上一次的清理函数

  // ==================== Web Worker 生命周期管理 ====================

  // 创建对 Web Worker 实例的引用，确保整个组件生命周期中使用同一个 Worker
  const worker = useRef(null);
  // 初始化 Web Worker：组件挂载时创建，负责在后台线程执行 AI 模型推理
  useEffect(() => {
    // 创建 Web Worker 实例，加载 worker.js 作为后台线程脚本
    worker.current = new Worker(new URL('./worker.js',import.meta.url), {
      // 指定 Worker 类型为 ES Module，支持 import/export 语法
      type: 'module'
    })

    // Worker 消息接收处理函数
    const onMessageReceived = (e) => {
      // 根据消息状态码分发处理不同的 Worker 消息
      switch(e.data.status) {
        case 'initiate':
          // 模型初始化开始：设置 ready 为 false，触发加载遮罩层显示
          setReady(false);
          // 将初始化进度项追加到进度列表中
          setProgressItems(prev => [...prev, e.data])
          break;
        case 'download':
          // 下载状态（保留处理入口，当前无需额外操作）
          break;
        case 'progress':
          // 模型文件下载进度更新
          setProgressItems(
            // 遍历现有进度项，找到匹配的文件并更新其进度百分比
            prev => prev.map(item => {
            // 判断是否为当前更新的文件
            if (item.file === e.data.file) {
              // 合并原有属性并更新 progress 字段
              return {
                ...item,
                progress: e.data.progress
              }
            }
            // 非目标文件保持不变
            return item
            })
          )
        break;
        case 'done':
          // 某个模型文件下载完成：从进度列表中移除该文件
          setProgressItems(
            prev => prev.filter(item => item.file !== e.data.file)
          )
        break;
        case 'ready':
          // 所有模型加载完成，设置 ready 为 true，隐藏加载遮罩层
          setReady(true);
        break;
        case 'complete':
          // 语音合成完成，恢复按钮可用状态
          setDisabled(false);
          // 释放旧的 Blob URL（如果存在），为新音频腾出内存
          if (output) {
            URL.revokeObjectURL(output);
          }
          // 校验 Worker 返回的音频数据是否有效（必须是 Blob 实例）
          if (!e.data.output || !(e.data.output instanceof Blob)) {
            // 数据无效时输出错误日志并弹窗提示用户
            console.error('Invalid audio blob received from worker');
            alert('生成音频失败: 收到无效的音频数据');
            return; // 提前返回，不设置无效的音频 URL
          }
          // 将 Blob 对象转换为可播放的 Blob URL
          const blobUrl = URL.createObjectURL(e.data.output);
          // 更新 output 状态，触发 AudioPlayer 组件渲染
          setOutput(blobUrl);
        break;
      case 'error':
        // Worker 发生错误：恢复按钮可用状态
        setDisabled(false);
        // 输出错误日志到控制台
        console.error('Worker error:', e.data.message);
        // 弹窗提示用户错误信息
        alert(`生成音频失败: ${e.data.message}`);
        break;
      }
    }

    // 注册 Worker 消息事件监听器
    worker.current.onmessage = onMessageReceived;
    // 清理函数：组件卸载时移除事件监听器
    return () => worker.current.removeEventListener('message',
      onMessageReceived
    )
  },[output]) // 依赖 output，确保回调中始终能访问到最新的 output 值

  // ==================== 事件处理 ====================

  // "生成语音"按钮点击处理函数
  const handleGenerateSpeech = () => {
    // 禁用按钮，防止重复点击引发多次合成
    setDisabled(true);
    // 通过 postMessage 向 Web Worker 发送合成任务
    worker.current.postMessage({
      text,                    // 要合成语音的文本内容
      speaker_id: selectedSpeaker  // 选中的说话人 ID（控制音色）
    })
  }

  // 计算加载状态：ready 为 false 表示模型正在下载加载中
  const isLoading = ready === false;

  // ==================== JSX 渲染 ====================

  return (
      // 最外层容器：最小高度全屏，居中布局，灰色背景
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        {/* ========== 模型加载遮罩层 ========== */}
        {/* 绝对定位，覆盖整个屏幕，z-index 50 确保在最上层 */}
        <div className='absolute z-50 top-0 left-0 w-full h-full
        transition-all px-8 flex flex-col justify-center text-center'
        style={{
          // 根据加载状态控制透明度：加载中=1（完全可见），就绪=0（完全透明）
          opacity: isLoading? 1 : 0,
          // 根据加载状态控制鼠标事件：加载中=可交互，就绪=穿透点击
          pointerEvents: isLoading? 'all' : 'none',
          // 半透明黑色背景 + 模糊效果，营造模态遮罩体验
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(8px)'
        }}
        >
          {
            // 仅在加载中时显示提示文字（模型只需加载一次）
            isLoading && (
              <label className='text-white text-xl p-3'>
                Loading models... (only run once)
              </label>
            )
          }
          {
            // 遍历并渲染每个模型文件的下载进度条
            progressItems.map(data => (
              <div key={`${data.name}/${data.file}`}> {/* 使用 "名称/文件名" 作为 React key */}
                {/* 渲染 Progress 组件，显示文件名和下载百分比 */}
                <Progress
                  text={`${data.name}/${data.file}`}   // 进度文本：模型名/文件名
                  percentage={data.progress}            // 当前下载百分比
                />
              </div>
            ))
          }
        </div>

        {/* ========== 主内容卡片 ========== */}
        {/* 白色背景、圆角、内边距、全宽（最大 576px）、外边距 */}
        <div className='bg-white p-8 rounded-lg w-full max-w-xl m-2'>
          {/* 应用标题：大号字体、粗体、灰色、底部边距、居中 */}
          <h1 className="text-3xl font-semibold text-gray-800 mb-1 text-center">
            In browser Text To Speech(端模型)
          </h1>
          {/* 副标题：说明技术栈（基于 Transformers.js 构建） */}
          <h2 className="text-base font-medium text-gray-700 mb-2 text-center">
            Made with <a> Transfromer.js </a>
          </h2>

          {/* ========== 表单区域 ========== */}
          <div className="mb-4">
            {/* 文本输入标签 */}
            <label htmlFor="text" className="block text-sm font-medium text-gray-600">
              Text
            </label>
            {/* 文本输入域：多行文本，绑定 value 和 onChange */}
            <textarea
              id="text"                                    // 关联 label 的 htmlFor
              className="border border-gray-300 rounded-md p-2 w-full"  // 边框、圆角、内边距、全宽
              rows="4"                                     // 显示 4 行
              placeholder='Enter text here'                // 占位提示文本
              value={text}                                 // 受控组件：值绑定到 text 状态
              onChange={(e) => setText(e.target.value)}     // 输入变化时更新 text 状态
            >
            </textarea>

            {/* ========== 音色选择区域 ========== */}
            <div className="mb-4">
              {/* 音色选择标签 */}
              <label
                htmlFor="speaker"
                className='block text-sm font-medium text-gray-600'
              >
              </label>
              {/* 音色下拉选择框 */}
              <select
                id="speaker"                                        // 关联 label 的 htmlFor
                className='border border-gray-300 rounded-md p-2 w-full'  // 边框、圆角、内边距、全宽
                value={selectedSpeaker}                             // 受控组件：值绑定到 selectedSpeaker 状态
                onChange={(e) => setSelectedSpeaker(e.target.value)} // 选择变化时更新音色状态
              >
                {
                  // 使用 Object.entries() 将 SPEAKERS 对象转为 [[key, value], ...] 数组并遍历
                  Object.entries(SPEAKERS).map(([key, value]) => (
                    // 每个说话人渲染一个 <option>，显示名称为 key，实际值为 value
                    <option key={key} value={value}>
                      {key}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* ========== 生成按钮区域 ========== */}
            <div className='flex justify-center'>
              <button
                // 根据 disabled 状态动态切换样式：禁用时灰色，可用时蓝色
                className={`${disabled? 'bg-gray-400 cursor-not-allowed':
                  'bg-blue-500 hover:bg-blue-600'}
                  text-white rounded-md py-2 px-4`}
                onClick={handleGenerateSpeech}  // 点击触发语音合成
                disabled={disabled}              // 绑定禁用状态
              >
                {/* 根据 disabled 状态切换按钮文字 */}
                {disabled? 'Generating...': 'Generate'}
              </button>
            </div>

            {/* ========== 音频播放器区域 ========== */}
            {
              // 仅当 output 不为空时（合成完成后）渲染 AudioPlayer 组件
              output && <AudioPlayer
                audioUrl={output}          // 传入音频 Blob URL
                mimeType={"audio/wav"}     // 指定 MIME 类型为 WAV
              />
            }
          </div>
        </div>
      </div>
  )
}

// 导出 App 组件作为应用根组件
export default App