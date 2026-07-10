// 全局状态
const emotions = ['angry', 'happy', 'sad', 'neutral'];
let selectedEmotion = 'neutral';
let TTS_AVAILABLE = true;

// 识别相关元素
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const fileInfo = document.getElementById('fileInfo');
const audioPlayer = document.getElementById('audioPlayer');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorDiv = document.getElementById('errorDiv');
const loadingDiv = document.querySelector('.loading');
const resultsSection = document.getElementById('resultsSection');

// 识别结果元素
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const uploadTime = document.getElementById('uploadTime');
const predictedEmotion = document.getElementById('predictedEmotion');
const confidence = document.getElementById('confidence');
const probabilitiesDiv = document.getElementById('probabilitiesDiv');

// 生成相关元素
const emotionSelector = document.getElementById('emotionSelector');
const textInput = document.getElementById('textInput');
const generateBtn = document.getElementById('generateBtn');
const generationLoadingDiv = document.getElementById('generationLoadingDiv');
const responseSection = document.getElementById('responseSection');
const generatedEmotion = document.getElementById('generatedEmotion');
const responseText = document.getElementById('responseText');
const generatedAudio = document.getElementById('generatedAudio');
const generatedAudioPlayer = document.getElementById('generatedAudioPlayer');
const ttsWarning = document.getElementById('ttsWarning');

// 检查 TTS 模型是否可用
async function checkTTSStatus() {
    try {
        const res = await fetch('http://localhost:5000/health');
        const data = await res.json();

        if (ttsWarning) {
            if (data.tts_available) {
                ttsWarning.style.display = 'none';
                // 启用情感按钮
                const emotionOptions = document.querySelectorAll('.emotion-option');
                emotionOptions.forEach(opt => opt.disabled = false);
            } else {
                ttsWarning.style.display = 'block';
                // 禁用情感按钮
                const emotionOptions = document.querySelectorAll('.emotion-option');
                emotionOptions.forEach(opt => opt.disabled = true);
            }
        }

        // 更新全局状态（用于 generateAudio 判断）
        window.TTS_AVAILABLE = data.tts_available;

    } catch (err) {
        console.warn('无法连接后端 /health，假设 TTS 不可用');
        if (ttsWarning) {
            ttsWarning.style.display = 'block';
        }
        const emotionOptions = document.querySelectorAll('.emotion-option');
        emotionOptions.forEach(opt => opt.disabled = true);
        window.TTS_AVAILABLE = false;
    }
}

// 文件拖拽上传
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    // 验证文件类型
    if (!file.type.startsWith('audio/')) {
        showError('请选择音频文件！');
        return;
    }

    // 显示文件信息
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    uploadTime.textContent = new Date().toLocaleString();

    // 显示文件信息区域
    fileInfo.classList.add('show');

    // 设置音频播放源
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;

    // 启用分析按钮
    analyzeBtn.disabled = false;
    analyzeBtn.onclick = analyzeAudio; // 绑定新的分析函数

    // 隐藏错误信息
    hideError();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

function hideError() {
    errorDiv.classList.remove('show');
}

// 修改后的分析函数 - 连接到Flask后端
async function analyzeAudio() {
    const file = fileInput.files[0];

    if (!file) {
        showError('请先选择一个音频文件！');
        return;
    }

    // 显示加载状态 - 找到正确的loading div
    const correctLoadingDiv = document.querySelector('#recognition .loading');
    if (correctLoadingDiv) {
        correctLoadingDiv.style.display = 'block';
    }

    analyzeBtn.disabled = true;
    resultsSection.classList.remove('show');
    hideError();

    const formData = new FormData();
    formData.append('audio', file);

    try {
        // 调用Flask后端
        const response = await fetch('http://localhost:5000/predict', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '服务器返回错误');
        }

        // 显示结果
        displayResultsFromBackend(result);

        // 显示结果区域
        resultsSection.classList.add('show');

    } catch (error) {
        console.error('识别失败:', error);
        showError('识别失败: ' + error.message);
    } finally {
        // 隐藏加载状态
        const correctLoadingDiv = document.querySelector('#recognition .loading');
        if (correctLoadingDiv) {
            correctLoadingDiv.style.display = 'none';
        }
        analyzeBtn.disabled = false;
    }
}

// 显示后端返回的结果
function displayResultsFromBackend(result) {
    // 显示预测结果
    predictedEmotion.textContent = result.predicted_emotion.toUpperCase();
    confidence.textContent = `置信度: ${(result.confidence * 100).toFixed(2)}%`;

    // 清空之前的概率条
    probabilitiesDiv.innerHTML = '';

    // 生成置信度条
    emotions.forEach(emotion => {
        const prob = result.probabilities[emotion];

        const probItem = document.createElement('div');
        probItem.className = 'prob-item';

        probItem.innerHTML = `
            <div class="emotion-name">${emotion.toUpperCase()}</div>
            <div class="prob-bar">
                <div class="prob-fill" style="width: ${(prob * 100)}%"></div>
            </div>
            <div class="prob-value">${(prob * 100).toFixed(2)}%</div>
        `;

        probabilitiesDiv.appendChild(probItem);
    });
}

// 语音生成相关功能
function selectEmotion(emotion) {
    // 清除之前的选择
    const options = document.querySelectorAll('.emotion-option');
    options.forEach(option => {
        option.classList.remove('selected');
    });

    // 高亮当前选择
    const selectedOption = event.target;
    selectedOption.classList.add('selected');

    // 更新选中的情感
    selectedEmotion = emotion;

    // 启用生成按钮（如果文本也输入了）
    if (textInput.value.trim() !== '') {
        generateBtn.disabled = false;
    }
}

