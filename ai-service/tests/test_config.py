"""설정 로딩: ai-service/.env 에 다른 도구의 키가 있어도 서비스가 기동돼야 한다.

fgcli(에이전트 CLI)는 로그인 정보 FOODGUARD_* 를 같은 ai-service/.env 에 둔다 (fgcli/auth.py).
"""

from config import Settings


def test_unknown_keys_in_env_file_are_ignored(tmp_path):
    env = tmp_path / ".env"
    env.write_text("DB_SSL=false\nFOODGUARD_OWNER_EMAIL=agent@test.com\n", encoding="utf-8")

    settings = Settings(_env_file=env)

    assert settings.DB_SSL is False
    assert not hasattr(settings, "FOODGUARD_OWNER_EMAIL")
