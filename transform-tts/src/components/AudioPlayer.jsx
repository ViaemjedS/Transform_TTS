// 从 React 库中导入 useEffect（副作用处理）、useRef（引用保持）、useState（状态管理）三个 Hook
import { useEffect, useRef, useState } from 'react';

// 音频播放器组件：接收 audioUrl（音频 Blob URL）和 mimeType（音频 MIME 类型）作为 props
const AudioPlayer = ({ audioUrl, mimeType }) => {
    // 创建对 <audio> 元素的引用，用于控制音频播放
    const audioPlayer = useRef(null);
    // 创建对 <source> 元素的引用，用于设置音频资源地址
    const audioSource = useRef(null);
    // 播放状态：true 表示正在播放，false 表示已暂停或停止
    const [isPlaying, setIsPlaying] = useState(false);
    // 加载状态：true 表示音频正在加载中，用于防止加载期间误操作
    const [isLoading, setIsLoading] = useState(false);
    // 错误状态：存储音频加载或播放时的错误信息，null 表示无错误
    const [error, setError] = useState(null);

    // 副作用钩子：当 audioUrl 或 mimeType 变化时，重新配置音频源
    useEffect(() => {
        // 音频 URL 变化时，先重置播放状态为未播放
        setIsPlaying(false);
        // 清空之前的错误信息
        setError(null);
        // 设置加载状态为 true，表示开始加载新音频
        setIsLoading(true);

        // 如果 audioUrl 为空（无效地址），直接结束加载并返回
        if (!audioUrl) {
            setIsLoading(false);
            return;
        }

        // 获取当前 <audio> DOM 元素的引用
        const audio = audioPlayer.current;
        // 如果 audio 元素不存在（组件可能已卸载），直接返回
        if (!audio) return;

        // 加载新音频前，先检查当前是否正在播放，如果是则暂停
        if (!audio.paused) {
            audio.pause();
        }

        // 将新的音频 Blob URL 设置到 <source> 元素上
        audioSource.current.src = audioUrl;
        // 设置音频的 MIME 类型（如 "audio/wav"）
        audioSource.current.type = mimeType;

        // 调用 load() 方法重新加载音频资源
        audio.load();

        // 音频数据加载完成的事件处理函数
        const onLoadedData = () => {
            // 加载完成，将加载状态设为 false
            setIsLoading(false);
        };

        // 音频加载出错的事件处理函数
        const onError = () => {
            // 加载失败，将加载状态设为 false
            setIsLoading(false);
            // 设置错误信息，包含具体的错误描述
            setError('音频加载失败: ' + audio.error?.message || '未知错误');
            // 在控制台输出详细的错误信息用于调试
            console.error('Audio loading error:', audio.error);
        };

        // 注册 loadeddata 事件监听器（音频数据加载完成时触发）
        audio.addEventListener('loadeddata', onLoadedData);
        // 注册 error 事件监听器（音频加载失败时触发）
        audio.addEventListener('error', onError);

        // 清理函数：组件卸载或依赖变化时，移除事件监听器防止内存泄漏
        return () => {
            audio.removeEventListener('loadeddata', onLoadedData);
            audio.removeEventListener('error', onError);
        };
    }, [audioUrl, mimeType]); // 依赖数组：当 audioUrl 或 mimeType 变化时重新执行

    // 播放/暂停切换处理函数（异步函数，因为 play() 返回 Promise）
    const handlePlayPause = async () => {
        // 如果 audio 元素不存在或正在加载中，不执行任何操作
        if (!audioPlayer.current || isLoading) return;

        // 如果当前正在播放，则暂停
        if (isPlaying) {
            audioPlayer.current.pause();    // 调用暂停方法
            setIsPlaying(false);            // 更新播放状态为 false
        } else {
            // 如果当前未播放，尝试开始播放
            try {
                await audioPlayer.current.play();  // 调用播放方法（返回 Promise）
                setIsPlaying(true);                 // 播放成功后更新状态为 true
                setError(null);                     // 清除之前的错误信息
            } catch (err) {
                // 播放失败时，设置错误信息
                setError('播放失败: ' + err.message || '请检查音频文件');
                // 在控制台输出详细的播放错误用于调试
                console.error('音频播放错误:', err);
            }
        }
    };

    // 渲染组件的 JSX 结构
    return (
        // 外层容器：纵向弹性布局，相对定位，z-index 为 10，垂直外边距，全宽
        <div className="flex flex-col relative z-10 my-4 w-full">
            {/* 原生 HTML5 audio 元素，用于音频播放 */}
            <audio
                ref={audioPlayer}         // 绑定 audioPlayer 引用，用于 JS 控制播放
                controls                  // 显示浏览器默认的音频控制条（进度条、音量等）
                className="w-full h-14 rounded-lg bg-white
                shadow-xl shadow-black/5 ring-1 ring-slate-700/10"  // 样式：全宽、高度56px、圆角、白色背景、阴影和环形边框
            >
                {/* <source> 元素：指定音频资源地址和类型 */}
                <source ref={audioSource} type={mimeType || 'audio/wav'} />
                {/* 当浏览器不支持 audio 元素时显示的降级提示文本 */}
                您的浏览器不支持音频元素。
            </audio>

            {/* 自定义播放/暂停切换按钮 */}
            <button
                onClick={handlePlayPause}  // 点击时触发播放/暂停切换
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md self-start"  // 样式：上边距、内边距、蓝色背景、白色文字、圆角、左对齐
            >
                {/* 根据播放状态显示不同的按钮文本 */}
                {isPlaying ? '暂停' : '播放'}
            </button>

            {/* 错误信息显示区域：仅在有错误时渲染 */}
            {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
        </div>
    );
};

// 导出 AudioPlayer 组件供其他模块使用
export default AudioPlayer;