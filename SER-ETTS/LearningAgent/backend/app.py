import base64
import json
import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import bcrypt
from kimi_agent import KimiAgent
from utils.db_connection import get_db_connection
from utils.validate import validate_username, validate_password

app = Flask(__name__)
secret_key = os.getenv('JWT_SECRET_KEY')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
app.config.update(
    JWT_SECRET_KEY=secret_key,
    JWT_TOKEN_LOCATION=['headers'],
    JWT_COOKIE_CSRF_PROTECT=False,
    JWT_CSRF_IN_COOKIES=False,        # 不在 Cookie 中存 CSRF token
    JWT_CSRF_CHECK_FORMS=False,       # 不检查表单 CSRF
    JWT_SESSION_COOKIE=False,         # 不使用会话 Cookie
)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}}, allow_headers=["Content-Type", "Authorization"])  # 允许前端跨域请求，允许携带 cookie/token

jwt = JWTManager(app)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

kimi_agent = KimiAgent()


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    if not validate_username(username):
        return jsonify({'error': '用户名只能包含中文、英文、数字、下划线，长度3-50'}), 400

    if not validate_password(password):
        return jsonify({'error': '密码长度必须为8-16位'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查用户名是否已存在
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                return jsonify({'error': '用户名已存在'}), 409

            # 哈希密码（使用 bcrypt）
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
                (username, password_hash)
            )
            conn.commit()
        return jsonify({'message': '注册成功'}), 201
    except Exception as e:
        logger.exception("注册失败")
        return jsonify({'error': '服务器错误'}), 500
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '请输入用户名和密码'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username, password_hash FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                return jsonify({'error': '用户名或密码错误'}), 401

        # 生成 JWT Token（有效期 7 天）
        access_token = create_access_token(identity=user['username'], expires_delta=False)
        return jsonify({
            'message': '登录成功',
            'token': access_token,
            'username': user['username']
        }), 200
    except Exception as e:
        logger.exception("登录失败")
        return jsonify({'error': '服务器错误'}), 500
    finally:
        conn.close()


# @jwt.user_lookup_loader
# def user_lookup_callback(_jwt_header, jwt_data):
#     identity = jwt_data["sub"]  # 用户名字符串
#     # 从数据库查完整用户信息
#     conn = get_db_connection()
#     cursor = conn.cursor()
#     cursor.execute("SELECT id, username, email FROM users WHERE username = %s", (identity,))
#     user = cursor.fetchone()
#     conn.close()
#     return user  # 返回字典


@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def get_profile():
    username = get_jwt_identity()
    # 从数据库查询完整用户信息
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT username, created_at FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if not user:
                return jsonify({'error': '用户不存在'}), 404

            # 格式化时间（假设 created_at 是 datetime 类型）
            created_at = user['created_at'].strftime('%Y-%m-%d %H:%M:%S') if user['created_at'] else '未知'

            return jsonify({
                'username': user['username'],
                'registered_at': created_at
            }), 200
    finally:
        conn.close()


@app.route('/api/user/change-password', methods=['POST'])
@jwt_required()
def change_password():
    username = get_jwt_identity()
    data = request.get_json()

    old_password = data.get('oldPassword')
    new_password = data.get('newPassword')

    if not old_password or not new_password:
        return jsonify({'msg': '参数不完整'}), 400

    if not validate_password(new_password):
        return jsonify({'msg': '新密码长度必须为8-16位'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. 查询用户信息
            cursor.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()

            if not user:
                return jsonify({'msg': '用户不存在'}), 404

            # 2. 验证旧密码（使用 bcrypt）
            if not bcrypt.checkpw(old_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                return jsonify({'msg': '原密码输入错误'}), 401

            # 3. 生成新密码哈希并更新
            new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE username = %s",
                (new_password_hash, username)
            )
            conn.commit()

        return jsonify({'message': '密码修改成功'}), 200
    except Exception as e:
        logger.exception("修改密码失败")
        return jsonify({'msg': '服务器错误'}), 500
    finally:
        conn.close()


@app.route('/api/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    username = get_jwt_identity()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT c.id, c.title, c.created_at
                FROM conversations c
                JOIN users u ON c.user_id = u.id
                WHERE u.username = %s
                ORDER BY c.updated_at DESC
            """, (username,))
            convs = cursor.fetchall()

            result = [{
                'id': c['id'],
                'title': c['title'],
                'created_at': c['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            } for c in convs]

            return jsonify(result), 200
    except Exception as e:
        logger.exception("获取会话列表失败")
        return jsonify({'error': '服务器错误'}), 500
    finally:
        conn.close()


@app.route('/api/conversations/<int:conv_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(conv_id):
    username = get_jwt_identity()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 验证该会话属于当前用户
            cursor.execute("""
                SELECT c.id FROM conversations c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = %s AND u.username = %s
            """, (conv_id, username))
            if not cursor.fetchone():
                return jsonify({'error': '会话不存在或无权限'}), 404

            # 获取所有消息
            cursor.execute("""
                SELECT role, content, created_at
                FROM messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC
            """, (conv_id,))
            messages = cursor.fetchall()

            result = [{
                'role': msg['role'],
                'content': msg['content'],
                'timestamp': msg['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            } for msg in messages]

            return jsonify(result), 200
    finally:
        conn.close()


@app.route('/api/ask', methods=['POST'])
@jwt_required()
def ask():
    username = get_jwt_identity()

    # 1. 获取基础数据 (兼容 JSON 和 FormData)
    if request.is_json:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        history = data.get('history', [])
        conversation_id = data.get('conversation_id')
    else:
        # FormData 模式 (上传图片时)
        user_message = request.form.get('message', '').strip()
        history_str = request.form.get('history', '[]')
        history = json.loads(history_str)
        conversation_id = request.form.get('conversation_id')

    # 获取数据库连接
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if not user:
                return jsonify({'error': '用户不存在'}), 404
            user_id = user['id']

        # 2. 处理图片文件
        image_data_url = None
        if 'image' in request.files:
            image_file = request.files['image']
            image_bytes = image_file.read()
            # 转为 Base64 字符串
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            image_data_url = f"data:{image_file.content_type};base64,{base64_image}"

        # 3. 构造当前消息的 content 结构 (Kimi 视觉模型标准)
        if image_data_url:
            # 如果有图，content 必须是 list
            # 如果没输入文字，自动补充提示词，防止 API 报错
            final_text = user_message if user_message else "请描述并分析这张图片。"
            current_content = [
                {"type": "text", "text": final_text},
                {
                    "type": "image_url",
                    "image_url": {"url": image_data_url}
                }
            ]
        else:
            # 纯文本
            if not user_message:
                return jsonify({'error': '消息内容不能为空'}), 400
            current_content = user_message

        # 4. 更新 history (确保发送给 AI 的上下文包含图片)
        # 如果 history 最后一条已经是当前用户发送的文本，则用多模态 content 替换它
        if history and history[-1]['role'] == 'user':
            history[-1]['content'] = current_content
        else:
            history.append({"role": "user", "content": current_content})

        # 5. 会话标题处理 (如果没有 ID 则新建)
        if not conversation_id:
            # 提取标题文本
            title_text = user_message[:30].strip() if user_message else "图片对话"
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO conversations (user_id, title) VALUES (%s, %s)",
                    (user_id, title_text)
                )
                conversation_id = cursor.lastrowid
                conn.commit()

        # 6. 调用 AI 接口
        # 此时 history 是完整的 (包含之前的对话和当前的图片/文本)
        answer = kimi_agent.chat(history)

        # 7. 保存 AI 的回答到数据库
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (%s, %s, %s)",
                (conversation_id, 'assistant', answer)
            )
            conn.commit()

        return jsonify({
            'answer': answer,
            'conversation_id': conversation_id
        }), 200

    except Exception as e:
        logger.exception("处理聊天请求失败")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    os.makedirs("data", exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=True)
    # python -m http.server 8080
    # http://localhost:8080
