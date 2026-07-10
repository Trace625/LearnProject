// 全局变量
let currentUser = null;
let conversationHistory = [];
let solarCanvas, ctx;
let planets = [];
let stars = [];
let angle = 0;
let simulationState = {
    speedMultiplier: 1,  // 时间流速
    focusTarget: null,   // 当前聚焦的星球名字 (例如 'mars')
    viewOffsetX: 0,      // 摄像机 X 轴偏移
    viewOffsetY: 0       // 摄像机 Y 轴偏移
};

// 初始化太阳系
function initSolarSystem() {
    solarCanvas = document.getElementById('solarCanvas');
    if (!solarCanvas) return;
    ctx = solarCanvas.getContext('2d');

    // 1. 生成星星背景
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * solarCanvas.width,
            y: Math.random() * solarCanvas.height,
            size: Math.random() * 0.5 + 0.5,
            opacity: Math.random() * 0.5 + 0.5
        });
    }

    // 2. 配置行星数据
    const planetConfig = [
        { name: 'sun', img: 'https://img.alicdn.com/imgextra/i1/O1CN01oVLbLx22VlN34KDQs_!!6000000007126-2-tps-800-800.png', size: 60, dist: 0, speed: 0 },
        { name: 'mercury', img: 'https://img.alicdn.com/imgextra/i2/O1CN01UjgqIB1SrRxQfrflh_!!6000000002300-2-tps-800-800.png', size: 5, dist: 60, speed: 4 },
        { name: 'venus', img: 'https://img.alicdn.com/imgextra/i3/O1CN01JGEgLU1dfxnVvp91R_!!6000000003764-2-tps-800-800.png', size: 8, dist: 90, speed: 3 },
        { name: 'earth', img: 'https://img.alicdn.com/imgextra/i4/O1CN01R6wlzD1IhhMlBcGLg_!!6000000000925-2-tps-800-800.png', size: 10, dist: 120, speed: 2 },
        { name: 'mars', img: 'https://img.alicdn.com/imgextra/i1/O1CN01OlZAk81OVEHJ0pazq_!!6000000001710-2-tps-800-800.png', size: 7, dist: 150, speed: 1.5 },
        { name: 'jupiter', img: 'https://img.alicdn.com/imgextra/i2/O1CN01MA3Mk51bAhWxWxHim_!!6000000003425-2-tps-800-800.png', size: 12, dist: 180, speed: 1 },
        { name: 'saturn', img: 'https://img.alicdn.com/imgextra/i2/O1CN01NG2FjS1XDDEofNNhg_!!6000000002889-2-tps-800-800.png', size: 24, dist: 210, speed: 0.8 },
        { name: 'uranus', img: 'https://img.alicdn.com/imgextra/i1/O1CN01wnxTX51xIPkTHqPBr_!!6000000006420-2-tps-800-800.png', size: 9, dist: 240, speed: 0.5 },
        { name: 'neptune', img: 'https://img.alicdn.com/imgextra/i1/O1CN01LTf0rT25zwJWsIDkD_!!6000000007598-2-tps-800-800.png', size: 8, dist: 270, speed: 0.4 }
    ];

    let loadedCount = 0;
    planets = planetConfig.map(p => {
        const img = new Image();
        img.src = p.img;
        img.onload = () => {
            loadedCount++;
            if (loadedCount === planetConfig.length) drawSolarSystem();
        };
        return { ...p, image: img };
    });

    // 月球图片
    const moonImg = new Image();
    moonImg.src = 'https://img.alicdn.com/imgextra/i4/O1CN01Ad5SeB20tv1nfRoA2_!!6000000006908-2-tps-800-800.png';
    window.moonImage = moonImg;
}

function drawSolarSystem() {
    if (!solarCanvas || !ctx) return;

    ctx.clearRect(0, 0, solarCanvas.width, solarCanvas.height);

    // 基础中心点
    let centerX = solarCanvas.width / 2;
    let centerY = solarCanvas.height / 2;

    // --- 摄像机跟随逻辑开始 ---
    let targetX = centerX; // 目标应该在的位置
    let targetY = centerY;

    // 1. 计算目标星球当前的实际坐标
    if (simulationState.focusTarget) {
        // 在行星数组里找到这个星球
        const targetPlanet = planets.find(p => p.name.toLowerCase() === simulationState.focusTarget.toLowerCase());

        if (targetPlanet) {
            // 算出它如果不偏移应该在哪里
            const realX = (solarCanvas.width / 2) + Math.cos(angle * targetPlanet.speed) * targetPlanet.dist;
            const realY = (solarCanvas.height / 2) + Math.sin(angle * targetPlanet.speed) * targetPlanet.dist;

            // 我们希望 (realX, realY) 移动到屏幕中心 (centerX, centerY)
            // 所以我们需要反向移动画布
            targetX = (solarCanvas.width / 2) - (realX - (solarCanvas.width / 2));
            targetY = (solarCanvas.height / 2) - (realY - (solarCanvas.height / 2));
        }
    }

    // 2. 平滑过渡 (Lerp算法)：让镜头慢慢移过去，而不是瞬间跳过去
    simulationState.viewOffsetX += (targetX - centerX - simulationState.viewOffsetX) * 0.1;
    simulationState.viewOffsetY += (targetY - centerY - simulationState.viewOffsetY) * 0.1;

    // 最终的绘图基准点
    const drawBaseX = centerX + simulationState.viewOffsetX;
    const drawBaseY = centerY + simulationState.viewOffsetY;
    // --- 摄像机跟随逻辑结束 ---

    // 3. 绘制背景星星 (给一点视差效果，除以 10 让它们动得慢)
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x + simulationState.viewOffsetX * 0.05, star.y + simulationState.viewOffsetY * 0.05, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // 4. 绘制行星
    planets.forEach(p => {
        let pX, pY;

        if (p.dist > 0) {
            // 绘制轨道 (基于新的基准点)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            ctx.setLineDash([5, 5]); // 虚线
            ctx.beginPath();
            // 轨道圆心也要跟着偏移
            ctx.arc(drawBaseX, drawBaseY, p.dist, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // 计算行星位置
            pX = drawBaseX + Math.cos(angle * p.speed) * p.dist;
            pY = drawBaseY + Math.sin(angle * p.speed) * p.dist;

            // 绘制行星本体
            ctx.drawImage(p.image, pX - p.size / 2, pY - p.size / 2, p.size, p.size);

            // 如果是被聚焦的星球，画一个高亮圈
            if (simulationState.focusTarget && p.name.toLowerCase() === simulationState.focusTarget.toLowerCase()) {
                ctx.strokeStyle = "#4dabf7"; // 亮蓝色
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pX, pY, p.size + 10, 0, Math.PI * 2); // 圈比星球大一点
                ctx.stroke();
                ctx.lineWidth = 1;

                // 显示名字
                ctx.fillStyle = "white";
                ctx.font = "bold 16px Arial";
                ctx.fillText(p.name.toUpperCase(), pX + p.size, pY);
            }

            // 地月系特殊处理
            if (p.name === 'earth') {
                const moonAngle = angle * 8;
                const mX = pX + Math.cos(moonAngle) * 15;
                const mY = pY + Math.sin(moonAngle) * 15;
                if(window.moonImage) ctx.drawImage(window.moonImage, mX - 3, mY - 3, 6, 6);
            }

        } else {
            // 太阳 (永远在基准点)
            ctx.drawImage(p.image, drawBaseX - p.size / 2, drawBaseY - p.size / 2, p.size, p.size);
        }
    });

    // 5. 更新时间角度
    angle += 0.005 * simulationState.speedMultiplier;
    requestAnimationFrame(drawSolarSystem);
}

