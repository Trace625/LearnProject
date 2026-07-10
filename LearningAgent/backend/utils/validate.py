import re


def validate_username(username):
    if not (3 <= len(username) <= 50):
        return False
    # 允许：中文、英文、数字、下划线
    pattern = r'^[a-zA-Z0-9_\u4e00-\u9fa5]+$'
    return bool(re.match(pattern, username))


def validate_password(password):
    return 8 <= len(password) <= 16
