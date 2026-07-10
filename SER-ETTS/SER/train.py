import os
import time
import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset, DataLoader, Subset
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, confusion_matrix, recall_score
from tqdm import tqdm
from CNN_LSTM import CNN_LSTM_SER
from data_prepare import extract_emotion, load_and_cut_audio, extract_features
import hashlib
import seaborn as sns


# 配置参数
DATA_DIR = r"D:\dataset\IEMOCAP_full_release"
CACHE_DIR = r"D:/dataset/iemocap_cache"
MODEL_DIR = './models/model3(lstm)'
os.makedirs(MODEL_DIR, exist_ok=True)
EMOTION_LABELS = ["angry", "happy", "sad", "neutral"]


class IEMOCAPDataset(Dataset):
    def __init__(self, emotions=EMOTION_LABELS):
        self.utts = []
        self.labels = []
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(emotions)
        self.emotion_set = set(emotions)

        self.cache_dir = CACHE_DIR
        os.makedirs(self.cache_dir, exist_ok=True)

        for session in range(1, 6):
            session_str = f"Session{session}"
            wav_base = os.path.join(DATA_DIR, session_str, "dialog", "wav")
            transcript_base = os.path.join(DATA_DIR, session_str, "dialog", "EmoEvaluation")
            for filename in os.listdir(transcript_base):
                if filename.endswith('.txt'):
                    transcript_path = os.path.join(transcript_base, filename)
                    utt_info = extract_emotion(transcript_path)
                    dialog_prefix = filename.replace('.txt', '')
                    wav_path = os.path.join(wav_base, dialog_prefix)
                    for utt_id, info in utt_info.items():
                        if info['emotion'] in self.emotion_set:
                            wav_file = wav_path + ".wav"
                            if os.path.exists(wav_file):
                                self.utts.append((wav_file, info['start'], info['end']))
                                self.labels.append(info['emotion'])

        self.labels = self.label_encoder.transform(self.labels)

        self.cached_features = []  # 存储所有特征的 list

        for i, (wav_path, start, end) in enumerate(
                tqdm(self.utts, desc="Caching log-Mel features", unit="utt", leave=True)
        ):
            # 生成唯一缓存 key（避免文件名冲突）
            key_str = f"{wav_path}_{start:.6f}_{end:.6f}"
            hash_key = hashlib.md5(key_str.encode()).hexdigest()
            cache_path = os.path.join(self.cache_dir, f"{hash_key}.npy")

            if os.path.exists(cache_path):
                # 直接加载缓存
                feat = np.load(cache_path)
            else:
                # 实时计算并保存
                y = load_and_cut_audio(wav_path, start, end)
                features = extract_features(y)  # (T, 86)
                # 固定长度为 300 帧
                if features.shape[0] < 300:
                    pad = np.zeros((300 - features.shape[0], features.shape[1]))
                    features = np.vstack([features, pad])
                else:
                    features = features[:300]
                np.save(cache_path, features)
                feat = features

            self.cached_features.append(feat)

    def __len__(self):
        return len(self.utts)

    def __getitem__(self, idx):
        x = torch.tensor(self.cached_features[idx], dtype=torch.float32)
        y = torch.tensor(self.labels[idx], dtype=torch.long)
        return x, y


def train(epoch, num_epochs, model, dataloader, criterion, optimizer, device):
    model.train()
    total_loss = 0.0
    all_preds = []
    all_labels = []
    pbar = tqdm(dataloader, desc=f"Epoch {epoch + 1}/{num_epochs}", leave=True)
    for x, y in pbar:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        logits = model(x)
        loss = criterion(logits, y)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
        preds = torch.argmax(logits, dim=1).cpu().numpy()
        all_preds.extend(preds)
        all_labels.extend(y.cpu().numpy())
    pbar.close()
    avg_loss = total_loss / len(dataloader)
    acc = accuracy_score(all_labels, all_preds)
    return avg_loss, acc