// ======================
// 页面初始化
// ======================
document.addEventListener('DOMContentLoaded', async () => {
    setupMenuSwitch();
    setupImageUpload();
    setupModal();
    setupAuthForms();
    await restoreAuthState(); // 尝试恢复登录状态
    initSolarSystem()
    updateAuthUI();
});

// ======================
// 如果是AI消息，做简单markdown渲染
// ======================
function renderMarkdown(text) {
    if (text == null) {
        text = "";
    }
    // 1. 用 marked 转 HTML
    const rawHtml = marked.parse(String(text));
    // 2. 用 DOMPurify 过滤 XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    // 3. 包裹 markdown-content
    return `<div class="markdown-content">${cleanHtml}</div>`;
}

// ======================
// 菜单切换逻辑（纯前端，无网络请求）
// ======================
function setupMenuSwitch() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(btn => {
        btn.addEventListener('click', async () => {
            menuItems.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const page = btn.dataset.page;
            const chatContainer = document.getElementById('chatContainer');
            const userCenterView = document.getElementById('userCenterView');
            const inputArea = document.getElementById('inputArea');

            if (page === 'chat') {
                chatContainer.style.display = 'flex';
                userCenterView.style.display = 'none';
                inputArea.style.display = 'flex';
            } else if (page === 'user-center') {
                chatContainer.style.display = 'none'; // 保留欢迎语等
                userCenterView.style.display = 'block';
                inputArea.style.display = 'none';
                initSolarSystem();
                updateAuthUI();
            }
        });
    });
}

// ======================
// 图片上传预览
// ======================
function setupImageUpload() {
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');

    imageUpload.addEventListener('change', function () {
        // 先清空旧内容
        imagePreview.innerHTML = '';

        if (this.files && this.files[0]) {
            const reader = new FileReader();

            reader.onload = function (e) {
                // 1. 创建图片
                const img = document.createElement('img');
                img.src = e.target.result;
                // 样式已在 CSS .image-preview img 中定义，这里不需要太多内联样式
                img.onclick = () => openModal(e.target.result);
                imagePreview.appendChild(img);

                // 2. 创建删除按钮（使用 CSS 中已有的 .remove-preview-btn 类）
                const clearBtn = document.createElement('div'); // 用 div 或 button 均可
                clearBtn.className = 'remove-preview-btn';
                clearBtn.innerHTML = '×';

                clearBtn.onclick = (event) => {
                    event.stopPropagation(); // 防止触发图片点击
                    imagePreview.innerHTML = '';
                    imageUpload.value = ''; // 清空 input value，允许重复上传同一张图
                    imagePreview.style.display = 'none'; // [修复点 3] 隐藏容器
                };
                imagePreview.appendChild(clearBtn);

                // [修复点 4] 上传图片后，显示预览容器
                imagePreview.style.display = 'block';
            };

            reader.readAsDataURL(this.files[0]);
        } else {
            // 如果用户取消了文件选择
            imagePreview.style.display = 'none';
        }
    });
}

// ======================
// 图片模态框
// ======================
function setupModal() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.close-btn');

    function openModal(src) {
        modalImg.src = src;
        modal.style.display = 'block';
    }

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // 暴露给全局（用于图片点击）
    window.openModal = openModal;
}

// 统一的退出登录逻辑
function handleLogout() {
    // 1. 数据清理
    localStorage.removeItem('auth_token');
    currentUser = null;
    conversationHistory = [];

    // 2. 界面清理
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) chatContainer.innerHTML = '';

    // 3. 状态切换
    updateAuthUI();

    // 4. 面板重置：如果你在注册页退出的，下次进来是登录页
    const container = document.getElementById('authContainer');
    if (container) container.classList.remove('right-panel-active');

    alert('已安全退出登录');
}

// ======================
// 用户中心：登录/注册表单
// ======================
function setupAuthForms() {
    // 添加切换按钮事件
    const signInBtn = document.getElementById('signIn');
    const signUpBtn = document.getElementById('signUp');
    const container = document.getElementById('authContainer');
    signUpBtn.addEventListener('click', () => {
        container.classList.add('right-panel-active');
    });

    signInBtn.addEventListener('click', () => {
        container.classList.remove('right-panel-active');
    });
    // 登录
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }

        try {
            const res = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('auth_token', data.token);
                currentUser = { username: data.username };
                updateAuthUI();
                alert('登录成功！');
                // 切回聊天页
                document.querySelector('.menu-item[data-page="chat"]').click();
            } else {
                alert('登录失败：' + (data.msg || '用户名或密码错误'));
            }
        } catch (err) {
            console.error(err);
            alert('网络错误，请检查后端是否运行');
        }
    });

    // 注册
    document.getElementById('registerBtn').addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }
        if (password.length < 8 || password.length > 16) {
            alert('密码长度需为 8-16 位');
            return;
        }

        try {
            const res = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                alert('注册成功！请登录');
                // 清空注册框
                document.getElementById('regUsername').value = '';
                document.getElementById('regPassword').value = '';
            } else {
                alert('注册失败：' + (data.msg || '用户名可能已存在'));
            }
        } catch (err) {
            console.error(err);
            alert('网络错误，请检查后端是否运行');
        }
    });

    // 退出登录
    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = handleLogout; // 统一调用 handleLogout
        }
    });
}

