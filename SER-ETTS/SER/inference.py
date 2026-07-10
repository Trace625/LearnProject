import torch
from CNN_LSTM import CNN_LSTM_SER
from data_prepare import extract_features
import librosa
import numpy as np
from pathlib import Path

EMOTION_LABELS = ["angry", "happy", "sad", "neutral"]


class SERInference:
    def __init__(self, model_path, emotions=EMOTION_LABELS):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = CNN_LSTM_SER(num_classes=4)
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
        self.emotions = emotions

    def predict(self, wav_path):
        y, sr = librosa.load(wav_path, sr=16000)
        y = librosa.effects.preemphasis(y, coef=0.97)  # 预加重
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


def run_inference_on_directory(wav_dir, model_path):
    wav_dir = Path(wav_dir)
    infer = SERInference(model_path=model_path)

    for wav_path in wav_dir.rglob("*.wav"):
        emotion, prob = infer.predict(str(wav_path))
        prob_rounded = np.round(prob, 4)
        file_name = wav_path.stem
        if emotion == 'angry':
            print(f"{file_name}\t{emotion}: {prob_rounded}")


def run_inference_on_file(file, model_path):
    infer = SERInference(model_path=model_path)
    emotion, prob = infer.predict(file)
    prob_round = np.round(prob, 4)
    print(file)
    print(f"{emotion}:\t{prob_round}")


wav_directory = r"D:\dataset\IEMOCAP_full_release\Session1\sentences\wav\Ses01F_impro05"
wav_file1 = "D:\dataset\IEMOCAP_full_release\Session1\sentences\wav\Ses01F_impro05\Ses01F_impro05_F007.wav"
wav_file2 = "D:\dataset\IEMOCAP_full_release\Session1\sentences\wav\Ses01F_impro05\Ses01F_impro05_F008.wav"
wav_file3 = "D:\dataset\IEMOCAP_full_release\Session1\sentences\wav\Ses01F_impro05\Ses01F_impro05_F009.wav"
model_file = "./models/model1/best_model.pth"
# run_inference_on_directory(wav_directory, model_file)
run_inference_on_file(wav_file1, model_file)
run_inference_on_file(wav_file2, model_file)
run_inference_on_file(wav_file3, model_file)
