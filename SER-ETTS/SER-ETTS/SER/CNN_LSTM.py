import torch
import torch.nn as nn


class MultiHeadSelfAttention(nn.Module):
    def __init__(self, input_dim, num_heads=8, dropout=0.5):
        """
        Args:
            input_dim (int): 输入维度，即 LSTM 的 (2 * hidden_dim)
            num_heads (int): 注意力头数
            dropout (float): Dropout 率
        """
        super(MultiHeadSelfAttention, self).__init__()

        self.num_heads = num_heads
        self.head_dim = input_dim // num_heads
        self.embed_dim = input_dim  # 确保 PyTorch 的 MHA 接收正确的维度

        # PyTorch 内置的 MultiheadAttention 模块
        # batch_first=True 确保输入是 (Batch, Seq_Len, Features)
        self.multihead_attn = nn.MultiheadAttention(
            embed_dim=self.embed_dim,
            num_heads=self.num_heads,
            dropout=dropout,
            batch_first=True
        )

        # 用于整合 MHA 输出的线性层
        self.fc_out = nn.Linear(input_dim, input_dim)
        self.layer_norm = nn.LayerNorm(input_dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, lstm_out):
        # lstm_out shape: (Batch, Seq_Len, Input_Dim) -> (B, T', 2*H)

        # Multi-Head Attention: Q, K, V 都来自 lstm_out
        # attn_output shape: (B, T', Input_Dim)
        # attn_output_weights shape: (B, T', T') (用于调试，此处忽略)

        # PyTorch 的 MultiheadAttention 要求 Q, K, V 维度相同
        attn_output, _ = self.multihead_attn(
            query=lstm_out,
            key=lstm_out,
            value=lstm_out
        )

        # 残差连接 + LayerNorm
        x = self.layer_norm(lstm_out + self.dropout(attn_output))

        # 通过平均或取第一个token来汇聚序列特征。
        # 对于 SER，最简单有效的方式是直接对所有时间步求平均
        # context shape: (Batch, Input_Dim)
        context = torch.mean(x, dim=1)

        # 经过输出层（可选）
        context = self.fc_out(context)

        return context


class CNN_LSTM_SER(nn.Module):
    def __init__(self, input_dim=86, cnn_filters=[32, 64], lstm_hidden=128, num_classes=4, dropout=0.3):
        super(CNN_LSTM_SER, self).__init__()

        # CNN layers
        self.cnn = nn.Sequential(
            nn.Conv1d(input_dim, cnn_filters[0], kernel_size=5, padding=2),
            nn.BatchNorm1d(cnn_filters[0]),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Conv1d(cnn_filters[0], cnn_filters[1], kernel_size=5, padding=2),
            nn.BatchNorm1d(cnn_filters[1]),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # self.global_avg_pool = nn.AdaptiveAvgPool1d(1)

        # LSTM layer
        self.lstm = nn.LSTM(
            input_size=cnn_filters[-1],
            hidden_size=lstm_hidden,
            batch_first=True,
            bidirectional=True
        )

        # Attention layer
        self.attention = MultiHeadSelfAttention(lstm_hidden * 2, num_heads=8, dropout=dropout)

        # Classifier
        self.classifier = nn.Sequential(
            nn.Linear(lstm_hidden*2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # print(f"Input shape: {x.shape}")  # (B, T, F)
        # x: (batch, T, F) -> (batch, F, T)
        x = x.transpose(1, 2)
        # print(f"After transpose: {x.shape}")
        x = self.cnn(x)  # (batch, C, T)
        # x = self.global_avg_pool(x)  # (B, cnn_filters[-1], 1)
        # x = x.squeeze(-1)  # (B, cnn_filters[-1])
        # print(f"After CNN: {x.shape}")
        x = x.transpose(1, 2)  # (batch, T, C)
        # print(f"After transpose back: {x.shape}")
        lstm_out, (h_n, _) = self.lstm(x)
        # print(f"After LSTM: {lstm_out.shape}")
        # x = torch.mean(lstm_out, dim=1)  # (B, 2*hidden_size)
        context = self.attention(lstm_out)
        out = self.classifier(context)
        return out