// ======================
// 恢复登录状态
// ======================
async function restoreAuthState() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        currentUser = null;
        return false;
    }

    try {
        const res = await fetch('http://localhost:5000/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const profile = await res.json();
            currentUser = {
                username: profile.username,
                registered_at: profile.registered_at // 确保后端字段名一致
            };
            return true;
        }
    } catch (e) {
        console.error('Token 验证失败:', e);
    }

    localStorage.removeItem('auth_token');
    currentUser = null;
    return false;
}

// 退出登录
function logout() {
    localStorage.removeItem('auth_token');
    restoreAuthState(); // 自动切回登录界面
}

// 绑定退出按钮（确保 DOM 加载后绑定）
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// “关于我们”无新窗口显示逻辑
window.showAboutUs = function() {
    const panel = document.getElementById('aboutUsPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
};

window.closeInfoPanel = function() {
    const panel = document.getElementById('aboutUsPanel');
    if (panel) panel.style.display = 'none';
};

// 切换修改密码面板
window.showChangePassword = function() {
    // 隐藏关于我们面板 (互斥)
    if (document.getElementById('aboutUsPanel')) {
        document.getElementById('aboutUsPanel').style.display = 'none';
    }

    const panel = document.getElementById('changePasswordPanel');
    if (panel) {
        // 切换显示/隐藏
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
    }
};

window.closeChangePasswordPanel = function() {
    document.getElementById('changePasswordPanel').style.display = 'none';
};

window.submitChangePassword = submitChangePassword;

async function submitChangePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const token = localStorage.getItem('auth_token');

    // 1. 前端基础校验
    if (!oldPassword || !newPassword || !confirmPassword) {
        alert("请填写完整的密码信息");
        return;
    }

    if (newPassword.length < 8 || newPassword.length > 16) {
        alert("新密码长度需为 8-16 位");
        return;
    }

    if (newPassword !== confirmPassword) {
        alert("两次输入的新密码不一致，请检查");
        return;
    }

    if (!token) {
        alert("登录已失效，请重新登录");
        handleLogout();
        return;
    }

    // 2. 发起后端请求
    try {
        const response = await fetch('http://localhost:5000/api/user/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                oldPassword: oldPassword,
                newPassword: newPassword
            })
        });

        const data = await response.json();

        if (response.ok) {
            // 3. 修改成功处理
            alert("密码修改成功！为了安全，请使用新密码重新登录。");

            // 清空输入框
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';

            // 调用你已有的退出登录函数，强制用户重登
            handleLogout();
        } else {
            // 4. 后端返回错误（如原密码错误）
            alert("修改失败：" + (data.msg || "请求无效"));
        }

    } catch (error) {
        console.error("修改密码请求出错:", error);
        alert("网络连接失败，请检查后端服务是否启动");
    }
}

// ======================
// 更新用户中心 UI
// ======================
function updateAuthUI() {
    const currentUsernameEl = document.getElementById('displayUsername');
    const registeredAtEl = document.getElementById('displayRegisteredAt');
    const userInfoSection = document.getElementById('userInfoSection');
    const authForm = document.getElementById('authForm');

    if (!currentUser) {
        // 未登录：藏起太阳系和卡片，亮出登录框
        if (userInfoSection) userInfoSection.style.display = 'none';
        if (authForm) authForm.style.display = 'flex';
        if (currentUsernameEl) currentUsernameEl.textContent = '未登录';
    } else {
        // 已登录：藏起登录框，亮出三栏布局
        if (userInfoSection) userInfoSection.style.display = 'flex';
        if (authForm) authForm.style.display = 'none';

        if (currentUsernameEl) currentUsernameEl.textContent = currentUser.username;
        if (registeredAtEl) registeredAtEl.textContent = currentUser.registered_at || '同步中...';

        initSolarSystem(); // 重新激活动画
    }
}

// ======================
// 显示欢迎语（仅首次登录后）
// ======================
function showWelcomeMessage() {
    const container = document.getElementById('chatContainer');
    if (container.querySelector('.welcome-message')) return; // 避免重复

    const welcome = document.createElement('div');
    welcome.className = 'message system welcome-message';
    welcome.style.padding = '10px';
    welcome.style.backgroundColor = '#e9ecef';
    welcome.style.borderRadius = '8px';
    welcome.style.marginBottom = '10px';
    welcome.style.color = '#495057';
    welcome.textContent = `Hi～ ${currentUser.username}！我是你的AI助教，有什么可以帮你的吗？`;
    container.prepend(welcome);
}

