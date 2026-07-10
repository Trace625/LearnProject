import librosa
from librosa import feature
import matplotlib.pyplot as plt
import numpy as np
from data_prepare import extract_emotion
import os
from sklearn.svm import SVC
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from tqdm import tqdm
import soundfile as sf

DATA_DIR = r"D:\dataset\IEMOCAP_full_release"
EMOTION_LABELS = ["angry", "happy", "sad", "neutral", "frustrated", "excited", "fearful", "disgusted", "other"]
emotions = ['neutral', 'happy', 'angry', 'sad']


def pre_emphasis(signal):
    """预加重"""
    coeff = 0.97
    emphasized_signal = np.append(signal[0], signal[1:] - coeff * signal[:-1])
    return emphasized_signal


def load_and_cut_audio(audio_path, start_sec, end_sec, sr=16000):
    """加载并对音频进行切片"""
    y, fs = librosa.load(audio_path, sr=sr)
    start_sample = int(start_sec * sr)
    end_sample = int(end_sec * sr)
    y = y[start_sample: end_sample]
    y = pre_emphasis(y)
    max_len = sr * 3  # 固定为3s
    if len(y) > max_len:
        y = y[:max_len]
    else:
        padding = max_len - len(y)
        y = np.pad(y, (0, padding), mode='constant')
    print(y, fs)
    plt.figure(figsize=(10, 6))
    plt.plot(np.arange(len(y)) * (1/sr), y)
    plt.tight_layout()
    plt.show()
    # sf.write("./sound/resample4.wav", y, sr)
    return y


def extract_mfcc(y, sr=16000, n_mfcc=20, n_fft=512, hop_length=160):
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, n_fft=n_fft, hop_length=hop_length)
    librosa.display.specshow(
        mfcc,
        sr=sr,
        hop_length=hop_length,
        x_axis='time',
        cmap='viridis'
    )
    plt.colorbar(format='%+2.0f dB')
    plt.title('MFCC')
    plt.ylabel('mfcc coeff')
    plt.tight_layout()
    plt.show()
    return mfcc


def extract_log_mel(y, sr=16000, n_mels=80, n_fft=512, hop_length=160):
    """
    提取log-Mel频谱
    n_mels: Mel滤波器数量
    n_fft: FFT窗口大小
    hop_length: 帧移
    """
    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels, n_fft=n_fft, hop_length=hop_length)
    log_mel = librosa.power_to_db(mel_spec, ref=np.max)
    plt.figure(figsize=(10, 6))
    librosa.display.specshow(
        log_mel.T,
        sr=sr,
        hop_length=hop_length,
        x_axis='time',
        y_axis='mel',
        cmap='viridis'
    )
    plt.colorbar(format="%+2.f dB")
    plt.title('log_Mel')
    plt.tight_layout()
    plt.show()
    return log_mel.T


def load_data():
    wav_files = []
    labels = []
    for session in range(1, 6):
        session_path = os.path.join(DATA_DIR, f"Session{session}/sentences/wav")
        transcript_path = os.path.join(DATA_DIR, f"Session{session}/dialog/EmoEvaluation")
        for dirname, _, filenames in os.walk(session_path):
            for filename in filenames:
                if filename.endswith('.wav'):
                    wav_files.append(os.path.join(dirname, filename))
        for filename in os.listdir(transcript_path):
            if filename.endswith('.txt'):
                transcript_file = os.path.join(transcript_path, filename)
                emotion = extract_emotion(transcript_file)
                labels.append(emotion)
    print('Dataset is loaded!')
    return wav_files, labels


txt_file = r"D:\dataset\IEMOCAP_full_release\Session1\dialog\EmoEvaluation\Ses01F_impro01.txt"
wav_file = r"D:\dataset\IEMOCAP_full_release\Session1\dialog\wav\Ses01F_impro01.wav"
# 1.显示一段截取的音频的对数梅尔频谱：
y = load_and_cut_audio(wav_file, 6.2901, 10.0100)
extract_log_mel(y)
extract_mfcc(y)

# 2.导入数据
# wav_files, labels = load_data()
# print(wav_files[0], labels[0], sep='\n')

# 3.情感提取
# utt_info = extract_emotion(txt_file)
# for utt_id, info in utt_info.items():
#     print(utt_id)

# 4.路径寻找
utts = []
labels = []
for session in range(1, 6):
    session_str = f"Session{session}"
    txt_dir = os.path.join(DATA_DIR, session_str, "dialog", "EmoEvaluation")
    wav_base = os.path.join(DATA_DIR, session_str, "sentences", "wav")
    emotions_set = set(emotions)

    for txt_file in os.listdir(txt_dir):
        if txt_file.endswith('.txt'):
            txt_path = os.path.join(txt_dir, txt_file)
            utt_info = extract_emotion(txt_path)
            dialog_prefix = txt_file.replace('.txt', '')
            wav_subdir = os.path.join(wav_base, dialog_prefix)
            for utt_id, info in utt_info.items():
                if info['emotion'] in emotions_set:
                    wav_path = os.path.join(wav_subdir, utt_id + '.wav')
                    if os.path.exists(wav_path):
                        utts.append((wav_path, info['start'], info['end']))
                        labels.append(info['emotion'])

print(utts)
print(labels)
print(len(utts), len(labels))
print(f"angry:{labels.count('angry')}")
print(f"sad:{labels.count('sad')}")
print(f"happy:{labels.count('happy')}")
print(f"neutral:{labels.count('neutral')}")

# 5.数据质量测试
# def run_svm_baseline(utts, labels):
#     """
#     使用 log-Mel 特征 + SVM 进行 5 折交叉验证，验证数据是否具有判别性。
#
#     参数:
#         utts: List[Tuple[wav_path, start, end]]
#         labels: List[str], 如 ['angry', 'happy', ...]
#     """
#     print("🚀 Running SVM baseline with log-Mel features...")
#
#     # 1. 编码标签为整数
#     label_encoder = LabelEncoder()
#     y_true = label_encoder.fit_transform(labels)  # shape: (N,)
#     print(f"Classes: {label_encoder.classes_}")
#     print(f"Label distribution: {np.bincount(y_true)}")
#
#     # 2. 提取特征
#     X = []
#     for wav_path, start, end in tqdm(utts, desc="Extracting log-Mel features"):
#         y_audio = load_and_cut_audio(wav_path, start, end)
#         log_mel = extract_log_mel(y_audio)  # (T, 64)
#
#         # 固定长度为 300 帧
#         if log_mel.shape[0] < 300:
#             pad = np.zeros((300 - log_mel.shape[0], log_mel.shape[1]))
#             log_mel = np.vstack([log_mel, pad])
#         else:
#             log_mel = log_mel[:300]
#
#         X.append(log_mel.flatten())  # (300 * 64,) = (19200,)
#
#     X = np.array(X)  # shape: (N, 19200)
#     y_true = np.array(y_true)
#
#     print(f"Feature matrix shape: {X.shape}")
#
#     svm = SVC(kernel='rbf')
#     scores = cross_val_score(svm, X, y_true, cv=5)
#     print("SVM CV Accuracy:", scores.mean())  # 如果 > 50%，说明数据有信息
#
#
# run_svm_baseline(utts, labels)
