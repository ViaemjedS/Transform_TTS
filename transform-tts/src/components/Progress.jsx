// 进度条组件：用于显示模型下载或加载的进度信息
// 接收 text（进度文本）和 percentage（百分比数值，默认为 0）
const Progress = ({ text, percentage=0}) => {
    // 返回组件的 JSX 结构
    return (
        // 外层容器：相对定位，白色背景，圆角，左对齐文本，隐藏溢出内容
        <div className="relative text-black bg-white rounded-lg text-left overflow-hidden">
            {/* 内层进度条：蓝色背景，宽度通过 style 动态绑定百分比，文本不换行 */}
            <div
                className="px-2 w-[1%] h-full bg-blue-500 whitespace-nowrap"
                // 动态设置宽度为传入的百分比值，实现进度条动画效果
                style={{width:`${percentage}%`}}
            >
                {/* 显示进度文本和百分比数值（保留两位小数） */}
                {text}{`${percentage.toFixed(2)}%`}
            </div>
        </div>
    )
}

// 导出 Progress 组件供其他模块使用
export default Progress