// ======================
// 发送消息（提问）
// ======================
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const content = userInput.value.trim();
    const imageUpload = document.getElementById('imageUpload');
    const imageFile = imageUpload.files[0];

    // 1. 校验：文字和图片不能同时为空
    if (!content && !imageFile) {
        alert('请输入问题或上传图片');
        return;
    }

    // 2. 获取 Token 并校验登录
    const token = localStorage.getItem('auth_token');
    if (!token) {
        alert('请先登录后再提问！');
        document.querySelector('.menu-item[data-page="user-center"]').click();
        return;
    }

    // 3. 构造本地显示的“用户消息”对象
    let userMessage;
    let formData = new FormData();

    if (imageFile) {
        // 读取图片用于前端即时显示
        const imageUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(imageFile);
        });

        // 构造多模态格式，方便 appendMessageToUI 显示图片
        userMessage = {
            role: 'user',
            content: [
                { type: 'text', text: content || "请分析这张图片。" },
                { type: 'image_url', image_url: { url: imageUrl } }
            ]
        };

        // 填充 FormData
        formData.append('image', imageFile);
        formData.append('message', content);
    } else {
        // 纯文本格式
        userMessage = { role: 'user', content: content };
        formData.append('message', content);
    }

    // 4. UI 即时显示用户消息
    appendMessageToUI(userMessage, 'user');

    // 5. 准备发送给后端的历史记录（保留你之前的过滤逻辑，但增加对数组内容的支持）
    let historyToSend = [...conversationHistory, userMessage];
    historyToSend = historyToSend.filter(msg =>
        msg &&
        typeof msg === 'object' &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        (typeof msg.content === 'string' || Array.isArray(msg.content)) // 允许数组格式
    );

    if (historyToSend.length === 0) historyToSend = [userMessage];

    // 将 history 放入 FormData
    formData.append('history', JSON.stringify(historyToSend));
    if (typeof currentConversationId !== 'undefined' && currentConversationId) {
        formData.append('conversation_id', currentConversationId);
    }

    // 6. 清空输入区域
    userInput.value = '';
    imageUpload.value = '';
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
        imagePreview.style.display = 'none';
    }

    try {
        // 7. 发送请求 (注意：发送 FormData 时不要手动设置 Content-Type)
        const response = await fetch('http://localhost:5000/api/ask', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        // 8. 登录过期处理
        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            localStorage.removeItem('auth_token');
            currentUser = null;
            if (typeof updateAuthUI === 'function') updateAuthUI();
            document.querySelector('.menu-item[data-page="user-center"]').click();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // 9. 处理 AI 返回结果
        const data = await response.json();

        // 预处理 AI 回复，提取指令
        let cleanAnswer = handleAgentCommands(data.answer);

        const aiMessage = { role: 'assistant', content: cleanAnswer };
        appendMessageToUI(aiMessage, 'assistant');

        // 10. 更新本地历史和会话ID
        conversationHistory = [...historyToSend, aiMessage];
        if (data.conversation_id) {
            currentConversationId = data.conversation_id;
        }

    } catch (error) {
        console.error('请求失败:', error);
        alert(`请求失败: ${error.message}`);
        // 11. 失败回滚：从 UI 移除刚刚添加的用户消息
        const container = document.getElementById('chatContainer');
        if (container && container.lastChild) {
            container.removeChild(container.lastChild);
        }
    }
}

// ======================
// 在页面追加消息
// ======================
function appendMessageToUI(message, role) {
    const container = document.getElementById('chatContainer');
    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user' ? 'message user-message' : 'message ai-message';

    let htmlContent = "";

    // 判断内容是否是多模态数组 (带图片的情况)
    if (Array.isArray(message.content)) {
        const textItem = message.content.find(i => i.type === 'text');
        const imageItem = message.content.find(i => i.type === 'image_url');

        if (imageItem) {
            htmlContent += `<img src="${imageItem.image_url.url}" style="max-width:100%; border-radius:8px; margin-bottom:8px; cursor:zoom-in;" onclick="window.open(this.src)">`;
        }
        if (textItem && textItem.text) {
            htmlContent += renderMarkdown(textItem.text);
        }
    } else {
        // 纯文本情况
        htmlContent = renderMarkdown(message.content || '');
    }

    msgDiv.innerHTML = htmlContent;
    container.appendChild(msgDiv);

    // KaTeX渲染
    if (window.renderMathInElement) {
        renderMathInElement(msgDiv, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true},
                {left: '(', right: ')', display: false}, // 匹配 (\frac{0}{0})
                {left: '[', right: ']', display: true}   // 匹配 [ \lim... ]
            ],
            // 忽略一些可能干扰公式的标签
            ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
            throwOnError: false
        });
    }

    container.scrollTop = container.scrollHeight;
}

// 指令解析器
function handleAgentCommands(fullText) {
    // 1. 正则表达式：寻找 ```json { ... } ``` 结构
    const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
    const match = fullText.match(jsonRegex);

    if (match && match[1]) {
        try {
            const command = JSON.parse(match[1]);
            console.log("收到指挥官指令:", command);

            // 2. 执行指令
            if (command.action === 'focus') {
                simulationState.focusTarget = command.target;

                // 自动切换到用户中心（也就是显示太阳系的那一页），否则用户看不到动画
                // 注意：这里需要确保你有对应 ID 的元素
                const userCenterBtn = document.querySelector('.menu-item[data-page="user-center"]');
                if (userCenterBtn) userCenterBtn.click();
            }
            // >>> 新增：3D 几何处理
            else if (command.action === 'geometry_3d') {
                showFeaturePanel('geometryPanel');
                init3DGeometry(command);
            }
            // >>> 新增：历史时间轴处理
            else if (command.action === 'timeline') {
                showFeaturePanel('timelinePanel');
                renderTimeline(command.events);
            }

            // 3. 返回去除 JSON 后的纯文本，不让用户看到乱码
            return fullText.replace(jsonRegex, '').trim();

        } catch (e) {
            console.error("指令解析失败:", e);
        }
    }
    // 如果没有指令，原样返回
    return fullText;
}

// 通用面板控制
function showFeaturePanel(panelId) {
    // 1. 先隐藏所有可能打开的特性面板
    document.querySelectorAll('.feature-panel').forEach(p => p.style.display = 'none');

    // 2. 显示目标面板
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'flex'; // 使用 flex 确保内部布局正常
        panel.style.opacity = '1';

        // 3. 如果是时间轴，确保重新渲染内容并触发动画
        if (panelId === 'timelinePanel') {
            // 假设你有一个存储数据的变量 timelineData
            if (window.lastTimelineData) {
                renderTimeline(window.lastTimelineData);
            }
        }
    }
}

function closeFeaturePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'none';
    }
}


// ====================================================
// 3D 几何渲染模块 (Three.js) - 增强版
// ====================================================
let geometryScene, geometryCamera, geometryRenderer;
let labelRenderer, controls, axisHelper;
let isDrawMode = false;
let isLabelMode = false;
let isMeasureMode = false;
let showFaces = false;
let showAxis = true;
let currentDrawColor = '#ffff00'; // 当前辅助线颜色（十六进制字符串）
let selectedPoints = [];           // 用于绘线/测量的已选点
let pendingLabelPoint = null;      // 等待输入标注文字的点
let faceMeshGroup = null;          // 面渲染组
let userAnnotationsGroup = null;   // 用户标注组
let geoInitDone = false;
let lastGeoData = null;            // 保存最新一次几何数据
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();

