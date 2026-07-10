import torch
import torch.nn as nn


class Wav2Vec_SER(nn.Module):
    def __init__(self, input_dim=768, lstm_hidden=256, num_classes=4, dropout=0.3):
        super(Wav2Vec_SER, self).__init__()

        # LSTM层，处理Wav2Vec2提取的特征
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=lstm_hidden,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if 2 > 1 else 0  # 只有多层LSTM才应用dropout
        )

        # 多头自注意力机制
        self.attention = nn.MultiheadAttention(
            embed_dim=lstm_hidden * 2,
            num_heads=8,
            dropout=dropout,
            batch_first=True
        )

        # 层归一化
        self.layer_norm = nn.LayerNorm(lstm_hidden * 2)

        # 分类器
        self.classifier = nn.Sequential(
            nn.Linear(lstm_hidden * 2, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        # x shape: (batch, seq_len, feature_dim)
        lstm_out, (h_n, c_n) = self.lstm(x)

        # 多头自注意力
        attn_out, _ = self.attention(lstm_out, lstm_out, lstm_out)

        # 残差连接和层归一化
        norm_out = self.layer_norm(lstm_out + attn_out)

        # 使用全局平均池化获取句子表示
        pooled = torch.mean(norm_out, dim=1)

        # 分类
        output = self.classifier(pooled)
        return output