// 监听文本输入变化
textInput.addEventListener('input', function() {
    // 如果有文本且选择了情感，启用生成按钮
    if (selectedEmotion && textInput.value.trim() !== '') {
        generateBtn.disabled = false;
    } else {
        generateBtn.disabled = true;
    }
});

async function generateAudio() {
    if (!window.TTS_AVAILABLE) {
        showError('ETTS 模型未加载，无法生成情感语音。');
        return;
    }

    const text = textInput.value.trim();
    if (!selectedEmotion || !text) {
        showError('请先选择情感并输入文本！');
        return;
    }

    const formData = new FormData();
    formData.append('text', text);
    formData.append('emotion', selectedEmotion);

    // 显示加载状态
    generationLoadingDiv.classList.add('show');
    generateBtn.disabled = true;
    responseSection.classList.remove('show');
    hideError();

    try {
        const response = await fetch('http://localhost:5000/tts/generate', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '服务器返回错误');
        }

        // 显示生成结果
        generatedEmotion.textContent = result.emotion.toUpperCase();
        responseText.textContent = result.text;
        generatedAudioPlayer.src = result.audio_url; // 注意字段名是 audio_url
        generatedAudio.classList.add('show');

        responseSection.classList.add('show');

    } catch (error) {
        console.error('语音生成失败:', error);
        showError('生成失败: ' + (error.message || '未知错误'));
    } finally {
        generationLoadingDiv.classList.remove('show');
        generateBtn.disabled = false;
    }
}

function displayGenerationResult(result) {
    // 显示生成的情感
    generatedEmotion.textContent = result.emotion.toUpperCase();

    // 显示生成的文本
    responseText.textContent = result.text;

    // 设置生成的音频
    generatedAudioPlayer.src = result.audioUrl;

    // 显示音频播放器
    generatedAudio.classList.add('show');
}

// 标签页切换功能
function switchTab(tabName, button) {
    // 隐藏所有标签内容
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // 移除所有按钮的激活状态
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(button => {
        button.classList.remove('active');
    });

    // 激活当前标签
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
        button.classList.add('active');  // ← 使用传入的 button 参数

        if (tabName === 'generation') {
            checkTTSStatus();  // 检查 TTS 状态
        }
    } else {
        console.error('未找到标签:', tabName);
    }
}

// 切换到自定义语音生成界面
function switchToCustomTTS() {
    document.querySelector('#generation .generation-section').style.display = 'none';
    document.getElementById('customTTSForm').style.display = 'block';
}

// 返回情感语音生成界面
function switchBackToEmotionTTS() {
    document.querySelector('#generation .generation-section').style.display = 'block';
    document.getElementById('customTTSForm').style.display = 'none';
    document.getElementById('customResult').innerHTML = ''; // 清空结果
}

// 生成自定义语音
async function generateCustomAudio() {
    const refAudioInput = document.getElementById('refAudioInput');
    const refTextInput = document.getElementById('refTextInput');
    const targetTextInput = document.getElementById('targetTextInput');

    if (!refAudioInput || !refTextInput || !targetTextInput) {
        console.error('❌ 缺少必要的表单元素，请检查 HTML 中的 ID 是否匹配');
        alert('页面加载不完整，请刷新页面');
        return;
    }

    const refAudio = refAudioInput.files[0];
    const refText = refTextInput.value.trim();
    const targetText = targetTextInput.value.trim();

    if (!refAudio) {
        alert("请上传参考音频（.wav 或 .mp3）！");
        return;
    }
    if (!targetText) {
        alert("请输入目标文本！");
        return;
    }

    const formData = new FormData();
    formData.append('ref_audio', refAudio);
    formData.append('ref_text', refText);
    formData.append('text', targetText);

    const resultDiv = document.getElementById('customResult');
    resultDiv.innerHTML = '<p>正在生成语音，请稍候...</p>';

    try {
        const response = await fetch('http://localhost:5000/tts/generate', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (response.ok && data.audio_url) {
            const audioUrl = data.audio_url;
            const audioHtml = `<p>✅ 生成成功！</p><audio controls src="${audioUrl}" style="width:100%; margin-top:10px;"></audio>`;
            resultDiv.innerHTML = audioHtml;
        } else {
            resultDiv.innerHTML = `<p style="color:red;">❌ 生成失败: ${data.error || '未知错误'}</p>`;
        }
    } catch (error) {
        console.error("生成请求失败:", error);
        resultDiv.innerHTML = `<p style="color:red;">❌ 网络错误: ${error.message}</p>`;
    }
}

document.getElementById('refAudioInput').addEventListener('change', function(e) {
        const fileNameDiv = document.getElementById('selectedFileName');
        if (this.files.length > 0) {
            fileNameDiv.textContent = '已选择: ' + this.files[0].name;
            fileNameDiv.style.color = '#28a745';
        } else {
            fileNameDiv.textContent = '';
        }
    });

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('语音情感识别与生成系统已加载');

    // 确保初始状态正确
    if (fileInfo) fileInfo.classList.remove('show');
    if (resultsSection) resultsSection.classList.remove('show');
    if (errorDiv) errorDiv.classList.remove('show');
    if (generationLoadingDiv) generationLoadingDiv.classList.remove('show');
    if (responseSection) responseSection.classList.remove('show');

    // 隐藏所有loading
    const allLoadings = document.querySelectorAll('.loading');
    allLoadings.forEach(loading => {
        loading.style.display = 'none';
    });
});