// ---- 初始化 Three.js 场景（仅一次）----
function ensureGeometryRenderer() {
    const container = document.getElementById('threeJsContainer');
    if (geoInitDone) return;
    geoInitDone = true;

    geometryScene = new THREE.Scene();
    geometryScene.background = new THREE.Color(0x0d0d1a); // 深蓝黑背景

    geometryCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.01, 500);

    geometryRenderer = new THREE.WebGLRenderer({ antialias: true });
    geometryRenderer.setPixelRatio(window.devicePixelRatio);
    geometryRenderer.setSize(container.clientWidth, container.clientHeight);
    geometryRenderer.shadowMap.enabled = true;
    geometryRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:1;';
    container.appendChild(geometryRenderer.domElement);

    // CSS2D 标签层
    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:2;pointer-events:none;';
    container.appendChild(labelRenderer.domElement);

    // 轨道控制器
    controls = new THREE.OrbitControls(geometryCamera, geometryRenderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;

    // 环境光 + 方向光（更真实的阴影感）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    geometryScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    geometryScene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, -3, -5);
    geometryScene.add(fillLight);

    // 坐标轴辅助器
    axisHelper = new THREE.AxesHelper(3);
    geometryScene.add(axisHelper);

    // 用户标注层
    userAnnotationsGroup = new THREE.Group();
    userAnnotationsGroup.name = 'userAnnotations';
    geometryScene.add(userAnnotationsGroup);

    // 点击事件
    container.addEventListener('click', onSceneClick);

    // 键盘快捷键
    document.addEventListener('keydown', onGeoKeyDown);

    // 响应式 resize
    const resizeObs = new ResizeObserver(() => {
        if (!geometryRenderer) return;
        const w = container.clientWidth, h = container.clientHeight;
        geometryCamera.aspect = w / h;
        geometryCamera.updateProjectionMatrix();
        geometryRenderer.setSize(w, h);
        labelRenderer.setSize(w, h);
    });
    resizeObs.observe(container);

    // 渲染循环
    (function animate() {
        requestAnimationFrame(animate);
        controls.update();
        geometryRenderer.render(geometryScene, geometryCamera);
        labelRenderer.render(geometryScene, geometryCamera);
    })();
}

// ---- 主入口：构建几何体 ----
function init3DGeometry(data) {
    lastGeoData = data;
    ensureGeometryRenderer();

    // 更新 AI 说明文本
    const explContent = document.getElementById('explContent');
    if (explContent) {
        explContent.innerHTML = data.explanation || '暂无分析说明';
    }
    // 展开说明面板
    const expl = document.getElementById('geometryExplanation');
    if (expl) {
        expl.classList.remove('collapsed');
        const icon = document.getElementById('explToggleIcon');
        if (icon) icon.textContent = '▼ 收起';
    }

    // 清除旧几何体
    clearOldGeometry();

    const mainGroup = new THREE.Group();
    mainGroup.name = 'mainGroup';
    geometryScene.add(mainGroup);

    // 面渲染组
    faceMeshGroup = new THREE.Group();
    faceMeshGroup.name = 'faceMeshGroup';
    faceMeshGroup.visible = showFaces;
    mainGroup.add(faceMeshGroup);

    if (!data.lines || data.lines.length === 0) return;

    // --- 收集所有顶点 ---
    const verticesMap = new Map(); // key -> {pos, label}
    const allPoints = [];

    data.lines.forEach(line => {
        if (!line.start || !line.end) return;
        ['start', 'end'].forEach((side, i) => {
            const p = line[side];
            const key = p.map(v => v.toFixed(3)).join(',');
            if (!verticesMap.has(key)) {
                const label = (i === 0 ? line.startLabel : line.endLabel) || null;
                verticesMap.set(key, { pos: p, label });
                allPoints.push(p);
            } else if (i === 0 && line.startLabel) {
                verticesMap.get(key).label = line.startLabel;
            } else if (i === 1 && line.endLabel) {
                verticesMap.get(key).label = line.endLabel;
            }
        });
    });

    // 给未命名顶点自动分配字母
    let autoIdx = 0;
    const usedLabels = new Set([...verticesMap.values()].map(v => v.label).filter(Boolean));
    verticesMap.forEach(v => {
        if (!v.label) {
            while (usedLabels.has(String.fromCharCode(65 + autoIdx))) autoIdx++;
            v.label = String.fromCharCode(65 + autoIdx++);
            usedLabels.add(v.label);
        }
    });

    // --- 绘制线段 ---
    data.lines.forEach(line => {
        if (!line.start || !line.end) return;
        const isAux = line.type === 'aux';
        const pts = [new THREE.Vector3(...line.start), new THREE.Vector3(...line.end)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);

        let mat;
        if (isAux) {
            // 辅助线：红色虚线
            mat = new THREE.LineDashedMaterial({ color: 0xff5555, dashSize: 0.12, gapSize: 0.06, linewidth: 2 });
        } else {
            // 主线：亮蓝实线
            mat = new THREE.LineBasicMaterial({ color: 0x4dabf7, linewidth: 2 });
        }
        const seg = new THREE.Line(geo, mat);
        if (isAux) seg.computeLineDistances();
        seg.userData.isModelLine = true;
        mainGroup.add(seg);
    });

    // --- 添加顶点标签和可点击球 ---
    verticesMap.forEach((v, key) => {
        addVertexLabel(v.pos, v.label, mainGroup);
        addVertexClickPoint(v.pos, mainGroup);
    });

    // --- 自动生成半透明面（基于shape字段） ---
    if (data.shape) {
        if (data.shape === 'cylinder') {
            buildCylinder(data, faceMeshGroup);
        } else if (data.shape === 'sphere') {
            buildSphere(data, faceMeshGroup);
        } else {
            buildFaceMesh(data, allPoints, faceMeshGroup);
        }
    }

    // --- 自动对齐摄像机 ---
    fitCameraToGroup(mainGroup);
}

