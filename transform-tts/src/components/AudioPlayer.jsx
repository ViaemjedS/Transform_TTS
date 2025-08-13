import { useEffect, useRef, useState } from 'react';

const AudioPlayer = ({ audioUrl, mimeType }) => {
    const audioPlayer = useRef(null);
    const audioSource = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // 添加加载状态
    const [error, setError] = useState(null);

    useEffect(() => {
        // 重置状态
        setIsPlaying(false);
        setError(null);
        setIsLoading(true); // 设置加载中

        if (!audioUrl) {
            setIsLoading(false);
            return;
        }

        const audio = audioPlayer.current;
        if (!audio) return;

        // 加载新音频前先停止当前播放
        if (!audio.paused) {
            audio.pause();
        }

        // 设置新的音频URL
        audioSource.current.src = audioUrl;
        audioSource.current.type = mimeType;

        // 加载音频
        audio.load();

        // 监听加载完成事件
        const onLoadedData = () => {
            setIsLoading(false);
        };

        // 监听错误事件
        const onError = () => {
            setIsLoading(false);
            setError('音频加载失败: ' + audio.error?.message || '未知错误');
            console.error('Audio loading error:', audio.error);
        };

        audio.addEventListener('loadeddata', onLoadedData);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('loadeddata', onLoadedData);
            audio.removeEventListener('error', onError);
        };
    }, [audioUrl, mimeType]);

    const handlePlayPause = async () => {
        if (!audioPlayer.current || isLoading) return;

        if (isPlaying) {
            audioPlayer.current.pause();
            setIsPlaying(false);
        } else {
            try {
                await audioPlayer.current.play();
                setIsPlaying(true);
                setError(null);
            } catch (err) {
                setError('播放失败: ' + err.message || '请检查音频文件');
                console.error('音频播放错误:', err);
            }
        }
    };

    return (
        <div className="flex flex-col relative z-10 my-4 w-full">
            <audio
                ref={audioPlayer}
                controls
                className="w-full h-14 rounded-lg bg-white
                shadow-xl shadow-black/5 ring-1 ring-slate-700/10"
            >
                <source ref={audioSource} type={mimeType || 'audio/wav'} />
                您的浏览器不支持音频元素。
            </audio>

            {/* 播放/暂停按钮 */}
            <button
                onClick={handlePlayPause}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md self-start"
            >
                {isPlaying ? '暂停' : '播放'}
            </button>

            {/* 错误提示 */}
            {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
        </div>
    );
};

export default AudioPlayer;