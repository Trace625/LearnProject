# 2026-04-09 工作日志

## 项目概览分析

- **项目名称**：AI 助教（learning_agent）
- **定位**：面向学生的多模态智能学习辅助平台
- **技术栈**：Flask + Kimi API（moonshot-v1-8k-vision-preview）+ MySQL + 原生 HTML/JS + Three.js
- **核心功能**：
  1. 多模态 AI 问答（文字+图片→Kimi视觉模型）
  2. Agent 驱动前端可视化联动（JSON指令控制3D几何/时间轴/太阳系动画）
  3. Three.js 3D 几何解题面板（支持用户手绘辅助线）
  4. KaTeX 数学公式 + Markdown 渲染
  5. 用户注册/登录/JWT认证 + 会话历史持久化（MySQL）
- **预留扩展**：PaddleOCR、PyTorch、Function Calling
- **亮点设计**：后端 System Prompt 通过 JSON 代码块直接控制前端 UI，实现真正的 Agent 联动效果

## 3D 几何渲染深度优化（session 2）

对 `learning_agent` 项目的 3D 几何模块进行了全面升级，涉及文件：
- `frontend/main.html`：几何面板工具栏扩展（画线/标注/测量/显面/坐标轴/复位/清除/颜色选择）
- `frontend/js/script.js`：Three.js渲染模块重写（面渲染、灯光升级、坐标轴、ResizeObserver、键盘快捷键、标注输入、距离测量、圆柱/球形支持）
- `frontend/css/style.css`：新增状态栏、可折叠AI说明、颜色预览点、标注浮窗、测量结果浮窗、顶点标签升级样式
- `backend/kimi_agent.py`：Prompt精化（坐标规范表格、各形体棱数要求、标准坐标模板、`startLabel`/`endLabel` 字段规范、图片识别优先级说明）

**新增功能摘要**：
1. 🔷 半透明面渲染（可开关）
2. 📊 坐标轴辅助线（可开关）
3. 🔄 一键复位视角
4. ⌨️ 键盘快捷键支持（D/L/M/F/A/R/C/ESC）
5. 状态栏实时提示当前操作模式
6. AI 说明面板可折叠
7. 圆柱体、球体专用渲染器