// 从几何数据推断面并渲染
function buildFaceMesh(data, allPoints, group) {
    if (!allPoints || allPoints.length < 3) return;
    // 找出独特的底面和顶面（z 值相近的归为同一层）
    const layers = {};
    allPoints.forEach(p => {
        const zKey = p[2].toFixed(2);
        if (!layers[zKey]) layers[zKey] = [];
        layers[zKey].push(p);
    });
    const zLevels = Object.keys(layers).sort((a, b) => parseFloat(a) - parseFloat(b));

    const faceColor = 0x4dabf7;
    const faceOpacity = 0.10;
    const edgeColor = 0x88ccff;

    zLevels.forEach(zKey => {
        const pts = layers[zKey];
        if (pts.length < 3) return;
        // 用凸包（简单多边形排序）来覆盖面
        const centroid = pts.reduce((a, b) => [a[0]+b[0], a[1]+b[1], 0], [0,0,0]).map(v => v / pts.length);
        const sorted = [...pts].sort((a, b) => {
            return Math.atan2(a[1]-centroid[1], a[0]-centroid[0]) - Math.atan2(b[1]-centroid[1], b[0]-centroid[0]);
        });

        const shape = new THREE.Shape();
        shape.moveTo(sorted[0][0], sorted[0][1]);
        for (let i = 1; i < sorted.length; i++) {
            shape.lineTo(sorted[i][0], sorted[i][1]);
        }
        shape.closePath();

        const faceGeo = new THREE.ShapeGeometry(shape);
        // 把 z 提到正确高度
        const z = parseFloat(zKey);
        const faceMat = new THREE.MeshBasicMaterial({ color: faceColor, transparent: true, opacity: faceOpacity, side: THREE.DoubleSide, depthWrite: false });
        const faceMesh = new THREE.Mesh(faceGeo, faceMat);
        faceMesh.position.z = z;
        group.add(faceMesh);
    });

    // 侧面（每层之间对应顶点连成四边形）
    if (zLevels.length === 2) {
        const bottom = layers[zLevels[0]];
        const top = layers[zLevels[1]];
        if (bottom.length === top.length && bottom.length >= 3) {
            const centB = bottom.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],0],[0,0,0]).map(v=>v/bottom.length);
            const centT = top.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],0],[0,0,0]).map(v=>v/top.length);
            const sortedB = [...bottom].sort((a,b)=>Math.atan2(a[1]-centB[1],a[0]-centB[0])-Math.atan2(b[1]-centB[1],b[0]-centB[0]));
            const sortedT = [...top].sort((a,b)=>Math.atan2(a[1]-centT[1],a[0]-centT[0])-Math.atan2(b[1]-centT[1],b[0]-centT[0]));

            for (let i = 0; i < sortedB.length; i++) {
                const next = (i + 1) % sortedB.length;
                const verts = [
                    new THREE.Vector3(...sortedB[i]),
                    new THREE.Vector3(...sortedB[next]),
                    new THREE.Vector3(...sortedT[next]),
                    new THREE.Vector3(...sortedT[i])
                ];
                const geo = new THREE.BufferGeometry();
                const pos = new Float32Array([
                    ...verts[0].toArray(), ...verts[1].toArray(), ...verts[2].toArray(),
                    ...verts[0].toArray(), ...verts[2].toArray(), ...verts[3].toArray()
                ]);
                geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                const mat = new THREE.MeshBasicMaterial({ color: faceColor, transparent: true, opacity: faceOpacity, side: THREE.DoubleSide, depthWrite: false });
                group.add(new THREE.Mesh(geo, mat));
            }
        }
    }
}

// 摄像机自适应
function fitCameraToGroup(group) {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 3;
    const dist = maxDim * 2.2;

    group.position.sub(center); // 居中
    geometryCamera.position.set(dist * 0.7, dist * 0.7, dist * 0.9);
    geometryCamera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    window._geoDefaultCamPos = geometryCamera.position.clone();
}

// 清除旧几何
function clearOldGeometry() {
    ['mainGroup', 'faceMeshGroup'].forEach(name => {
        const obj = geometryScene.getObjectByName(name);
        if (obj) geometryScene.remove(obj);
    });
    document.querySelectorAll('.vertex-label, .user-annotation-label').forEach(el => el.remove());
}

// 顶点标签
function addVertexLabel(pos, text, group) {
    const div = document.createElement('div');
    div.className = 'vertex-label';
    div.textContent = text;
    const label = new THREE.CSS2DObject(div);
    label.position.set(pos[0] + 0.08, pos[1] + 0.08, pos[2]);
    group.add(label);
}

// 可点击顶点（透明球）
function addVertexClickPoint(pos, group) {
    const geo = new THREE.SphereGeometry(0.07);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.01 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.userData.isVertex = true;
    group.add(mesh);
}

// ---- 工具栏功能 ----

function updateDrawColor(hex) {
    currentDrawColor = hex;
    const preview = document.getElementById('colorPreview');
    if (preview) preview.style.background = hex;
}

function toggleDrawMode() {
    isDrawMode = !isDrawMode;
    if (isDrawMode) { isLabelMode = false; isMeasureMode = false; selectedPoints = []; }
    const btn = document.getElementById('drawModeBtn');
    btn.classList.toggle('active', isDrawMode);
    btn.querySelector('span').textContent = isDrawMode ? '✏️ 画线 (退出)' : '✏️ 画线';
    updateStatusBar();
}

function toggleLabelMode() {
    isLabelMode = !isLabelMode;
    if (isLabelMode) { isDrawMode = false; isMeasureMode = false; selectedPoints = []; }
    const btn = document.getElementById('labelModeBtn');
    btn.classList.toggle('active', isLabelMode);
    btn.querySelector('span').textContent = isLabelMode ? '🏷️ 标注 (退出)' : '🏷️ 标注';
    updateStatusBar();
}

function toggleMeasureMode() {
    isMeasureMode = !isMeasureMode;
    if (isMeasureMode) { isDrawMode = false; isLabelMode = false; selectedPoints = []; }
    const btn = document.getElementById('measureBtn');
    btn.classList.toggle('active', isMeasureMode);
    btn.querySelector('span').textContent = isMeasureMode ? '📏 测量 (退出)' : '📏 测量';
    const result = document.getElementById('measureResult');
    if (!isMeasureMode && result) result.style.display = 'none';
    updateStatusBar();
}

function toggleFaceRender() {
    showFaces = !showFaces;
    const btn = document.getElementById('faceToggleBtn');
    btn.classList.toggle('active', showFaces);
    btn.querySelector('span').textContent = showFaces ? '🔷 隐面' : '🔷 显面';
    const group = geometryScene && geometryScene.getObjectByName('faceMeshGroup');
    if (group) group.visible = showFaces;
    // 子面板也跟随
    geometryScene && geometryScene.traverse(obj => {
        if (obj.name === 'faceMeshGroup') obj.visible = showFaces;
    });
}

function toggleAxisHelper() {
    showAxis = !showAxis;
    if (axisHelper) axisHelper.visible = showAxis;
    const btn = document.getElementById('axisToggleBtn');
    btn.classList.toggle('active', showAxis);
    btn.querySelector('span').textContent = showAxis ? '📊 坐标轴' : '📊 坐标轴';
}

