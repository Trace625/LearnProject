import numpy as np
import re
import librosa
import librosa.display
from librosa import feature
import warnings
warnings.filterwarnings('ignore')


def parse_emotion(label_str):
    """将标签字符串映射为标准情绪类别(做4分类的SER)"""
    mapping = {
        'neu': 'neutral',
        'ang': 'angry',
        'sad': 'sad',
        'hap': 'happy',
        'exc': 'happy',
    }
    return mapping.get(label_str, 'other')


def extract_emotion(file_path):
    utt_info = {}
    four_class_SER = ['ang', 'hap', 'neu', 'sad', 'exc']
    with open(file_path, 'r') as f:
        for line in f:
            if line.startswith('['):
                match = re.search(r'\[(\d+\.\d+) - (\d+\.\d+)]\s+(\S+)\s+(\w+)', line)
                # for i in range(0, 5):
                #     print(f"i={i}: {match.group(i)}")
                start_time = float(match.group(1))
                end_time = float(match.group(2))
                utt_id = match.group(3)
                emo = match.group(4).lower()
                if emo in four_class_SER:
                    emotion = parse_emotion(emo)
                    utt_info[utt_id] = {
                        'emotion': emotion,
                        'start': start_time,
                        'end': end_time
                    }

    return utt_info


def load_and_cut_audio(audio_path, start_sec, end_sec, sr=16000):
    """加载并对音频进行切片"""
    y, fs = librosa.load(audio_path, sr=sr)
    start_sample = int(start_sec * sr)
    end_sample = int(end_sec * sr)
    y_cut = y[start_sample: end_sample]

    y = librosa.effects.preemphasis(y_cut, coef=0.97)  # 预加重
    return y


def normalize(feat):
    mean = np.mean(feat)
    std = np.std(feat) + 1e-6
    return (feat - mean) / std


def extract_features(y, sr=16000, n_mels=64, n_mfcc=20, n_fft=512, hop_length=160):
    """
    提取log-Mel频谱
    n_mels: Mel滤波器数量
    n_fft: FFT窗口大小
    hop_length: 帧移
    """
    # mel_spec (64 features)
    mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels, n_fft=n_fft, hop_length=hop_length)
    log_mel = librosa.power_to_db(mel_spec, ref=np.max)
    log_mel = log_mel.T  # (T, 64)

    # mfcc (20 features)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, n_fft=n_fft, hop_length=hop_length)
    mfcc = mfcc.T  # (T, 20)
    # SC (1 feature)
    spec_centroid = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=n_fft, hop_length=hop_length)
    spec_centroid = spec_centroid.T
    # ZCR (1 feature)
    zcr = librosa.feature.zero_crossing_rate(y=y, frame_length=n_fft, hop_length=hop_length)
    zcr = zcr.T

    # 对齐时间
    T_min = min([f.shape[0] for f in [log_mel, mfcc, spec_centroid, zcr]])
    log_mel = log_mel[:T_min, :]
    mfcc = mfcc[:T_min, :]
    spec_centroid = spec_centroid[:T_min, :]
    zcr = zcr[:T_min, :]

    log_mel_norm = normalize(log_mel)
    mfcc_norm = normalize(mfcc)
    centroid_norm = normalize(spec_centroid)
    zcr_norm = normalize(zcr)

    # 堆叠特征: (64 + 20 + 1 + 1) = 86维, 形状(T, 86)
    features = np.hstack((log_mel_norm, mfcc_norm, centroid_norm, zcr_norm))
    return features  # (T, 86)