def evaluate(model, dataloader, device, fold_epoch):
    model.eval()
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for x, y in dataloader:
            x = x.to(device)
            logits = model(x)
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(y.cpu().numpy())
    acc = accuracy_score(all_labels, all_preds)
    ua_acc = recall_score(all_labels, all_preds, average='macro')

    if fold_epoch % 20 == 0:
        cm = confusion_matrix(all_labels, all_preds)
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', xticklabels=EMOTION_LABELS, yticklabels=EMOTION_LABELS)
        plt.title(f'epoch={fold_epoch} Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        if fold_epoch == 60:
            plt.savefig(f'{MODEL_DIR}/lstm_cm.png')
        plt.show()
    return ua_acc, acc


def train_with_split(num_epochs, batch_size, lr):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Using device: {device}')

    full_dataset = IEMOCAPDataset(emotions=EMOTION_LABELS)
    dataset_size = len(full_dataset)
    print(f"Total samples: {dataset_size}")

    # 8:2 划分数据集
    train_indices, val_indices = train_test_split(
        np.arange(dataset_size),
        test_size=0.2,
        random_state=42,
        stratify=full_dataset.labels
    )

    print(f"Train: {len(train_indices)}, Val: {len(val_indices)}")

    # 创建子集
    train_subsampler = Subset(full_dataset, train_indices)
    val_subsampler = Subset(full_dataset, val_indices)

    train_loader = DataLoader(train_subsampler, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_subsampler, batch_size=batch_size, shuffle=False, num_workers=4)

    # 初始化模型
    model = CNN_LSTM_SER(num_classes=4).to(device)

    label_counts = np.bincount(full_dataset.labels)
    total_samples = len(full_dataset.labels)
    # 权重公式: total / (num_classes * class_count)
    class_weights = total_samples / (len(EMOTION_LABELS) * label_counts)
    class_weights = torch.tensor(class_weights, dtype=torch.float32).to(device)

    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs)  # 余弦退火

    train_loss_history = []
    train_acc_history = []
    val_acc_history = []
    ua_acc_history = []

    best_ua_acc = 0.0
    best_val_acc = 0.0

    for epoch in range(num_epochs):
        train_loss, train_acc = train(epoch, num_epochs, model, train_loader, criterion, optimizer, device)
        ua_acc, val_acc = evaluate(model, val_loader, device, epoch + 1)
        train_loss_history.append(train_loss)
        train_acc_history.append(train_acc)
        val_acc_history.append(val_acc)
        ua_acc_history.append(ua_acc)
        scheduler.step()

        # 保存最佳模型
        if ua_acc > best_ua_acc:
            best_ua_acc = ua_acc
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            model_path = f"{MODEL_DIR}/best_model.pth"
            torch.save(model.state_dict(), model_path)

        if (epoch + 1) % 10 == 0 or epoch == num_epochs - 1:
            print(
                f"Epoch {epoch + 1}/{num_epochs}, Train Loss: {train_loss:.4f}, Train|Val acc: {train_acc:.4f}|{val_acc:.4f}, UA: {ua_acc:.4f}")
            time.sleep(0.2)

    epochs = np.arange(1, num_epochs + 1)

    plt.figure(figsize=(12, 5))
    plt.plot(epochs, train_loss_history, label='Train Loss', color='tab:blue')
    plt.xlabel('epoch')
    plt.ylabel('loss')
    plt.title('Training Loss')
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.legend()
    plt.savefig(f'{MODEL_DIR}/cnn-lstm_loss.png')
    plt.show()

    plt.figure(figsize=(10, 6))
    plt.plot(epochs, train_acc_history, label='train', color='tab:blue')
    plt.plot(epochs, val_acc_history, label='val', color='tab:orange')

    plt.xlabel('epoch')
    plt.ylabel('accuracy')
    plt.title('CNN_LSTM Training and Validation Accuracy')
    plt.ylim(0, 1)
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.legend()
    plt.tight_layout()
    plt.savefig(f'{MODEL_DIR}/cnn-lstm_acc.png')
    plt.show()

    final_train_acc = train_acc_history[-1]
    final_val_acc = val_acc_history[-1]
    final_ua_acc = ua_acc_history[-1]
    print(f"Final Result:")
    print(f"Train|val acc: {final_train_acc:.4f}|{final_val_acc:.4f}")
    print(f"UA: {final_ua_acc:.4f}")
    result_file = os.path.join(MODEL_DIR, "best_results.txt")
    with open(result_file, 'w', encoding='utf-8') as f:
        f.write(f"Best Validation Accuracy (WA): {best_val_acc:.4f}\n")
        f.write(f"Best Unweighted Average Recall (UA): {best_ua_acc:.4f}\n")
        f.write(f"Final Validation Accuracy: {final_val_acc:.4f}\n")
        f.write(f"Final UA: {final_ua_acc:.4f}\n")
        f.write(f"Training completed on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    print(f"Best results saved to {result_file}")

    return final_val_acc, (train_loss_history, train_acc_history, val_acc_history)


if __name__ == '__main__':
    train_with_split(num_epochs=100, batch_size=32, lr=1e-3)