function resetCamera() {
    if (!controls || !geometryCamera) return;
    if (window._geoDefaultCamPos) {
        geometryCamera.position.copy(window._geoDefaultCamPos);
    } else {
        geometryCamera.position.set(4, 4, 5);
    }
    geometryCamera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

function toggleExplanation() {
    const expl = document.getElementById('geometryExplanation');
    const content = document.getElementById('explContent');
    const icon = document.getElementById('explToggleIcon');
    if (!expl || !content || !icon) return;
    const isCollapsed = expl.classList.toggle('collapsed');
    content.style.display = isCollapsed ? 'none' : 'block';
    icon.textContent = isCollapsed ? '▲ 展开' : '▼ 收起';
}

function updateStatusBar() {
    const bar = document.getElementById('geoStatusBar');
    if (!bar) return;
    if (isDrawMode) {
        bar.textContent = `✏️ 画线模式：点击选择两个顶点，连接辅助线（当前颜色：${currentDrawColor}）| 再次点击"画线"退出`;
        bar.style.background = 'rgba(77,171,247,0.25)';
    } else if (isLabelMode) {
        bar.textContent = '🏷️ 标注模式：点击场景中任意顶点，输入标注文字 | 再次点击"标注"退出';
        bar.style.background = 'rgba(255,200,0,0.2)';
    } else if (isMeasureMode) {
        bar.textContent = '📏 测量模式：点击选择两个顶点，自动计算距离 | 再次点击"测量"退出';
        bar.style.background = 'rgba(100,255,150,0.2)';
    } else {
        bar.textContent = '旋转：左键拖动 | 缩放：滚轮 | 平移：右键拖动 | 快捷键：D=画线 L=标注 M=测量 F=显面 A=坐标轴 R=复位';
        bar.style.background = 'rgba(0,0,0,0.5)';
    }
}

// 键盘快捷键
function onGeoKeyDown(e) {
    const geoPanel = document.getElementById('geometryPanel');
    if (!geoPanel || geoPanel.style.display === 'none') return;
    // 如果焦点在输入框则不触发
    if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    switch(e.key.toLowerCase()) {
        case 'd': toggleDrawMode(); break;
        case 'l': toggleLabelMode(); break;
        case 'm': toggleMeasureMode(); break;
        case 'f': toggleFaceRender(); break;
        case 'a': toggleAxisHelper(); break;
        case 'r': resetCamera(); break;
        case 'c': clearUserLines(); break;
        case 'escape':
            if (isDrawMode) toggleDrawMode();
            if (isLabelMode) toggleLabelMode();
            if (isMeasureMode) toggleMeasureMode();
            selectedPoints = [];
            break;
    }
}

// ---- 点击交互（画线 / 标注 / 测量）----
function onSceneClick(event) {
    if (!isDrawMode && !isLabelMode && !isMeasureMode) return;

    const container = document.getElementById('threeJsContainer');
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, geometryCamera);
    const mainGroup = geometryScene.getObjectByName('mainGroup');
    if (!mainGroup) return;
    raycaster.params.Line.threshold = 0.15;

    const intersects = raycaster.intersectObjects(mainGroup.children, true);
    if (intersects.length === 0) return;

    const vertexHit = intersects.find(i => i.object.userData && i.object.userData.isVertex);
    let hitPoint;
    if (vertexHit) {
        hitPoint = vertexHit.object.position.clone();
        // 转换到世界坐标
        vertexHit.object.localToWorld(hitPoint);
        mainGroup.worldToLocal(hitPoint);
    } else {
        hitPoint = intersects[0].point.clone();
        mainGroup.worldToLocal(hitPoint);
    }

    // --- 模式分支 ---
    if (isDrawMode) handleDrawClick(hitPoint, mainGroup);
    else if (isLabelMode) handleLabelClick(hitPoint, mainGroup);
    else if (isMeasureMode) handleMeasureClick(hitPoint, mainGroup);
}

function showFeedbackDot(point, group, color) {
    const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06),
        new THREE.MeshBasicMaterial({ color })
    );
    dot.position.copy(point);
    dot.name = 'tempFeedbackDot';
    group.add(dot);
    setTimeout(() => group.remove(dot), 800);
}

function handleDrawClick(hitPoint, mainGroup) {
    selectedPoints.push(hitPoint.clone());
    showFeedbackDot(hitPoint, mainGroup, 0x4dabf7);

    if (selectedPoints.length === 2) {
        drawUserLine(selectedPoints[0], selectedPoints[1], currentDrawColor);
        selectedPoints = [];
    } else {
        const bar = document.getElementById('geoStatusBar');
        if (bar) bar.textContent = '已选第1个点，请点击第2个点完成画线...';
    }
}

function handleLabelClick(hitPoint, mainGroup) {
    pendingLabelPoint = { point: hitPoint.clone(), group: mainGroup };
    const box = document.getElementById('labelInputBox');
    if (box) {
        box.style.display = 'flex';
        document.getElementById('labelInputText').value = '';
        document.getElementById('labelInputText').focus();
    }
}

function confirmLabel() {
    const text = document.getElementById('labelInputText').value.trim();
    const box = document.getElementById('labelInputBox');
    if (box) box.style.display = 'none';
    if (!text || !pendingLabelPoint) { pendingLabelPoint = null; return; }

    const { point, group } = pendingLabelPoint;
    const div = document.createElement('div');
    div.className = 'user-annotation-label';
    div.textContent = text;
    div.style.cssText = 'background:rgba(255,200,0,0.85);color:#000;padding:2px 7px;border-radius:10px;font-size:13px;font-weight:bold;cursor:default;';
    const label = new THREE.CSS2DObject(div);
    label.position.copy(point);
    label.userData.isUserAnnotation = true;
    group.add(label);

    pendingLabelPoint = null;
    updateStatusBar();
}

function cancelLabel() {
    pendingLabelPoint = null;
    const box = document.getElementById('labelInputBox');
    if (box) box.style.display = 'none';
}

