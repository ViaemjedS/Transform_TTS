// 从 React 库中导入 StrictMode 组件，用于在开发模式下检测潜在问题
import { StrictMode } from 'react'
// 从 react-dom/client 库中导入 createRoot 方法，用于创建 React 18 的并发渲染根节点
import { createRoot } from 'react-dom/client'
// 导入全局 CSS 样式文件（包含 Tailwind CSS 配置）
import './index.css'
// 导入根组件 App
import App from './App.jsx'

// 获取 HTML 中 id 为 "root" 的 DOM 元素，创建 React 渲染根节点，并渲染应用
createRoot(document.getElementById('root')).render(
  // 使用 StrictMode 包裹应用，在开发模式下会额外执行一次渲染以帮助发现副作用问题
  <StrictMode>
    {/* 渲染主应用组件 */}
    <App />
  </StrictMode>,
)
