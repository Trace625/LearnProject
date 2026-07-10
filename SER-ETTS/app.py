import os
import sys
import tempfile
import numpy as np
from datetime import datetime
from flask import Flask, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
from flask_cors import CORS
import torch
import torchaudio
import librosa

# 1. 语音情感识别 (SER)
from SER.CNN_LSTM import CNN_LSTM_SER
from SER.data_prepare import extract_features

EMOTION_LABELS = ["angry", "happy", "sad", "neutral"]
model_path = 'SER/models/model1/best_model.pth'


class SERInference:
    def __init__(self, model_path=model_path, emotions=EMOTION_LABELS):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = CNN_LSTM_SER(cnn_filters=[32, 64])
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
        self.emotions = emotions

    def predict(self, wav_path):
        y, sr = librosa.load(wav_path, sr=16000)
        y = librosa.effects.preemphasis(y, coef=0.97)
        log_mel = extract_features(y)
        if log_mel.shape[0] < 300:
            pad = np.zeros((300 - log_mel.shape[0], log_mel.shape[1]))
            log_mel = np.vstack([log_mel, pad])
        else:
            log_mel = log_mel[:300]
        x = torch.tensor(log_mel, dtype=torch.float32).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(x)
            prob = torch.softmax(logits, dim=1)
            pred_idx = torch.argmax(prob, dim=1).item()
        return self.emotions[pred_idx], prob[0].cpu().numpy()


# 2. 语音合成 (TTS) - Zero-Shot
# 添加 CosyVoice 路径
sys.path.append('CosyVoice-main/third_party/Matcha-TTS')
try:
    sys.path.append('CosyVoice-main')
    from cosyvoice.cli.cosyvoice import AutoModel
    COSYVOICE_AVAILABLE = True
    cosyvoice = AutoModel(model_dir='CosyVoice-main/pretrained_models/Fun-CosyVoice3-0.5B')
except Exception as e:
    print("⚠️ CosyVoice 模型加载失败:", e)
    COSYVOICE_AVAILABLE = False

# 情感 → 参考音频映射
EMOTION_PROMPTS = {
    "angry": {
        "wav": "CosyVoice-main/prompt_wavs/angry.wav",
        "text": "アホのリュウジの気配"
    },
    "happy": {
        "wav": "CosyVoice-main/prompt_wavs/happy.wav",
        "text": "はい!だって、夏希さんが私に物を与えてくださったんですもの!"
    },
    "sad": {
        "wav": "CosyVoice-main/prompt_wavs/sad1.wav",
        "text": "一人ぼっちになった私を拾ってくださったのが…マスターでした!"
    },
    "neutral": {
        "wav": "CosyVoice-main/prompt_wavs/neutral.wav",
        "text": "私は眠りにつく前マスターから命令を受けました"
    }
}

OUTPUT_DIR = "CosyVoice-main/outputs/zero-shot"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_unique_output_path(prefix: str, ext: str = ".wav") -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    index = 0
    while True:
        filename = f"{prefix}_{timestamp}_{index:03d}{ext}"
        path = os.path.join(OUTPUT_DIR, filename)
        if not os.path.exists(path):
            return path
        index += 1


# 3. Flask App 初始化
app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# 加载 SER 模型
print("正在加载语音情感识别模型...")
infer_engine = SERInference()
print("SER 模型加载完成！")

# 检查 TTS 模型和 prompt 音频
if COSYVOICE_AVAILABLE:
    missing_prompts = [e for e, info in EMOTION_PROMPTS.items() if not os.path.exists(info["wav"])]
    if missing_prompts:
        print(f"⚠️ 缺少参考音频: {missing_prompts}")
    else:
        print("✅ ETTS 模型和所有参考音频已就绪！")
else:
    print("❌ ETTS 功能不可用")


# 4. 路由定义
@app.route('/predict', methods=['POST'])
def predict_emotion():
    if 'audio' not in request.files:
        return jsonify({"error": "未提供音频文件"}), 400
    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "文件名为空"}), 400

    allowed_ext = {'wav', 'mp3', 'm4a', 'ogg'}
    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[-1].lower()
    if ext not in allowed_ext:
        return jsonify({"error": f"不支持的文件格式: {ext}"}), 400

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        emotion, prob = infer_engine.predict(tmp_path)
        prob_list = np.round(prob, 4).tolist()
        os.unlink(tmp_path)

        return jsonify({
            "predicted_emotion": emotion,
            "confidence": float(max(prob)),
            "probabilities": {label: float(p) for label, p in zip(EMOTION_LABELS, prob_list)}
        })
    except Exception as e:
        if 'tmp_path' in locals():
            os.unlink(tmp_path)
        return jsonify({"error": f"处理失败: {str(e)}"}), 500


OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'static', 'audio')
os.makedirs(OUTPUT_DIR, exist_ok=True)


@app.route('/tts/generate', methods=['POST'])
def tts_generate():
    if not COSYVOICE_AVAILABLE:
        return jsonify({"error": "ETTS 模型未加载"}), 500

    # 获取所有可能的参数
    ref_audio = request.files.get('ref_audio')  # 用户上传的参考音频
    ref_text = request.form.get('ref_text', '').strip()
    target_text = request.form.get('text', '').strip() or request.form.get('target_text', '').strip()
    emotion = request.form.get('emotion', '').strip()

    # 必须有目标文本
    if not target_text:
        return jsonify({"error": "缺少目标文本"}), 400

    # 初始化参考音频路径和文本
    prompt_wav_path = None
    prompt_text = ref_text or "好的"

    try:
        # ========== 模式 1：自定义音色（上传了 ref_audio）==========
        if ref_audio and ref_audio.filename != '':
            filename = secure_filename(ref_audio.filename)
            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'wav'
            if ext not in {'wav', 'mp3', 'm4a', 'ogg'}:
                return jsonify({"error": f"不支持的参考音频格式: {ext}"}), 400

            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                ref_audio.save(tmp.name)
                prompt_wav_path = tmp.name

        # ========== 模式 2：情感语音（未上传 ref_audio）==========
        else:
            if not emotion:
                emotion = 'neutral'
            if emotion not in EMOTION_PROMPTS:
                return jsonify({"error": f"不支持的情感类型: {emotion}"}), 400
            prompt_info = EMOTION_PROMPTS[emotion]
            prompt_wav_path = prompt_info["wav"]
            prompt_text = prompt_info["text"]

            if not os.path.exists(prompt_info["wav"]):
                return jsonify({"error": f"情感 '{emotion}' 的参考音频缺失"}), 500

        # ========== 执行 TTS 生成 ==========
        output_path = get_unique_output_path("generated")
        for i, j in enumerate(cosyvoice.inference_zero_shot(
            tts_text=target_text,
            prompt_text=prompt_text,
            prompt_wav=prompt_wav_path,
            stream=False
        )):
            torchaudio.save(output_path, j['tts_speech'], cosyvoice.sample_rate)

        # 返回结果
        return jsonify({
            "audio_url": f"http://localhost:5000/static/audio/{os.path.basename(output_path)}",
            "emotion": emotion or "custom",  # 如果是自定义，返回 custom
            "text": target_text
        })

    except Exception as e:
        return jsonify({"error": f"TTS 生成失败: {str(e)}"}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "ser_loaded": True,
        "tts_available": COSYVOICE_AVAILABLE
    })


if __name__ == '__main__':
    # python -m http.server 8080
    # http://localhost:8080
    # なんでこんなに慣れてんのよ。私の方が先に好きだったのに
    app.run(host='127.0.0.1', port=5000, debug=False)