function handleMeasureClick(hitPoint, mainGroup) {
    selectedPoints.push(hitPoint.clone());
    showFeedbackDot(hitPoint, mainGroup, 0x69db8a);

    if (selectedPoints.length === 2) {
        const dist = selectedPoints[0].distanceTo(selectedPoints[1]);
        const result = document.getElementById('measureResult');
        if (result) {
            result.style.display = 'block';
            result.innerHTML = `📏 两点距离：<strong>${dist.toFixed(3)}</strong> 单位`;
        }
        // 在两点间画一条测量线（绿色）
        const geo = new THREE.BufferGeometry().setFromPoints([selectedPoints[0], selectedPoints[1]]);
        const mat = new THREE.LineBasicMaterial({ color: 0x69db8a, linewidth: 2 });
        const line = new THREE.Line(geo, mat);
        line.userData.isMeasureLine = true;
        mainGroup.add(line);

        selectedPoints = [];
        updateStatusBar();
    } else {
        const bar = document.getElementById('geoStatusBar');
        if (bar) bar.textContent = '已选第1个点，请点击第2个点完成测量...';
    }
}

function drawUserLine(start, end, colorHex) {
    const mainGroup = geometryScene && geometryScene.getObjectByName('mainGroup');
    if (!mainGroup) return;

    const colorInt = parseInt(colorHex.replace('#',''), 16);
    const geo = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineDashedMaterial({ color: colorInt, dashSize: 0.1, gapSize: 0.06, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    line.userData.isUserLine = true;
    mainGroup.add(line);
}

function clearUserLines() {
    const mainGroup = geometryScene && geometryScene.getObjectByName('mainGroup');
    if (!mainGroup) return;
    for (let i = mainGroup.children.length - 1; i >= 0; i--) {
        const child = mainGroup.children[i];
        if (child.userData.isUserLine || child.userData.isMeasureLine) {
            mainGroup.remove(child);
        }
    }
    // 清除用户标注
    if (userAnnotationsGroup) {
        while (userAnnotationsGroup.children.length > 0)
            userAnnotationsGroup.remove(userAnnotationsGroup.children[0]);
    }
    // 也清主组里的用户标注
    mainGroup.traverse(obj => {
        if (obj instanceof THREE.CSS2DObject && obj.userData.isUserAnnotation) {
            mainGroup.remove(obj);
        }
    });
    document.querySelectorAll('.user-annotation-label').forEach(el => el.remove());
    const result = document.getElementById('measureResult');
    if (result) result.style.display = 'none';
    selectedPoints = [];
}

// ---- 圆柱体特殊渲染（当 shape === 'cylinder'）----
function buildCylinder(data, group) {
    const radiusTop = data.radiusTop || data.radius || 0.5;
    const radiusBottom = data.radiusBottom || data.radius || 0.5;
    const height = data.height || 1;
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4dabf7, transparent: true, opacity: 0.15, side: THREE.DoubleSide, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isFaceMesh = true;
    group.add(mesh);
    // 顶底圆
    [height/2, -height/2].forEach(y => {
        const circleGeo = new THREE.CircleGeometry(y > 0 ? radiusTop : radiusBottom, 32);
        const circleMat = new THREE.MeshBasicMaterial({ color: 0x4dabf7, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(circleGeo, circleMat);
        circle.rotation.x = Math.PI / 2;
        circle.position.y = y;
        group.add(circle);
    });
    // 轮廓线
    const edges = new THREE.EdgesGeometry(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16));
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x4dabf7 });
    group.add(new THREE.LineSegments(edges, edgeMat));
}

// ---- 球体特殊渲染（当 shape === 'sphere'）----
function buildSphere(data, group) {
    const radius = data.radius || 0.8;
    const geo = new THREE.SphereGeometry(radius, 24, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4dabf7, transparent: true, opacity: 0.12, wireframe: false });
    group.add(new THREE.Mesh(geo, mat));
    // 纬线
    const edgesGeo = new THREE.EdgesGeometry(new THREE.SphereGeometry(radius, 12, 8));
    group.add(new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x88ccff, opacity: 0.5, transparent: true })));
    // 赤道大圆
    const equator = new THREE.RingGeometry(radius - 0.005, radius + 0.005, 64);
    group.add(new THREE.Mesh(equator, new THREE.MeshBasicMaterial({ color: 0x4dabf7, side: THREE.DoubleSide })));
}

// ---- 导出截图 ----
function exportGeoSnapshot() {
    if (!geometryRenderer) return;
    geometryRenderer.render(geometryScene, geometryCamera);
    const url = geometryRenderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geometry_3d.png';
    a.click();
}

// ---- 标注输入框回车确认 ----
document.addEventListener('DOMContentLoaded', () => {
    const labelInput = document.getElementById('labelInputText');
    if (labelInput) {
        labelInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmLabel(); }
            if (e.key === 'Escape') cancelLabel();
        });
    }
    // 颜色选择器点击转发
    const colorBtn = document.querySelector('.color-btn');
    if (colorBtn) {
        colorBtn.addEventListener('click', () => {
            const picker = document.getElementById('lineColorPicker');
            if (picker) picker.click();
        });
    }
});

// 4. 实现时间轴渲染

function renderTimeline(events) {
    const container = document.getElementById('timelineContent');
    if (!container) {
        console.error("未找到 timelineContent 容器");
        return;
    }

    container.innerHTML = ''; // 清空旧内容
    // 强制滚动回到顶部
    container.scrollTop = 0;

    events.forEach((event, index) => {
        const item = document.createElement('div');
        item.className = 'timeline-item';

        // 确保动画名称对应
        item.style.animation = `slideIn 0.5s ease-out ${index * 0.1}s forwards`;

        item.innerHTML = `
            <div class="timeline-dot" style="position:absolute; left:-37px; top:5px; width:12px; height:12px; background:var(--accent); border-radius:50%; box-shadow:0 0 10px var(--accent);"></div>
            <div class="timeline-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
                <div class="timeline-date" style="color:var(--accent); font-weight:bold; font-size:0.9em;">${event.date}</div>
                <h4 style="margin:5px 0; color:#fff;">${event.title}</h4>
                <p style="font-size:0.9em; color:#bbb; line-height:1.4;">${event.desc}</p>
            </div>
        `;

        // 添加交互：点击展示详情
        item.querySelector('.timeline-card').onclick = () => {
            console.log(`查看详情: ${event.title}`);
            // 你可以这里调用一个专门的弹窗函数
            showEventDetail(event);
        };

        container.appendChild(item);
    });
}

// 补充动画效果
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes slideInRight {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(styleSheet);

// ======================
// 绑定发送按钮和回车键
// ======================
document.getElementById('sendBtn').addEventListener('click', sendMessage);

document.getElementById('userInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
